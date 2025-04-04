// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import ReentrancyGuard for protection against reentrancy attacks
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MessageAuction is ReentrancyGuard {
    uint256 public currentBid;
    string public currentMessage;
    address public currentBidder;

    address public founder;
    uint256 public constant FOUNDER_FEE = 4; // 4%

    uint256 public constant EARLY_BIRD_LIMIT = 10;
    uint256 public earlyBirdCount;
    mapping(address => bool) public earlyBirdClaimed;

    // Shares system
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    // Accumulated reward per share (for funds distribution)
    uint256 public accRewardPerShare;
    uint256 private constant SCALE = 1e12; // Scale factor for decimals

    // Tracks the rewards already allocated to each address
    mapping(address => uint256) public rewardDebt;

    // Minimum bid increment
    uint256 public constant MIN_INCREMENT = 0.01 ether;

    // Total bids counter
    uint256 public totalBids;

    event NewBid(address indexed bidder, uint256 bid, string message);
    event Withdrawal(address indexed user, uint256 amount);

    constructor() {
        founder = msg.sender;
    }

    /**
     * @notice Allows placing a new bid with a message.
     */
    function placeBid(string memory message) external payable nonReentrant {
        uint256 fee = (msg.value * FOUNDER_FEE) / 100;
        (bool sentFee, ) = payable(founder).call{value: fee}("");
        require(sentFee, "Founder fee transfer failed");

        uint256 amountToDistribute = msg.value - fee;
        if (totalShares > 0) {
            accRewardPerShare += (amountToDistribute * SCALE) / totalShares;
        }
        
        if (currentBid == 0) {
            require(msg.value >= MIN_INCREMENT, "Initial bid must be >= 0.01 ETH");
        } else {
            require(msg.value >= currentBid + MIN_INCREMENT, "New bid must exceed current bid by at least 0.01 ETH");
        }

        uint256 bonusFactor;
        if (!earlyBirdClaimed[msg.sender] && earlyBirdCount < EARLY_BIRD_LIMIT) {
            if (earlyBirdCount < 5) {
                bonusFactor = 1500000000000; // 1.5x for the first 5
            } else {
                bonusFactor = 1250000000000; // 1.25x for the next 5
            }
            earlyBirdClaimed[msg.sender] = true;
            earlyBirdCount++;
        } else {
            bonusFactor = 1000000000000; // 1.0x for the rest
        }

        uint256 newShares = (msg.value * bonusFactor) / SCALE;
        sharesOf[msg.sender] += newShares;
        totalShares += newShares;
        rewardDebt[msg.sender] = (sharesOf[msg.sender] * accRewardPerShare) / SCALE;

        currentBid = msg.value;
        currentMessage = message;
        currentBidder = msg.sender;

        totalBids++;
        emit NewBid(msg.sender, msg.value, message);
    }

    /**
     * @notice Allows withdrawing the accumulated rewards.
     */
    function withdraw() external nonReentrant {
        uint256 userShares = sharesOf[msg.sender];
        require(userShares > 0, "No shares");

        uint256 accumulatedReward = (userShares * accRewardPerShare) / SCALE;
        uint256 pending = accumulatedReward - rewardDebt[msg.sender];
        require(pending > 0, "No funds to withdraw");

        rewardDebt[msg.sender] = accumulatedReward;
        
        (bool sent, ) = payable(msg.sender).call{value: pending}("");
        require(sent, "Withdrawal failed");

        emit Withdrawal(msg.sender, pending);
    }

    /**
     * @notice Queries the pending reward balance for a given address.
     * @param user The address to query.
     * @return The pending reward in wei.
     */
    function pendingReward(address user) external view returns (uint256) {
        uint256 userShares = sharesOf[user];
        if (userShares == 0) return 0;
        uint256 accumulatedReward = (userShares * accRewardPerShare) / SCALE;
        return accumulatedReward - rewardDebt[user];
    }

    receive() external payable {}
    fallback() external payable {}
}
