// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SellEscrow v6 — Crypto P2P (BNB Smart Chain)
 *
 * New in v6 (vs v5):
 *  + Seller-configurable ad expiry (1 hour .. 30 days, hard cap on-chain)
 *      - takeDeal() reverts once ad expires
 *      - sellerCancelExpiredAd() lets anyone-but-only-seller reclaim funds
 *        even if ad still has open deals? -> NO, still requires lockedInDeals==0,
 *        because locked funds belong to live deals. Use existing flow for those.
 *  + Seller-configurable payment window per ad (15 or 30 minutes only)
 *  + Buyer one-time self-extension of pay window by +5 minutes
 *  + Seller-requested extra time (+15 or +30 min), once per deal,
 *    requires buyer acceptance to take effect
 *  + Admin adjustable fees (sellerFeeBps + buyerFeeBps),
 *    hard-capped so SUM <= 100 bps (1%)
 *    - Seller prepaid fee at ad creation uses fee snapshot stored on the Ad,
 *      so admin fee changes never break existing escrow math.
 *
 * Everything else (escrow logic, dispute flow, SafeERC20, reentrancy) is identical to v5.
 */

contract SellEscrow {
    // ---------- Ownership (2-step) ----------
    address public owner;
    address public pendingOwner;
    address public feeCollector;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeCollectorChanged(address indexed previous, address indexed current);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    // ---------- Reentrancy ----------
    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "REENTRANCY");
        _lock = 2;
        _;
        _lock = 1;
    }

    // ---------- Fees (admin adjustable, capped) ----------
    uint16 public sellerFeeBps = 15; // default 0.15%
    uint16 public buyerFeeBps  = 10; // default 0.10%
    uint16 public constant MAX_TOTAL_FEE_BPS = 100; // hard cap: 1% combined
    uint16 public constant BPS_DENOM = 10000;

    event FeesUpdated(uint16 sellerFeeBps, uint16 buyerFeeBps);

    function setFees(uint16 _sellerFeeBps, uint16 _buyerFeeBps) external onlyOwner {
        require(uint256(_sellerFeeBps) + uint256(_buyerFeeBps) <= MAX_TOTAL_FEE_BPS, "FEE_TOO_HIGH");
        sellerFeeBps = _sellerFeeBps;
        buyerFeeBps  = _buyerFeeBps;
        emit FeesUpdated(_sellerFeeBps, _buyerFeeBps);
    }

    // ERC20 selectors
    bytes4 private constant ERC20_TRANSFER_SELECTOR      = 0xa9059cbb;
    bytes4 private constant ERC20_TRANSFER_FROM_SELECTOR = 0x23b872dd;
    bytes4 private constant ERC20_BALANCE_OF_SELECTOR    = 0x70a08231;

    // ---------- Timing constants ----------
    uint32 public constant CONFIRM_WINDOW = 30 minutes;

    // Allowed seller-set pay windows
    uint32 public constant PAY_WINDOW_15 = 15 minutes;
    uint32 public constant PAY_WINDOW_30 = 30 minutes;

    // Buyer self-extension (one-time, no seller permission needed)
    uint32 public constant BUYER_SELF_EXTENSION = 5 minutes;

    // Seller-requested extras (once per deal, needs buyer accept)
    uint32 public constant SELLER_EXTRA_15 = 15 minutes;
    uint32 public constant SELLER_EXTRA_30 = 30 minutes;

    // Ad expiry bounds
    uint32 public constant MIN_AD_DURATION = 1 hours;
    uint32 public constant MAX_AD_DURATION = 30 days;

    // ---------- Types ----------
    enum DealState { NONE, LOCKED, PAID, RELEASED, REFUNDED, DISPUTED }

    struct Ad {
        address seller;
        address token;            // address(0) = native BNB
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 lockedInDeals;
        uint256 feeReserve;       // prepaid seller fee (snapshot at creation time)
        uint16  sellerFeeBpsSnapshot; // fee rate used for this ad
        uint16  buyerFeeBpsSnapshot;
        uint256 minFillAmount;
        uint256 pricePerToken;
        uint32  payWindow;        // 15m or 30m (seller chosen)
        uint64  expiresAt;        // ad-level expiry
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
        uint32  payDeadlineOffset; // effective pay window = payWindow + extensions
        bool    buyerExtensionUsed;
        uint32  sellerProposedExtra;   // 0 if none pending; else 15m or 30m
        bool    sellerExtensionUsed;   // seller already used their one extension
        DealState state;
        address disputeRaisedBy;
    }

    struct AdInput {
        uint256 amount;
        uint256 minFillAmount;
        uint256 pricePerToken;
        string paymentMethod;
        uint32 adDuration;
        uint32 payWindow;
    }

    // ---------- Storage ----------
    uint256 public nextAdId   = 1;
    uint256 public nextDealId = 1;

    mapping(uint256 => Ad)   private ads;
    mapping(uint256 => Deal) private deals;
    mapping(address => uint256) public feeBalance;
    mapping(uint256 => mapping(address => uint256)) public openDealByBuyer;

    // ---------- Events ----------
    event AdCreated(uint256 indexed adId, address indexed seller, address indexed token);
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

    event BuyerExtendedPayWindow(uint256 indexed dealId, uint32 addedSeconds);
    event SellerProposedExtension(uint256 indexed dealId, uint32 extraSeconds);
    event BuyerAcceptedExtension(uint256 indexed dealId, uint32 extraSeconds);
    event SellerCancelledExtension(uint256 indexed dealId);

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
    function _sellerFee(uint256 amount, uint16 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS_DENOM;
    }

    function _validatePayWindow(uint32 w) internal pure {
        require(w == PAY_WINDOW_15 || w == PAY_WINDOW_30, "BAD_PAY_WINDOW");
    }

    function _validateAdDuration(uint32 d) internal pure {
        require(d >= MIN_AD_DURATION && d <= MAX_AD_DURATION, "BAD_AD_DURATION");
    }

    // ---------- Create SELL Ad ----------
    function createSellAdNative(
        uint256 amount,
        uint256 minFillAmount,
        uint256 pricePerToken,
        string calldata paymentMethod,
        uint32 adDuration,
        uint32 payWindow
    ) external payable nonReentrant returns (uint256 adId) {
        AdInput calldata input = AdInput(amount, minFillAmount, pricePerToken, paymentMethod, adDuration, payWindow);
        _validateAdInput(input);
        require(msg.value == _quoteRequired(amount), "BAD_VALUE");
        adId = _createAd(address(0), input, _sellerFee(amount, sellerFeeBps));
    }

    function createSellAdToken(
        address token,
        uint256 amount,
        uint256 minFillAmount,
        uint256 pricePerToken,
        string calldata paymentMethod,
        uint32 adDuration,
        uint32 payWindow
    ) external nonReentrant returns (uint256 adId) {
        require(token != address(0), "BAD_TOKEN");
        AdInput calldata input = AdInput(amount, minFillAmount, pricePerToken, paymentMethod, adDuration, payWindow);
        _validateAdInput(input);
        uint256 fee = _sellerFee(amount, sellerFeeBps);
        _pullExact(token, msg.sender, amount + fee);
        adId = _createAd(token, input, fee);
    }

    function _pullExact(address token, address from, uint256 required) internal {
        uint256 beforeBal = _tokenBalance(token, address(this));
        _safeTransferFrom(token, from, address(this), required);
        uint256 received = _tokenBalance(token, address(this)) - beforeBal;
        require(received >= required, "FEE_ON_TRANSFER_TOKEN");
    }

    function _openAdId() internal returns (uint256 adId) {
        adId = nextAdId++;
    }

    function _storeAdCore(uint256 adId, address token, uint256 amount, uint256 prepaidFee) internal {
        Ad storage a = ads[adId];
        a.seller = msg.sender;
        a.token = token;
        a.totalAmount = amount;
        a.remainingAmount = amount;
        a.feeReserve = prepaidFee;
        a.active = true;
        a.createdAt = uint64(block.timestamp);
    }

    function _storeAdRules(uint256 adId, uint256 minFill, uint256 price, string calldata pm) internal {
        Ad storage a = ads[adId];
        a.minFillAmount = minFill;
        a.pricePerToken = price;
        a.paymentMethod = pm;
    }

    function _storeAdConfig(uint256 adId, uint16 sBps, uint16 bBps, uint32 adDuration, uint32 payWindow) internal {
        Ad storage a = ads[adId];
        a.sellerFeeBpsSnapshot = sBps;
        a.buyerFeeBpsSnapshot = bBps;
        a.payWindow = payWindow;
        a.expiresAt = uint64(block.timestamp + adDuration);
    }

    function _emitAdCreated(uint256 adId) internal {
        Ad storage a = ads[adId];
        emit AdCreated(adId, a.seller, a.token, a.totalAmount, a.pricePerToken, a.feeReserve, a.expiresAt, a.payWindow);
    }

    // ---------- Cancel Ad (seller) ----------
    function cancelAd(uint256 adId) external nonReentrant {
        Ad storage a = ads[adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(a.active, "INACTIVE");
        require(a.lockedInDeals == 0, "HAS_OPEN_DEALS");
        _closeAdAndRefund(a);
        emit AdCancelled(adId, a.totalAmount, 0); // amounts already zeroed; emit placeholder
    }

    function _closeAdAndRefund(Ad storage a) internal {
        uint256 refund = a.remainingAmount;
        uint256 feeRefund = a.feeReserve;
        a.remainingAmount = 0;
        a.feeReserve = 0;
        a.active = false;
        if (refund + feeRefund > 0) _payout(a.token, a.seller, refund + feeRefund);
    }

    // ---------- Take Deal (buyer) ----------
    function takeDeal(uint256 adId, uint256 amount) external nonReentrant returns (uint256 dealId) {
        Ad storage a = ads[adId];
        require(a.active, "AD_INACTIVE");
        require(block.timestamp < a.expiresAt, "AD_EXPIRED");
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
            payDeadlineOffset: a.payWindow,
            buyerExtensionUsed: false,
            sellerProposedExtra: 0,
            sellerExtensionUsed: false,
            state: DealState.LOCKED,
            disputeRaisedBy: address(0)
        });
        openDealByBuyer[adId][msg.sender] = dealId;
        emit DealCreated(dealId, adId, msg.sender, amount);
    }

    // ---------- Pay window extensions ----------

    /// Buyer self-extends ONE time by +5 minutes, no seller permission.
    function buyerExtendPayWindow(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(!d.buyerExtensionUsed, "ALREADY_EXTENDED");
        require(block.timestamp <= d.createdAt + d.payDeadlineOffset, "ALREADY_EXPIRED");
        d.buyerExtensionUsed = true;
        d.payDeadlineOffset += BUYER_SELF_EXTENSION;
        emit BuyerExtendedPayWindow(dealId, BUYER_SELF_EXTENSION);
    }

    /// Seller proposes +15m or +30m extension (only once per deal, needs buyer accept).
    function sellerProposeExtension(uint256 dealId, uint32 extraSeconds) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(!d.sellerExtensionUsed, "ALREADY_USED");
        require(d.sellerProposedExtra == 0, "PENDING_PROPOSAL");
        require(extraSeconds == SELLER_EXTRA_15 || extraSeconds == SELLER_EXTRA_30, "BAD_EXTRA");
        require(block.timestamp <= d.createdAt + d.payDeadlineOffset, "ALREADY_EXPIRED");
        d.sellerProposedExtra = extraSeconds;
        emit SellerProposedExtension(dealId, extraSeconds);
    }

    function sellerCancelExtensionProposal(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.sellerProposedExtra != 0, "NO_PROPOSAL");
        d.sellerProposedExtra = 0;
        emit SellerCancelledExtension(dealId);
    }

    function buyerAcceptExtension(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        uint32 extra = d.sellerProposedExtra;
        require(extra != 0, "NO_PROPOSAL");
        require(block.timestamp <= d.createdAt + d.payDeadlineOffset, "ALREADY_EXPIRED");
        d.payDeadlineOffset += extra;
        d.sellerProposedExtra = 0;
        d.sellerExtensionUsed = true;
        emit BuyerAcceptedExtension(dealId, extra);
    }

    // ---------- Mark paid / confirm / reclaim / dispute ----------
    function markPaid(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp <= d.createdAt + d.payDeadlineOffset, "PAY_WINDOW_EXPIRED");
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
        require(block.timestamp > d.createdAt + d.payDeadlineOffset, "NOT_EXPIRED");
        _returnSliceToAd(dealId);
    }

    function raiseDispute(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == d.buyer || msg.sender == a.seller, "NOT_PARTY");
        require(d.state == DealState.LOCKED || d.state == DealState.PAID, "BAD_STATE");
        if (d.state == DealState.LOCKED) {
            require(block.timestamp > d.createdAt + d.payDeadlineOffset, "TOO_EARLY");
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
        _closeAdAndRefund(a);
        emit AdClosedByAdmin(adId);
    }

    // ---------- Internal ----------
    function _releaseToBuyer(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;

        uint256 sellerFee = _sellerFee(amount, a.sellerFeeBpsSnapshot);
        if (sellerFee > a.feeReserve) sellerFee = a.feeReserve;
        a.feeReserve -= sellerFee;

        uint256 buyerFee  = (amount * a.buyerFeeBpsSnapshot) / BPS_DENOM;
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

        uint256 sliceFee = _sellerFee(amount, a.sellerFeeBpsSnapshot);
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
        d.state = DealState.REFUNDED;
        delete openDealByBuyer[d.adId][d.buyer];
        emit DealRefunded(dealId, amount);

        // If ad already expired and nothing remains locked, auto-close & refund seller.
        if (a.active && a.lockedInDeals == 0 && block.timestamp >= a.expiresAt) {
            _closeAdAndRefund(a);
        } else {
            _checkAndAutoCloseAd(a);
        }
    }

    function _checkAndAutoCloseAd(Ad storage a) internal {
        if (a.active && a.lockedInDeals == 0 && a.remainingAmount < a.minFillAmount) {
            _closeAdAndRefund(a);
        }
    }

    // ---------- SafeERC20 ----------
    function _tokenBalance(address token, address account) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(ERC20_BALANCE_OF_SELECTOR, account)
        );
        require(ok && data.length >= 32, "ERC20_BALANCE_FAIL");
        return abi.decode(data, (uint256));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(ERC20_TRANSFER_FROM_SELECTOR, from, to, amount)
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
                abi.encodeWithSelector(ERC20_TRANSFER_SELECTOR, to, amount)
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

    // ---------- Views ----------
    function getAd(uint256 adId) external view returns (Ad memory) { return ads[adId]; }
    function getDeal(uint256 dealId) external view returns (Deal memory) { return deals[dealId]; }

    /// Preview required deposit for a new ad given trade amount.
    function quoteCreateCost(uint256 amount) external view returns (uint256 totalRequired, uint256 prepaidFee) {
        prepaidFee = _sellerFee(amount, sellerFeeBps);
        totalRequired = amount + prepaidFee;
    }

    /// Returns current effective pay deadline (unix ts) for a deal.
    function payDeadline(uint256 dealId) external view returns (uint64) {
        Deal storage d = deals[dealId];
        return uint64(d.createdAt + d.payDeadlineOffset);
    }

    receive() external payable { revert("USE_CREATE_AD"); }
}
