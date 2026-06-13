// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SellEscrow v5 — Crypto P2P (BNB Smart Chain)
 *
 * New in v5:
 *  + Prepaid 0.15% seller fee held in escrow at ad creation
 *      - Consumed proportionally on successful release
 *      - Refunded proportionally on cancel / refund / unsold dust
 *  + Explicit seller cancelAd works for any leftover (incl. dust below minFill)
 *  + 2-step admin ownership transfer (kept from v4.2)
 *  + SafeERC20-style low-level calls (USDT non-returning safe)
 *  + balanceOf delta on deposit (fee-on-transfer safe — but rejects if received < required)
 *  + ReentrancyGuard on every state-changing fn
 *  + Anti-grief: max 1 open deal per (buyer, ad)
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SellEscrow {
    // ---------- Ownership (2-step) ----------
    address public owner;
    address public pendingOwner;
    address public feeCollector;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeCollectorChanged(address indexed previous, address indexed current);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    // ---------- Reentrancy guard ----------
    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "REENTRANCY");
        _lock = 2;
        _;
        _lock = 1;
    }

    // ---------- Fees ----------
    uint16 public constant SELLER_FEE_BPS = 15; // 0.15% (prepaid by seller upfront)
    uint16 public constant BUYER_FEE_BPS  = 10; // 0.10% (deducted from buyer payout)
    uint16 public constant BPS_DENOM      = 10000;

    // ---------- Timers ----------
    uint32 public constant PAY_WINDOW     = 15 minutes;
    uint32 public constant CONFIRM_WINDOW = 30 minutes;

    // ---------- Types ----------
    enum DealState { NONE, LOCKED, PAID, RELEASED, REFUNDED, DISPUTED }

    struct Ad {
        address seller;
        address token;            // address(0) = native BNB
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 lockedInDeals;
        uint256 feeReserve;       // prepaid seller fee remaining (in token units)
        uint256 minFillAmount;
        uint256 pricePerToken;
        string  paymentMethod;
        bool    active;
        uint64  createdAt;
    }

    struct Deal {
        uint256 adId;
        address buyer;
        uint256 amount;
        uint64  createdAt;
        uint64  paidAt;
        DealState state;
        address disputeRaisedBy;
    }

    // ---------- Storage ----------
    uint256 public nextAdId   = 1;
    uint256 public nextDealId = 1;

    mapping(uint256 => Ad)   public ads;
    mapping(uint256 => Deal) public deals;
    mapping(address => uint256) public feeBalance;
    mapping(uint256 => mapping(address => uint256)) public openDealByBuyer;

    // ---------- Events ----------
    event AdCreated(uint256 indexed adId, address indexed seller, address token, uint256 amount, uint256 price, uint256 prepaidFee);
    event AdCancelled(uint256 indexed adId, uint256 refunded, uint256 feeRefunded);
    event AdClosedByAdmin(uint256 indexed adId);
    event DealCreated(uint256 indexed dealId, uint256 indexed adId, address indexed buyer, uint256 amount);
    event DealPaid(uint256 indexed dealId);
    event DealReleased(uint256 indexed dealId, uint256 buyerPayout, uint256 sellerFee, uint256 buyerFee);
    event DealRefunded(uint256 indexed dealId, uint256 amount);
    event DisputeRaised(uint256 indexed dealId, address indexed by);
    event AdminReleased(uint256 indexed dealId);
    event AdminRefunded(uint256 indexed dealId);
    event FeesWithdrawn(address indexed token, uint256 amount);

    constructor(address _feeCollector) {
        owner = msg.sender;
        feeCollector = _feeCollector == address(0) ? msg.sender : _feeCollector;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeCollectorChanged(address(0), feeCollector);
    }

    // ---------- Admin ----------
    function transferOwnership(address _o) external onlyOwner {
        require(_o != address(0), "ZERO_ADDR");
        pendingOwner = _o;
        emit OwnershipTransferStarted(owner, _o);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
    function setFeeCollector(address _f) external onlyOwner {
        require(_f != address(0), "ZERO_ADDR");
        emit FeeCollectorChanged(feeCollector, _f);
        feeCollector = _f;
    }

    // ---------- Helpers ----------
    function _sellerFee(uint256 amount) internal pure returns (uint256) {
        return (amount * SELLER_FEE_BPS) / BPS_DENOM;
    }

    // ---------- Create SELL Ad ----------
    /// @notice Seller specifies trade `amount`. Must send `amount + 0.15% fee` as msg.value.
    function createSellAdNative(uint256 amount, uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external payable nonReentrant returns (uint256 adId)
    {
        require(amount > 0, "ZERO_AMOUNT");
        require(minFillAmount > 0 && minFillAmount <= amount, "BAD_MIN");
        require(pricePerToken > 0, "BAD_PRICE");
        uint256 fee = _sellerFee(amount);
        require(msg.value == amount + fee, "BAD_VALUE");
        adId = _createAd(address(0), amount, fee, minFillAmount, pricePerToken, paymentMethod);
    }

    /// @notice Seller specifies trade `amount`. Contract pulls `amount + 0.15% fee`.
    function createSellAdToken(address token, uint256 amount, uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external nonReentrant returns (uint256 adId)
    {
        require(token != address(0), "BAD_TOKEN");
        require(amount > 0, "ZERO_AMOUNT");
        require(minFillAmount > 0 && minFillAmount <= amount, "BAD_MIN");
        require(pricePerToken > 0, "BAD_PRICE");

        uint256 fee = _sellerFee(amount);
        uint256 required = amount + fee;

        uint256 before = IERC20(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), required);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        // Reject fee-on-transfer / deflationary tokens — funds would otherwise get stuck
        require(received >= required, "FEE_ON_TRANSFER_TOKEN");

        adId = _createAd(token, amount, fee, minFillAmount, pricePerToken, paymentMethod);
    }

    function _createAd(
        address token,
        uint256 amount,
        uint256 prepaidFee,
        uint256 minFill,
        uint256 price,
        string calldata pm
    ) internal returns (uint256 adId) {
        adId = nextAdId++;
        ads[adId] = Ad({
            seller: msg.sender,
            token: token,
            totalAmount: amount,
            remainingAmount: amount,
            lockedInDeals: 0,
            feeReserve: prepaidFee,
            minFillAmount: minFill,
            pricePerToken: price,
            paymentMethod: pm,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        emit AdCreated(adId, msg.sender, token, amount, price, prepaidFee);
    }

    // ---------- Cancel Ad (seller) — works for any leftover incl. dust ----------
    function cancelAd(uint256 adId) external nonReentrant {
        Ad storage a = ads[adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(a.active, "INACTIVE");
        require(a.lockedInDeals == 0, "HAS_OPEN_DEALS");
        uint256 refund = a.remainingAmount;
        uint256 feeRefund = a.feeReserve;
        a.remainingAmount = 0;
        a.feeReserve = 0;
        a.active = false;
        if (refund + feeRefund > 0) _payout(a.token, a.seller, refund + feeRefund);
        emit AdCancelled(adId, refund, feeRefund);
    }

    // ---------- Take Deal (buyer) ----------
    function takeDeal(uint256 adId, uint256 amount) external nonReentrant returns (uint256 dealId) {
        Ad storage a = ads[adId];
        require(a.active, "AD_INACTIVE");
        require(a.seller != msg.sender, "SELF_TAKE");
        require(amount >= a.minFillAmount, "BELOW_MIN");
        require(amount <= a.remainingAmount, "ABOVE_REMAINING");
        require(openDealByBuyer[adId][msg.sender] == 0, "BUYER_HAS_OPEN_DEAL");

        a.remainingAmount -= amount;
        a.lockedInDeals   += amount;

        dealId = nextDealId++;
        deals[dealId] = Deal({
            adId: adId,
            buyer: msg.sender,
            amount: amount,
            createdAt: uint64(block.timestamp),
            paidAt: 0,
            state: DealState.LOCKED,
            disputeRaisedBy: address(0)
        });
        openDealByBuyer[adId][msg.sender] = dealId;
        emit DealCreated(dealId, adId, msg.sender, amount);
    }

    function markPaid(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp <= d.createdAt + PAY_WINDOW, "PAY_WINDOW_EXPIRED");
        d.state = DealState.PAID;
        d.paidAt = uint64(block.timestamp);
        emit DealPaid(dealId);
    }

    function confirmReceived(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.PAID || d.state == DealState.DISPUTED, "BAD_STATE");
        _releaseToBuyer(dealId);
    }

    function sellerReclaimExpired(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp > d.createdAt + PAY_WINDOW, "NOT_EXPIRED");
        _returnSliceToAd(dealId);
    }

    function raiseDispute(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == d.buyer || msg.sender == a.seller, "NOT_PARTY");
        require(d.state == DealState.LOCKED || d.state == DealState.PAID, "BAD_STATE");
        if (d.state == DealState.LOCKED) {
            require(block.timestamp > d.createdAt + PAY_WINDOW, "TOO_EARLY");
        }
        d.state = DealState.DISPUTED;
        d.disputeRaisedBy = msg.sender;
        emit DisputeRaised(dealId, msg.sender);
    }

    function adminReleaseToBuyer(uint256 dealId) external onlyOwner nonReentrant {
        require(deals[dealId].state == DealState.DISPUTED, "NOT_DISPUTED");
        _releaseToBuyer(dealId);
        emit AdminReleased(dealId);
    }

    function adminRefundToSeller(uint256 dealId) external onlyOwner nonReentrant {
        require(deals[dealId].state == DealState.DISPUTED, "NOT_DISPUTED");
        _refundSliceToSeller(dealId);
        emit AdminRefunded(dealId);
    }

    function adminCloseAd(uint256 adId) external onlyOwner nonReentrant {
        Ad storage a = ads[adId];
        require(a.active, "INACTIVE");
        a.active = false;
        uint256 refund = a.remainingAmount;
        uint256 feeRefund = a.feeReserve;
        a.remainingAmount = 0;
        a.feeReserve = 0;
        if (refund + feeRefund > 0) _payout(a.token, a.seller, refund + feeRefund);
        emit AdClosedByAdmin(adId);
    }

    // ---------- Internal ----------
    function _releaseToBuyer(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;

        // seller fee already prepaid — consume proportional slice from reserve
        uint256 sellerFee = _sellerFee(amount);
        if (sellerFee > a.feeReserve) sellerFee = a.feeReserve; // rounding safety
        a.feeReserve -= sellerFee;

        uint256 buyerFee  = (amount * BUYER_FEE_BPS) / BPS_DENOM;
        uint256 buyerPayout = amount - buyerFee;

        a.lockedInDeals -= amount;
        feeBalance[a.token] += sellerFee + buyerFee;
        d.state = DealState.RELEASED;
        delete openDealByBuyer[d.adId][d.buyer];

        _payout(a.token, d.buyer, buyerPayout);
        _checkAndAutoCloseAd(a);
        emit DealReleased(dealId, buyerPayout, sellerFee, buyerFee);
    }

    function _refundSliceToSeller(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;

        // refund proportional prepaid fee back to seller too
        uint256 sliceFee = _sellerFee(amount);
        if (sliceFee > a.feeReserve) sliceFee = a.feeReserve;
        a.feeReserve -= sliceFee;

        a.lockedInDeals -= amount;
        d.state = DealState.REFUNDED;
        delete openDealByBuyer[d.adId][d.buyer];
        _payout(a.token, a.seller, amount + sliceFee);
        _checkAndAutoCloseAd(a);
        emit DealRefunded(dealId, amount);
    }

    function _returnSliceToAd(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;
        a.lockedInDeals   -= amount;
        a.remainingAmount += amount;
        // feeReserve untouched — slice is back in the ad for someone else to take
        d.state = DealState.REFUNDED;
        delete openDealByBuyer[d.adId][d.buyer];
        emit DealRefunded(dealId, amount);
    }

    // Auto-close ad if nothing more is sellable — refunds dust + remaining prepaid fee
    function _checkAndAutoCloseAd(Ad storage a) internal {
        if (a.active && a.lockedInDeals == 0 && a.remainingAmount < a.minFillAmount) {
            uint256 dust = a.remainingAmount;
            uint256 feeRefund = a.feeReserve;
            a.remainingAmount = 0;
            a.feeReserve = 0;
            a.active = false;
            if (dust + feeRefund > 0) _payout(a.token, a.seller, dust + feeRefund);
        }
    }

    // ---------- SafeERC20 (USDT-style non-returning tokens) ----------
    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ERC20_PULL_FAIL");
    }

    function _payout(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "BNB_SEND_FAIL");
        } else {
            (bool ok, bytes memory data) = token.call(
                abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
            );
            require(ok && (data.length == 0 || abi.decode(data, (bool))), "ERC20_SEND_FAIL");
        }
    }

    function withdrawFees(address token) external onlyOwner nonReentrant {
        uint256 bal = feeBalance[token];
        require(bal > 0, "NO_FEES");
        feeBalance[token] = 0;
        _payout(token, feeCollector, bal);
        emit FeesWithdrawn(token, bal);
    }

    function getAd(uint256 adId) external view returns (Ad memory) { return ads[adId]; }
    function getDeal(uint256 dealId) external view returns (Deal memory) { return deals[dealId]; }

    /// @notice Preview how much native/token must be sent for an ad of given trade amount.
    function quoteCreateCost(uint256 amount) external pure returns (uint256 totalRequired, uint256 prepaidFee) {
        prepaidFee = _sellerFee(amount);
        totalRequired = amount + prepaidFee;
    }

    receive() external payable { revert("USE_CREATE_AD"); }
}
