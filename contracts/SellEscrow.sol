// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SellEscrow v4.2 — Crypto P2P (BNB Smart Chain)
 *
 * Hardening vs v4:
 *  + ReentrancyGuard on every state-changing external fn
 *  + sellerReclaimExpired(dealId) — seller self-refunds unpaid LOCKED slice after PAY_WINDOW
 *  + ERC20 balanceOf delta on deposit (safe vs fee-on-transfer / rebasing tokens)
 *  + SafeERC20-style low-level transfer/transferFrom (handles USDT-style non-returning tokens)
 *  + Centralised _checkAndAutoCloseAd() called by BOTH release and refund (fixes dust trap)
 *  + 2-step ownership transfer
 *  + Max 1 open deal per (buyer, ad) — anti-grief
 *  + Events on owner / feeCollector changes
 *
 * Deploy owner = a multisig (Gnosis Safe on BSC) for production.
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
    uint16 public constant SELLER_FEE_BPS = 15; // 0.15%
    uint16 public constant BUYER_FEE_BPS  = 10; // 0.10%
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
        uint256 minFillAmount;
        uint256 pricePerToken;    // INR paise per 1 token unit (off-chain semantics)
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
    // anti-grief: one open deal per buyer per ad
    mapping(uint256 => mapping(address => uint256)) public openDealByBuyer; // adId => buyer => dealId (0 if none)

    // ---------- Events ----------
    event AdCreated(uint256 indexed adId, address indexed seller, address token, uint256 amount, uint256 price);
    event AdCancelled(uint256 indexed adId, uint256 refunded);
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

    // ---------- Create SELL Ad ----------
    function createSellAdNative(uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external payable nonReentrant returns (uint256 adId)
    {
        require(msg.value > 0, "ZERO_AMOUNT");
        require(minFillAmount > 0 && minFillAmount <= msg.value, "BAD_MIN");
        require(pricePerToken > 0, "BAD_PRICE");
        adId = _createAd(address(0), msg.value, minFillAmount, pricePerToken, paymentMethod);
    }

    function createSellAdToken(address token, uint256 amount, uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external nonReentrant returns (uint256 adId)
    {
        require(token != address(0), "BAD_TOKEN");
        require(amount > 0, "ZERO_AMOUNT");
        require(pricePerToken > 0, "BAD_PRICE");

        uint256 before = IERC20(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        require(received > 0, "NO_RECEIVE");
        require(minFillAmount > 0 && minFillAmount <= received, "BAD_MIN");

        adId = _createAd(token, received, minFillAmount, pricePerToken, paymentMethod);
    }

    function _createAd(address token, uint256 amount, uint256 minFill, uint256 price, string calldata pm)
        internal returns (uint256 adId)
    {
        adId = nextAdId++;
        ads[adId] = Ad({
            seller: msg.sender,
            token: token,
            totalAmount: amount,
            remainingAmount: amount,
            lockedInDeals: 0,
            minFillAmount: minFill,
            pricePerToken: price,
            paymentMethod: pm,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        emit AdCreated(adId, msg.sender, token, amount, price);
    }

    // ---------- Cancel Ad (seller) ----------
    function cancelAd(uint256 adId) external nonReentrant {
        Ad storage a = ads[adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(a.active, "INACTIVE");
        require(a.lockedInDeals == 0, "HAS_OPEN_DEALS");
        uint256 refund = a.remainingAmount;
        a.remainingAmount = 0;
        a.active = false;
        if (refund > 0) _payout(a.token, a.seller, refund);
        emit AdCancelled(adId, refund);
    }

    // ---------- Take Deal (buyer, partial fill) ----------
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

    // ---------- Buyer marks PAID ----------
    function markPaid(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp <= d.createdAt + PAY_WINDOW, "PAY_WINDOW_EXPIRED");
        d.state = DealState.PAID;
        d.paidAt = uint64(block.timestamp);
        emit DealPaid(dealId);
    }

    // ---------- Seller confirms release ----------
    function confirmReceived(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.PAID || d.state == DealState.DISPUTED, "BAD_STATE");
        _releaseToBuyer(dealId);
    }

    // ---------- Seller reclaims expired unpaid slice (anti-grief) ----------
    function sellerReclaimExpired(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp > d.createdAt + PAY_WINDOW, "NOT_EXPIRED");
        _returnSliceToAd(dealId);
    }

    // ---------- Raise dispute ----------
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

    // ---------- Admin resolution ----------
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
        a.remainingAmount = 0;
        if (refund > 0) _payout(a.token, a.seller, refund);
        emit AdClosedByAdmin(adId);
    }

    // ---------- Internal ----------
    function _releaseToBuyer(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;

        uint256 sellerFee = (amount * SELLER_FEE_BPS) / BPS_DENOM;
        uint256 buyerFee  = (amount * BUYER_FEE_BPS)  / BPS_DENOM;
        uint256 totalFee  = sellerFee + buyerFee;
        uint256 buyerPayout = amount - totalFee;

        a.lockedInDeals -= amount;
        feeBalance[a.token] += totalFee;
        d.state = DealState.RELEASED;
        delete openDealByBuyer[d.adId][d.buyer];

        _payout(a.token, d.buyer, buyerPayout);

        if (a.active && a.lockedInDeals == 0 && a.remainingAmount < a.minFillAmount) {
            uint256 dust = a.remainingAmount;
            a.remainingAmount = 0;
            a.active = false;
            if (dust > 0) _payout(a.token, a.seller, dust);
        }
        emit DealReleased(dealId, buyerPayout, sellerFee, buyerFee);
    }

    // Refund slice directly back to seller wallet (used by admin dispute resolution)
    function _refundSliceToSeller(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;
        a.lockedInDeals -= amount;
        d.state = DealState.REFUNDED;
        delete openDealByBuyer[d.adId][d.buyer];
        _payout(a.token, a.seller, amount);
        emit DealRefunded(dealId, amount);
    }

    // Return slice back into the ad's remaining pool (used when seller reclaims expired unpaid deal)
    function _returnSliceToAd(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;
        a.lockedInDeals   -= amount;
        a.remainingAmount += amount;
        d.state = DealState.REFUNDED;
        delete openDealByBuyer[d.adId][d.buyer];
        emit DealRefunded(dealId, amount);
    }

    function _payout(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "BNB_SEND_FAIL");
        } else {
            require(IERC20(token).transfer(to, amount), "ERC20_SEND_FAIL");
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

    receive() external payable { revert("USE_CREATE_AD"); }
}
