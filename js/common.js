// common.js
function getCustomErrorMessage(err, context) {
    const message = err.message || "";
    if (context === "placeBid") {
      if (message.includes("New bid must exceed current bid"))
        return "Your bid must exceed the current bid by at least 0.01 ETH.";
      else if (message.includes("Initial bid must be"))
        return "Your initial bid must be at least 0.01 ETH.";
      else if (message.includes("Founder fee transfer failed"))
        return "Failed to transfer founder fee. Please try again.";
    } else if (context === "withdraw") {
      if (message.includes("No shares"))
        return "You have no shares.";
      else if (message.includes("No funds to withdraw"))
        return "There are no funds available for withdrawal.";
      else if (message.includes("Withdrawal failed"))
        return "Withdrawal failed. Please try again.";
    } else if (context === "simulate") {
      if (message.includes("invalid value"))
        return "Please enter a valid ETH amount.";
    } else if (context === "connectWallet") {
      return "Failed to connect wallet. Please try again.";
    }
    return "";
  }
  
  function formatSharesFriendly(bigNum) {
    const divisor = ethers.BigNumber.from("1000000000000"); // 1e12
    const friendly = bigNum.div(divisor);
    return friendly.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  // Variables globales compartidas (si las usas en ambas páginas)
  const contractAddress = "0x5B0474f5109D9594A2b818E7c33f8BC68C403dc7";
  const contractABI = [
    "function currentBid() view returns (uint256)",
    "function currentMessage() view returns (string)",
    "function currentBidder() view returns (address)",
    "function totalShares() view returns (uint256)",
    "function sharesOf(address) view returns (uint256)",
    "function pendingReward(address user) view returns (uint256)",
    "function placeBid(string memory message) payable",
    "function withdraw()",
    "function totalBids() view returns (uint256)",
    "function earlyBirdClaimed(address) view returns (bool)",
    "function earlyBirdCount() view returns (uint256)",
    "event NewBid(address indexed bidder, uint256 bid, string message)",
    "event Withdrawal(address indexed user, uint256 amount)"
  ];
  
  const defaultProvider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg");
  
  // Función de status compartida
  function showStatus(message, isError = false) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.innerText = message;
      statusEl.style.backgroundColor = isError ? "#ffcccb" : "#00E676";
      statusEl.style.color = isError ? "#b71c1c" : "#121212";
      statusEl.style.opacity = "1";
      setTimeout(() => { statusEl.style.opacity = "0"; }, 3000);
    }
  }
  