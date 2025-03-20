// ---------------------- Helper Functions ----------------------
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
  
  // ---------------------- Global Variables ----------------------
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
  let provider, signer, contract, web3Modal;
  let sharesChart, simulationChart;
  const defaultProvider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg");
  
  // ---------------------- Status Function ----------------------
  function showStatus(message, isError = false) {
    const statusEl = document.getElementById("status");
    statusEl.innerText = message;
    statusEl.style.backgroundColor = isError ? "#ffcccb" : "#00E676";
    statusEl.style.color = isError ? "#b71c1c" : "#121212";
    statusEl.style.opacity = "1";
    setTimeout(() => { statusEl.style.opacity = "0"; }, 3000);
  }
  
  // ---------------------- Load Bid History ----------------------
  async function loadBidHistory() {
    try {
      const filter = contract.filters.NewBid();
      const events = await contract.queryFilter(filter, 0, "latest");
      const bidHistoryDiv = document.getElementById("bidHistory");
      bidHistoryDiv.innerHTML = "";
      events.reverse().slice(0, 10).forEach(event => {
        const bidder = event.args.bidder;
        const bid = ethers.utils.formatEther(event.args.bid);
        const message = event.args.message;
        const bidElement = document.createElement("p");
        bidElement.innerHTML = `<strong>${bidder}</strong> bid <strong>${bid}</strong> ETH: ${message}`;
        bidHistoryDiv.appendChild(bidElement);
      });
    } catch (err) {
      console.error("Error loading bid history", err);
    }
  }
  
  // ---------------------- Main Functions ----------------------
  async function init() {
    try {
      console.log("Initializing application...");
      if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        console.log("Using Web3Provider with window.ethereum");
      } else {
        provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg");
        console.log("Using JsonRpcProvider fallback");
      }
      try {
        const network = await provider.getNetwork();
        console.log("Connected network:", network);
      } catch (e) {
        console.error("Error connecting to the network:", e);
        showStatus("Network connection error", true);
        return;
      }
      contract = new ethers.Contract(contractAddress, contractABI, provider);
      console.log("Contract initialized");
      await getCurrentState();
      updateSimulationChart(0);
      contract.on("NewBid", (bidder, bid, message) => {
        console.log("New bid detected");
        getCurrentState();
      });
    } catch (err) {
      console.error("Error in init:", err);
      showStatus("Error initializing application", true);
    }
  }
  
  async function connectWallet() {
    try {
      console.log("Connecting wallet...");
      const providerOptions = {
        walletconnect: {
          package: window.WalletConnectProvider,
          options: {
            rpc: {
              1337: "https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg",
              31337: "https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg"
            }
          }
        }
      };
      if (!web3Modal) {
        web3Modal = new window.Web3Modal.default({
          cacheProvider: false,
          providerOptions,
          disableInjectedProvider: false,
        });
      }
      const externalProvider = await web3Modal.connect();
      provider = new ethers.providers.Web3Provider(externalProvider);
      if (!await checkNetwork()) return;
      signer = provider.getSigner();
      const address = await signer.getAddress();
      console.log("Wallet connected:", address);
      contract = new ethers.Contract(contractAddress, contractABI, signer);
      document.getElementById("connectWalletBtn").style.display = "none";
      document.getElementById("disconnectWalletBtn").style.display = "block";
      showStatus("Wallet connected successfully!");
      await getCurrentState();
    } catch (e) {
      console.error("Error connecting wallet:", e);
      let customMessage = getCustomErrorMessage(e, "connectWallet");
      if (!customMessage) customMessage = "Error connecting wallet.";
      showStatus(customMessage, true);
    }
  }
  
  function disconnectWallet() {
    if (web3Modal) { web3Modal.clearCachedProvider(); }
    provider = defaultProvider;
    signer = null;
    contract = new ethers.Contract(contractAddress, contractABI, provider);
    document.getElementById("connectWalletBtn").style.display = "block";
    document.getElementById("disconnectWalletBtn").style.display = "none";
    showStatus("Wallet disconnected.");
  }
  
  async function getCurrentState() {
    try {
      console.log("Getting current state...");
      if (!contract) {
        console.error("Contract not initialized");
        showStatus("Error: Contract not initialized", true);
        return;
      }
      let message, bid, totalShares;
      try {
        message = await contract.currentMessage();
        console.log("Current message:", message);
      } catch (e) {
        console.error("Error loading message:", e);
        message = "Error loading message";
      }
      try {
        bid = await contract.currentBid();
        console.log("Current bid:", ethers.utils.formatEther(bid));
      } catch (e) {
        console.error("Error loading bid:", e);
        bid = ethers.BigNumber.from("0");
      }
      try {
        totalShares = await contract.totalShares();
        console.log("Total shares:", totalShares.toString());
      } catch (e) {
        console.error("Error loading total shares:", e);
        totalShares = ethers.BigNumber.from("0");
      }
      if (message.trim() === "") { message = "This is your message"; }
      document.getElementById("bannerMessage").innerText = message;
      document.getElementById("currentBid").innerText = ethers.utils.formatEther(bid);
      document.getElementById("totalShares").innerText = formatSharesFriendly(totalShares);
      
      updateChart(0);
  
      if (signer) {
        try {
          const userAddress = await signer.getAddress();
          console.log("User address:", userAddress);
          const userShares = await contract.sharesOf(userAddress);
          console.log("User shares:", userShares.toString());
          const pending = await contract.pendingReward(userAddress);
          console.log("Pending reward:", ethers.utils.formatEther(pending));
          let userSharesPercentage = "0";
          if (!totalShares.eq(0)) {
            const percentage = userShares.mul(10000).div(totalShares).toNumber() / 100;
            userSharesPercentage = percentage.toFixed(2);
          }
          document.getElementById("pendingReward").innerText = ethers.utils.formatEther(pending);
          document.getElementById("userSharesPercentage").innerText = userSharesPercentage;
          updateChart(parseFloat(userSharesPercentage));
        } catch (e) {
          console.error("Error getting user data:", e);
          showStatus("Error loading user data", true);
        }
      }
      await loadBidHistory();
    } catch (err) {
      console.error("General error in getCurrentState:", err);
      showStatus("Error loading contract state", true);
    }
  }
  
  function updateChart(userPercentage) {
    const ctx = document.getElementById('sharesChart').getContext('2d');
    if (!sharesChart) {
      sharesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Your Shares', 'Other Shares'],
          datasets: [{
            data: [userPercentage, 100 - userPercentage],
            backgroundColor: ['#00E676', '#424242']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { animateRotate: true },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label;
                  let value = context.parsed;
                  return label + ': ' + value + '%';
                }
              }
            }
          }
        }
      });
    } else {
      sharesChart.data.datasets[0].data = [userPercentage, 100 - userPercentage];
      sharesChart.update();
    }
  }
  
  function updateSimulationChart(simPercentage) {
    const ctxSim = document.getElementById('simulationChart').getContext('2d');
    if (!simulationChart) {
      simulationChart = new Chart(ctxSim, {
        type: 'doughnut',
        data: {
          labels: ['Your Simulated Shares', 'Other Shares'],
          datasets: [{
            data: [simPercentage, 100 - simPercentage],
            backgroundColor: ['#00E676', '#424242']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { animateRotate: true },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label;
                  let value = context.parsed;
                  return label + ': ' + value + '%';
                }
              }
            }
          }
        }
      });
    } else {
      simulationChart.data.datasets[0].data = [simPercentage, 100 - simPercentage];
      simulationChart.update();
    }
  }
  
  document.getElementById("newMessage").addEventListener("input", () => {
    const text = document.getElementById("newMessage").value || "This is your message";
    document.getElementById("smallPreview").innerText = text;
  });
  
  document.getElementById("smallPreview").addEventListener("click", () => {
    let text = document.getElementById("newMessage").value;
    if (text.trim() === "") { text = "This is your message"; }
    document.getElementById("previewBanner").innerText = text;
    document.getElementById("modal").style.display = "block";
  });
  
  document.getElementById("placeBidBtn").addEventListener("click", async () => {
    if (!signer) { 
      alert("Please connect your wallet.");
      return;
    }
    const newMessage = document.getElementById("newMessage").value;
    const bidAmount = document.getElementById("bidAmount").value;
    if (!newMessage || !bidAmount) {
      alert("Please enter a message and an amount.");
      return;
    }
    try {
      showStatus("Sending transaction...");
      const tx = await contract.placeBid(newMessage, {
        value: ethers.utils.parseEther(bidAmount)
      });
      await tx.wait();
      showStatus("Bid placed successfully!");
      document.getElementById("newMessage").value = "";
      document.getElementById("bidAmount").value = "";
      await getCurrentState();
    } catch (err) {
      console.error(err);
      let customMessage = getCustomErrorMessage(err, "placeBid");
      if (!customMessage) customMessage = "Error placing bid.";
      showStatus(customMessage, true);
    }
  });
  
  document.getElementById("withdrawBtn").addEventListener("click", async () => {
    if (!signer) { 
      alert("Please connect your wallet.");
      return;
    }
    try {
      showStatus("Processing withdrawal...");
      const tx = await contract.withdraw();
      await tx.wait();
      showStatus("Funds withdrawn successfully!");
      await getCurrentState();
    } catch (err) {
      console.error(err);
      let customMessage = getCustomErrorMessage(err, "withdraw");
      if (!customMessage) customMessage = "Error withdrawing funds.";
      showStatus(customMessage, true);
    }
  });
  
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);
  
  // Close preview modal
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
  
  document.getElementById("simulateOwnershipBtn").addEventListener("click", async () => {
    const bidAmount = document.getElementById("simulateBidAmount").value;
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      showStatus("Please enter a valid amount in ETH.", true);
      return;
    }
    try {
      console.log("Simulate clicked with amount:", bidAmount);
      const bidValue = ethers.utils.parseEther(bidAmount);
      const SCALE = ethers.BigNumber.from("1000000000000"); // 1e12
      let bonusFactor = SCALE;
      let currentUserShares = ethers.BigNumber.from("0");
      let currentTotalShares = await contract.totalShares();
      if (signer) {
        const userAddress = await signer.getAddress();
        currentUserShares = await contract.sharesOf(userAddress);
        const hasClaimedBonus = await contract.earlyBirdClaimed(userAddress);
        const earlyBirdCount = await contract.earlyBirdCount();
        if (!hasClaimedBonus && earlyBirdCount.lt(10)) {
          bonusFactor = earlyBirdCount.lt(5)
            ? ethers.BigNumber.from("1500000000000")
            : ethers.BigNumber.from("1250000000000");
        }
      }
      const newShares = bidValue.mul(bonusFactor).div(SCALE);
      const finalUserShares = currentUserShares.add(newShares);
      const newTotalShares = currentTotalShares.add(newShares);
      let ownershipPercentage = 0;
      if (!newTotalShares.isZero()) {
        ownershipPercentage = finalUserShares.mul(10000).div(newTotalShares).toNumber() / 100;
      }
      document.getElementById("estimatedOwnership").innerText = ownershipPercentage.toFixed(2);
      document.getElementById("newShares").innerText = formatSharesFriendly(newShares);
      document.getElementById("bonusFactor").innerText = (bonusFactor.toNumber() / SCALE.toNumber()).toFixed(2);
      updateSimulationChart(ownershipPercentage);
      showStatus("Simulation completed successfully!");
    } catch (err) {
      console.error("Error in simulation:", err);
      let customMessage = getCustomErrorMessage(err, "simulate");
      if (!customMessage) customMessage = "Error performing simulation.";
      showStatus(customMessage, true);
    }
  });
  
  async function checkNetwork() {
    try {
      const network = await provider.getNetwork();
      console.log("Current network:", network);
      if (network.chainId !== 1) {
        showStatus("Please connect to the correct network", true);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Error checking network:", e);
      return false;
    }
  }
  
  // ---------------------- Sticky Header Shrink Effect ----------------------
  window.addEventListener("scroll", () => {
    const header = document.getElementById("stickyHeader");
    if (window.scrollY > 50) {
      header.classList.add("shrink");
    } else {
      header.classList.remove("shrink");
    }
  });
  
  // Initialize on window load
  window.onload = init;
  