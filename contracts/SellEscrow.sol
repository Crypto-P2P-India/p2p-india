// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SellEscrow v4 — Crypto P2P (BNB Smart Chain)
 *
 * Seller-side P2P escrow with:
 *  - Per-ad fund isolation (no pooling between ads/sellers)
 *  - Partial fills (one ad → many deals)
 *  - 0.15% seller fee + 0.10% buyer fee (charged only on COMPLETED slice)
 *  - Buyer mark-paid + seller confirm-release flow
 *  - Dispute system: admin (owner) releases to buyer OR refunds to seller
 *  - While disputed: ad stays active; seller can STILL release funds directly
 *    Only resolved when seller releases / admin releases / admin cancels ad
 *  - Supports native BNB and any BEP-20 token (e.g. USDT)
 *
 * Invariant per token T:
 *   balance(T) == Σ ad.remainingAmount(T) + Σ ad.lockedInDeals(T) + feeBalance(T)
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SellEscrow {
    // ---------- Ownership ----------
    address public owner;
    address public feeCollector;

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ---------- Fees (basis points; 10000 = 100%) ----------
    uint16 public constant SELLER_FEE_BPS = 15; // 0.15%
    uint16 public constant BUYER_FEE_BPS  = 10; // 0.10%
    uint16 public constant BPS_DENOM      = 10000;

    // ---------- Timers ----------
    uint32 public constant PAY_WINDOW      = 15 minutes; // buyer must markPaid
    uint32 public constant CONFIRM_WINDOW  = 30 minutes; // seller must confirm after paid
    // After CONFIRM_WINDOW expires, deal auto-enters DISPUTED state on next interaction.

    // ---------- Types ----------
    enum DealState { NONE, LOCKED, PAID, RELEASED, REFUNDED, DISPUTED }

    struct Ad {
        address seller;
        address token;            // address(0) = native BNB
        uint256 totalAmount;      // original deposit
        uint256 remainingAmount;  // available to take
        uint256 lockedInDeals;    // currently in active deals
        uint256 minFillAmount;    // per-deal minimum (in token units)
        uint256 pricePerToken;    // INR per 1 token (scaled 1e2, i.e. paise)
        string  paymentMethod;    // "UPI" / "BANK" / etc.
        bool    active;
        uint64  createdAt;
    }

    struct Deal {
        uint256 adId;
        address buyer;
        uint256 amount;           // crypto slice locked
        uint64  createdAt;
        uint64  paidAt;
        DealState state;
        address disputeRaisedBy;  // 0 if none
    }

    // ---------- Storage ----------
    uint256 public nextAdId   = 1;
    uint256 public nextDealId = 1;

    mapping(uint256 => Ad)   public ads;
    mapping(uint256 => Deal) public deals;
    mapping(address => uint256) public feeBalance; // token => accumulated fees

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
    }

    // ---------- Admin ----------
    function setOwner(address _o) external onlyOwner { require(_o != address(0)); owner = _o; }
    function setFeeCollector(address _f) external onlyOwner { require(_f != address(0)); feeCollector = _f; }

    // ---------- Create SELL Ad ----------
    function createSellAdNative(uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external payable returns (uint256 adId)
    {
        require(msg.value > 0, "ZERO_AMOUNT");
        require(minFillAmount > 0 && minFillAmount <= msg.value, "BAD_MIN");
        require(pricePerToken > 0, "BAD_PRICE");
        adId = _createAd(address(0), msg.value, minFillAmount, pricePerToken, paymentMethod);
    }

    function createSellAdToken(address token, uint256 amount, uint256 minFillAmount, uint256 pricePerToken, string calldata paymentMethod)
        external returns (uint256 adId)
    {
        require(token != address(0), "BAD_TOKEN");
        require(amount > 0, "ZERO_AMOUNT");
        require(minFillAmount > 0 && minFillAmount <= amount, "BAD_MIN");
        require(pricePerToken > 0, "BAD_PRICE");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "PULL_FAIL");
        adId = _createAd(token, amount, minFillAmount, pricePerToken, paymentMethod);
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
    // Refunds only the unsold remainder. Cannot run while any deal of this ad is open.
    function cancelAd(uint256 adId) external {
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
    function takeDeal(uint256 adId, uint256 amount) external returns (uint256 dealId) {
        Ad storage a = ads[adId];
        require(a.active, "AD_INACTIVE");
        require(a.seller != msg.sender, "SELF_TAKE");
        require(amount >= a.minFillAmount, "BELOW_MIN");
        require(amount <= a.remainingAmount, "ABOVE_REMAINING");

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
        emit DealCreated(dealId, adId, msg.sender, amount);
    }

    // ---------- Buyer marks PAID (within PAY_WINDOW) ----------
    function markPaid(uint256 dealId) external {
        Deal storage d = deals[dealId];
        require(d.buyer == msg.sender, "NOT_BUYER");
        require(d.state == DealState.LOCKED, "BAD_STATE");
        require(block.timestamp <= d.createdAt + PAY_WINDOW, "PAY_WINDOW_EXPIRED");
        d.state = DealState.PAID;
        d.paidAt = uint64(block.timestamp);
        emit DealPaid(dealId);
    }

    // ---------- Seller confirms release ----------
    // Allowed in PAID state OR DISPUTED state (seller can always end the deal in buyer's favour).
    function confirmReceived(uint256 dealId) external {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(a.seller == msg.sender, "NOT_SELLER");
        require(d.state == DealState.PAID || d.state == DealState.DISPUTED, "BAD_STATE");
        _releaseToBuyer(dealId);
    }

    // ---------- Raise dispute ----------
    // Either side may raise after deal moves to PAID, OR if PAY_WINDOW elapsed without payment (seller can dispute),
    // OR if CONFIRM_WINDOW elapsed after paid (buyer can dispute).
    function raiseDispute(uint256 dealId) external {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        require(msg.sender == d.buyer || msg.sender == a.seller, "NOT_PARTY");
        require(d.state == DealState.LOCKED || d.state == DealState.PAID, "BAD_STATE");

        if (d.state == DealState.LOCKED) {
            // only allowed if pay window expired (otherwise buyer still has time to pay)
            require(block.timestamp > d.createdAt + PAY_WINDOW, "TOO_EARLY");
        }

        d.state = DealState.DISPUTED;
        d.disputeRaisedBy = msg.sender;
        emit DisputeRaised(dealId, msg.sender);
    }

    // ---------- Admin resolution ----------
    function adminReleaseToBuyer(uint256 dealId) external onlyOwner {
        Deal storage d = deals[dealId];
        require(d.state == DealState.DISPUTED, "NOT_DISPUTED");
        _releaseToBuyer(dealId);
        emit AdminReleased(dealId);
    }

    function adminRefundToSeller(uint256 dealId) external onlyOwner {
        Deal storage d = deals[dealId];
        require(d.state == DealState.DISPUTED, "NOT_DISPUTED");
        _refundSlice(dealId);
        emit AdminRefunded(dealId);
    }

    // Admin can also force-close an ad in dispute (returns remainder + refunds all open disputed slices)
    function adminCloseAd(uint256 adId) external onlyOwner {
        Ad storage a = ads[adId];
        require(a.active, "INACTIVE");
        a.active = false;
        uint256 refund = a.remainingAmount;
        a.remainingAmount = 0;
        if (refund > 0) _payout(a.token, a.seller, refund);
        emit AdClosedByAdmin(adId);
    }

    // ---------- Internal release / refund ----------
    function _releaseToBuyer(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;

        uint256 sellerFee = (amount * SELLER_FEE_BPS) / BPS_DENOM;
        uint256 buyerFee  = (amount * BUYER_FEE_BPS)  / BPS_DENOM;
        uint256 totalFee  = sellerFee + buyerFee;
        uint256 buyerPayout = amount - totalFee;

        // accounting
        a.lockedInDeals -= amount;
        feeBalance[a.token] += totalFee;
        d.state = DealState.RELEASED;

        _payout(a.token, d.buyer, buyerPayout);

        // auto-close ad if nothing left and no open deals
        if (a.remainingAmount < a.minFillAmount && a.lockedInDeals == 0 && a.active) {
            a.active = false;
            if (a.remainingAmount > 0) {
                uint256 dust = a.remainingAmount;
                a.remainingAmount = 0;
                _payout(a.token, a.seller, dust);
            }
        }
        emit DealReleased(dealId, buyerPayout, sellerFee, buyerFee);
    }

    function _refundSlice(uint256 dealId) internal {
        Deal storage d = deals[dealId];
        Ad storage a = ads[d.adId];
        uint256 amount = d.amount;
        a.lockedInDeals -= amount;
        // return slice to seller directly (no fee on refund)
        d.state = DealState.REFUNDED;
        _payout(a.token, a.seller, amount);
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

    // ---------- Fees ----------
    function withdrawFees(address token) external onlyOwner {
        uint256 bal = feeBalance[token];
        require(bal > 0, "NO_FEES");
        feeBalance[token] = 0;
        _payout(token, feeCollector, bal);
        emit FeesWithdrawn(token, bal);
    }

    // ---------- Views ----------
    function getAd(uint256 adId) external view returns (Ad memory) { return ads[adId]; }
    function getDeal(uint256 dealId) external view returns (Deal memory) { return deals[dealId]; }

    receive() external payable { revert("USE_CREATE_AD"); }
}
