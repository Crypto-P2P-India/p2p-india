// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * BuyEscrow v1 — Crypto P2P (BNB Smart Chain)
 *
 * Mirror of SellEscrow v6 with roles reversed:
 *   - BUYER creates an ad: "I want USDT, I will pay INR".
 *   - SELLER (has USDT) accepts a partial/full chunk of the ad.
 *     Seller locks (amount + sellerFee) USDT into the contract for THIS ad only.
 *   - Buyer pays INR off-chain, then marks paid.
 *   - Seller releases USDT to buyer (buyer receives amount - buyerFee).
 *   - If buyer never marks paid before payment deadline -> seller can reclaim full lock.
 *   - If seller doesn't release within CONFIRM_WINDOW after markPaid -> dispute.
 *   - Admin can resolve dispute either way; seller can still release voluntarily anytime.
 *
 * Limits:
 *   - Trade $1..$50,000 (USDT, 18d on BSC).
 *   - Ad duration: 1..7 days.
 *   - Payment window per deal: 15 or 30 minutes (buyer chosen at ad creation).
 *   - Max 3 active ads per buyer.
 *   - Max 3 concurrent open deals per seller.
 *   - Max 1 concurrent open deal between the same (seller,buyer) pair.
 *
 * Fees (admin adjustable, hard-cap 1% combined):
 *   - sellerFeeBps  default 10  (0.10%) - paid up-front by seller when accepting
 *   - buyerFeeBps   default 15  (0.15%) - deducted from USDT delivered to buyer
 */

contract BuyEscrow {
    // ---------- Ownership ----------
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

    // ---------- Fees ----------
    uint16 public sellerFeeBps = 10; // 0.10%
    uint16 public buyerFeeBps  = 15; // 0.15%
    uint16 public constant MAX_TOTAL_FEE_BPS = 100; // 1%
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

    // ---------- Timing ----------
    uint32 public constant CONFIRM_WINDOW = 15 minutes;  // seller must release within this after markPaid
    uint32 public constant PAY_WINDOW_15 = 15 minutes;
    uint32 public constant PAY_WINDOW_30 = 30 minutes;
    uint32 public constant SELLER_SELF_EXTENSION = 5 minutes;   // unilateral, once
    uint32 public constant BUYER_EXTRA_15 = 15 minutes;         // buyer-requested, seller approves
    uint32 public constant BUYER_EXTRA_30 = 30 minutes;
    uint32 public constant AD_MIN_DURATION = 1 days;
    uint32 public constant AD_MAX_DURATION = 7 days;

    // ---------- Limits ----------
    uint256 public constant MIN_TRADE_USDT = 1e18;        // $1
    uint256 public constant MAX_TRADE_USDT = 50000e18;    // $50,000
    uint8   public constant MAX_ACTIVE_ADS_PER_BUYER = 3;
    uint8   public constant MAX_OPEN_DEALS_PER_SELLER = 3;

    // ---------- USDT token ----------
    address public immutable usdt;

    // ---------- Structs ----------
    enum AdStatus { Open, Closed }
    enum DealStatus { Pending, Paid, Released, Cancelled, Disputed, ResolvedToBuyer, ResolvedToSeller }

    struct Ad {
        address buyer;
        uint256 totalAmount;        // USDT requested (gross, what buyer wants to receive — pre buyer fee)
        uint256 remaining;          // USDT still unfilled
        uint256 lockedInDeals;      // USDT currently locked by pending/paid deals (excludes seller fees)
        uint256 minTrade;           // min USDT per deal
        uint256 rateInrPerUsdt;     // INR per 1 USDT, 2 decimals (e.g. 8550 = ₹85.50)
        uint32  paymentWindow;      // PAY_WINDOW_15 or _30
        uint64  expiresAt;
        uint16  buyerFeeBpsSnap;    // snapshot at ad creation
        uint16  sellerFeeBpsSnap;
        AdStatus status;
        // payment details (buyer's, shown to seller after accept)
        string paymentMethod;       // "UPI" | "Bank" | "Digital Rupee"
        string name;
        string upiOrAccount;        // UPI ID or account number
        string bankOrIfsc;          // bank name + IFSC, or empty for UPI
        string qrRef;               // URL to QR image (optional)
    }

    struct Deal {
        uint256 adId;
        address seller;
        uint256 amount;             // USDT to be delivered to buyer (pre buyer fee)
        uint256 sellerFeeLocked;    // extra USDT locked from seller as fee
        uint64  acceptedAt;
        uint64  paymentDeadline;
        uint64  markedPaidAt;
        DealStatus status;
        bool sellerExtUsed;         // seller's +5m used
        bool buyerExtRequested;     // buyer requested extension awaiting seller
        uint32  buyerExtAmount;     // requested extension seconds
        bool buyerExtApproved;      // already approved (one-shot)
    }

    uint256 public nextAdId = 1;
    uint256 public nextDealId = 1;
    mapping(uint256 => Ad) public ads;
    mapping(uint256 => Deal) public deals;
    mapping(address => uint256[]) public buyerAds;
    mapping(address => uint256[]) public sellerDeals;
    mapping(address => uint8) public sellerOpenCount;
    mapping(address => uint8) public buyerActiveAdCount;
    mapping(address => mapping(address => uint8)) public openBetween; // seller => buyer => count

    uint256 public accumulatedFees; // USDT fees withdrawable by owner

    // ---------- Events ----------
    event AdCreated(uint256 indexed adId, address indexed buyer, uint256 totalAmount, uint256 rate, uint32 payWindow, uint64 expiresAt);
    event AdClosed(uint256 indexed adId);
    event DealAccepted(uint256 indexed dealId, uint256 indexed adId, address indexed seller, uint256 amount);
    event MarkedPaid(uint256 indexed dealId);
    event Released(uint256 indexed dealId, uint256 buyerReceived, uint256 fee);
    event Reclaimed(uint256 indexed dealId);
    event ExtensionRequested(uint256 indexed dealId, uint32 seconds_);
    event ExtensionApproved(uint256 indexed dealId, uint32 seconds_);
    event SellerExtensionGranted(uint256 indexed dealId);
    event DisputeOpened(uint256 indexed dealId, address by);
    event DisputeResolved(uint256 indexed dealId, bool toBuyer);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdt) {
        require(_usdt != address(0), "USDT_ZERO");
        usdt = _usdt;
        owner = msg.sender;
        feeCollector = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ---------- Ownership ----------
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
    function setFeeCollector(address c) external onlyOwner {
        require(c != address(0), "ZERO");
        emit FeeCollectorChanged(feeCollector, c);
        feeCollector = c;
    }

    // ---------- Safe ERC20 ----------
    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = usdt.call(abi.encodeWithSelector(ERC20_TRANSFER_SELECTOR, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAIL");
    }
    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = usdt.call(abi.encodeWithSelector(ERC20_TRANSFER_FROM_SELECTOR, from, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAIL");
    }

    // ---------- Ad creation ----------
    function createAd(
        uint256 totalAmount,
        uint256 minTrade,
        uint256 rateInrPerUsdt,
        uint32  durationSeconds,
        uint32  paymentWindow,
        string calldata paymentMethod,
        string calldata name,
        string calldata upiOrAccount,
        string calldata bankOrIfsc,
        string calldata qrRef
    ) external returns (uint256 adId) {
        require(totalAmount >= MIN_TRADE_USDT && totalAmount <= MAX_TRADE_USDT, "AMOUNT_RANGE");
        require(minTrade >= MIN_TRADE_USDT && minTrade <= totalAmount, "MIN_TRADE_RANGE");
        require(rateInrPerUsdt > 0, "RATE_ZERO");
        require(durationSeconds >= AD_MIN_DURATION && durationSeconds <= AD_MAX_DURATION, "DURATION_RANGE");
        require(paymentWindow == PAY_WINDOW_15 || paymentWindow == PAY_WINDOW_30, "PAY_WIN");
        require(buyerActiveAdCount[msg.sender] < MAX_ACTIVE_ADS_PER_BUYER, "TOO_MANY_ADS");
        require(bytes(paymentMethod).length > 0 && bytes(name).length > 0 && bytes(upiOrAccount).length > 0, "PAY_DETAILS");

        adId = nextAdId++;
        ads[adId] = Ad({
            buyer: msg.sender,
            totalAmount: totalAmount,
            remaining: totalAmount,
            lockedInDeals: 0,
            minTrade: minTrade,
            rateInrPerUsdt: rateInrPerUsdt,
            paymentWindow: paymentWindow,
            expiresAt: uint64(block.timestamp + durationSeconds),
            buyerFeeBpsSnap: buyerFeeBps,
            sellerFeeBpsSnap: sellerFeeBps,
            status: AdStatus.Open,
            paymentMethod: paymentMethod,
            name: name,
            upiOrAccount: upiOrAccount,
            bankOrIfsc: bankOrIfsc,
            qrRef: qrRef
        });
        buyerAds[msg.sender].push(adId);
        buyerActiveAdCount[msg.sender] += 1;
        emit AdCreated(adId, msg.sender, totalAmount, rateInrPerUsdt, paymentWindow, ads[adId].expiresAt);
    }

    function cancelAd(uint256 adId) external {
        Ad storage a = ads[adId];
        require(a.buyer == msg.sender, "NOT_BUYER");
        require(a.status == AdStatus.Open, "AD_CLOSED");
        require(a.lockedInDeals == 0, "DEALS_OPEN");
        a.status = AdStatus.Closed;
        if (buyerActiveAdCount[msg.sender] > 0) buyerActiveAdCount[msg.sender] -= 1;
        emit AdClosed(adId);
    }

    // ---------- Seller accepts ----------
    function acceptDeal(uint256 adId, uint256 amount) external nonReentrant returns (uint256 dealId) {
        Ad storage a = ads[adId];
        require(a.status == AdStatus.Open, "AD_CLOSED");
        require(block.timestamp < a.expiresAt, "AD_EXPIRED");
        require(msg.sender != a.buyer, "SELF");
        require(amount >= a.minTrade && amount <= a.remaining, "AMOUNT");
        require(sellerOpenCount[msg.sender] < MAX_OPEN_DEALS_PER_SELLER, "SELLER_LIMIT");
        require(openBetween[msg.sender][a.buyer] == 0, "PAIR_LIMIT");

        uint256 feeLocked = (amount * a.sellerFeeBpsSnap) / BPS_DENOM;
        uint256 totalPull = amount + feeLocked;
        _safeTransferFrom(msg.sender, address(this), totalPull);

        a.remaining -= amount;
        a.lockedInDeals += amount;

        dealId = nextDealId++;
        deals[dealId] = Deal({
            adId: adId,
            seller: msg.sender,
            amount: amount,
            sellerFeeLocked: feeLocked,
            acceptedAt: uint64(block.timestamp),
            paymentDeadline: uint64(block.timestamp + a.paymentWindow),
            markedPaidAt: 0,
            status: DealStatus.Pending,
            sellerExtUsed: false,
            buyerExtRequested: false,
            buyerExtAmount: 0,
            buyerExtApproved: false
        });
        sellerDeals[msg.sender].push(dealId);
        sellerOpenCount[msg.sender] += 1;
        openBetween[msg.sender][a.buyer] += 1;
        emit DealAccepted(dealId, adId, msg.sender, amount);
    }

    // ---------- Buyer marks paid ----------
    function markPaid(uint256 dealId) external {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == a.buyer, "NOT_BUYER");
        require(d.status == DealStatus.Pending, "NOT_PENDING");
        require(block.timestamp <= d.paymentDeadline, "PAY_LATE");
        d.status = DealStatus.Paid;
        d.markedPaidAt = uint64(block.timestamp);
        emit MarkedPaid(dealId);
    }

    // ---------- Seller releases ----------
    function release(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(msg.sender == d.seller, "NOT_SELLER");
        require(d.status == DealStatus.Paid || d.status == DealStatus.Disputed, "BAD_STATE");
        _doRelease(dealId, false);
    }

    function _doRelease(uint256 dealId, bool admin) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 buyerFee = (d.amount * a.buyerFeeBpsSnap) / BPS_DENOM;
        uint256 toBuyer = d.amount - buyerFee;
        accumulatedFees += buyerFee + d.sellerFeeLocked;

        if (a.lockedInDeals >= d.amount) a.lockedInDeals -= d.amount; else a.lockedInDeals = 0;
        _decSellerCounters(d.seller, a.buyer);
        d.status = admin ? DealStatus.ResolvedToBuyer : DealStatus.Released;
        _safeTransfer(a.buyer, toBuyer);
        _maybeAutoClose(d.adId);
        emit Released(dealId, toBuyer, buyerFee + d.sellerFeeLocked);
    }

    // ---------- Seller reclaims after expired pay window (buyer didn't mark paid) ----------
    function reclaimExpired(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == d.seller, "NOT_SELLER");
        require(d.status == DealStatus.Pending, "NOT_PENDING");
        require(block.timestamp > d.paymentDeadline, "NOT_EXPIRED");
        _refundSeller(dealId, DealStatus.Cancelled);
        emit Reclaimed(dealId);
    }

    function _refundSeller(uint256 dealId, DealStatus newStatus) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 refund = d.amount + d.sellerFeeLocked;
        if (a.lockedInDeals >= d.amount) a.lockedInDeals -= d.amount; else a.lockedInDeals = 0;
        // Return the buyer's requested portion back to ad as still available
        a.remaining += d.amount;
        _decSellerCounters(d.seller, a.buyer);
        d.status = newStatus;
        _safeTransfer(d.seller, refund);
    }

    function _decSellerCounters(address seller, address buyer) internal {
        if (sellerOpenCount[seller] > 0) sellerOpenCount[seller] -= 1;
        if (openBetween[seller][buyer] > 0) openBetween[seller][buyer] -= 1;
    }

    function _maybeAutoClose(uint256 adId) internal {
        Ad storage a = ads[adId];
        if (a.status == AdStatus.Open && a.remaining == 0 && a.lockedInDeals == 0) {
            a.status = AdStatus.Closed;
            if (buyerActiveAdCount[a.buyer] > 0) buyerActiveAdCount[a.buyer] -= 1;
            emit AdClosed(adId);
        }
    }

    // ---------- Extensions ----------
    function sellerGrantBonus(uint256 dealId) external {
        Deal storage d = deals[dealId];
        require(msg.sender == d.seller, "NOT_SELLER");
        require(d.status == DealStatus.Pending, "NOT_PENDING");
        require(!d.sellerExtUsed, "USED");
        require(block.timestamp <= d.paymentDeadline, "EXPIRED");
        d.sellerExtUsed = true;
        d.paymentDeadline += SELLER_SELF_EXTENSION;
        emit SellerExtensionGranted(dealId);
    }

    function requestExtension(uint256 dealId, uint32 seconds_) external {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == a.buyer, "NOT_BUYER");
        require(d.status == DealStatus.Pending, "NOT_PENDING");
        require(!d.buyerExtApproved, "ALREADY_APPROVED");
        require(seconds_ == BUYER_EXTRA_15 || seconds_ == BUYER_EXTRA_30, "BAD_SECS");
        d.buyerExtRequested = true;
        d.buyerExtAmount = seconds_;
        emit ExtensionRequested(dealId, seconds_);
    }

    function approveExtension(uint256 dealId) external {
        Deal storage d = deals[dealId];
        require(msg.sender == d.seller, "NOT_SELLER");
        require(d.buyerExtRequested && !d.buyerExtApproved, "NO_REQ");
        require(d.status == DealStatus.Pending, "NOT_PENDING");
        d.buyerExtApproved = true;
        d.buyerExtRequested = false;
        d.paymentDeadline += d.buyerExtAmount;
        emit ExtensionApproved(dealId, d.buyerExtAmount);
    }

    // ---------- Dispute ----------
    function openDispute(uint256 dealId) external {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == d.seller || msg.sender == a.buyer, "NOT_PARTY");
        require(d.status == DealStatus.Paid, "BAD_STATE");
        require(block.timestamp > uint256(d.markedPaidAt) + CONFIRM_WINDOW, "TOO_EARLY");
        d.status = DealStatus.Disputed;
        emit DisputeOpened(dealId, msg.sender);
    }

    function adminReleaseToBuyer(uint256 dealId) external onlyOwner nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == DealStatus.Disputed, "NOT_DISPUTED");
        _doRelease(dealId, true);
        emit DisputeResolved(dealId, true);
    }

    function adminReleaseToSeller(uint256 dealId) external onlyOwner nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == DealStatus.Disputed, "NOT_DISPUTED");
        _refundSeller(dealId, DealStatus.ResolvedToSeller);
        emit DisputeResolved(dealId, false);
    }

    // ---------- Fees ----------
    function withdrawFees(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= accumulatedFees, "EXCEEDS");
        accumulatedFees -= amount;
        _safeTransfer(feeCollector, amount);
        emit FeesWithdrawn(feeCollector, amount);
    }

    // ---------- Views ----------
    function getAd(uint256 adId) external view returns (Ad memory) { return ads[adId]; }
    function getDeal(uint256 dealId) external view returns (Deal memory) { return deals[dealId]; }
    function getBuyerAds(address buyer) external view returns (uint256[] memory) { return buyerAds[buyer]; }
    function getSellerDeals(address seller) external view returns (uint256[] memory) { return sellerDeals[seller]; }

    function getActiveAds(uint256 startId, uint256 maxCount) external view returns (uint256[] memory ids) {
        uint256 end = nextAdId;
        uint256 n;
        ids = new uint256[](maxCount);
        for (uint256 i = startId; i < end && n < maxCount; i++) {
            Ad storage a = ads[i];
            if (a.status == AdStatus.Open && block.timestamp < a.expiresAt && a.remaining > 0) {
                ids[n++] = i;
            }
        }
        assembly { mstore(ids, n) }
    }
}
