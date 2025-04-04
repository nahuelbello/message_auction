// app.js

// Variables globales y configuración inicial
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

let provider = defaultProvider;
let signer = null;
let contract = new ethers.Contract(contractAddress, contractABI, provider);
let web3Modal = null;
let sharesChart, simulationChart;

// Funciones auxiliares (de common.js)
function showStatus(message, isError = false) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.innerText = message;
  statusEl.style.backgroundColor = isError ? "#ffcccb" : "#00E676";
  statusEl.style.color = isError ? "#b71c1c" : "#121212";
  statusEl.style.opacity = "1";
  setTimeout(() => { statusEl.style.opacity = "0"; }, 3000);
}

function getCustomErrorMessage(err, context) {
  const message = err.message || "";
  if (context === "placeBid") {
    if (message.includes("New bid must exceed current bid")) return "Your bid must exceed the current bid by at least 0.01 ETH.";
    else if (message.includes("Initial bid must be")) return "Your initial bid must be at least 0.01 ETH.";
    else if (message.includes("Founder fee transfer failed")) return "Failed to transfer founder fee. Please try again.";
  } else if (context === "withdraw") {
    if (message.includes("No shares")) return "You have no shares.";
    else if (message.includes("No funds to withdraw")) return "There are no funds available for withdrawal.";
    else if (message.includes("Withdrawal failed")) return "Withdrawal failed. Please try again.";
  } else if (context === "simulate") {
    if (message.includes("invalid value")) return "Please enter a valid ETH amount.";
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

// Funciones compartidas
async function checkNetwork() {
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== 1) {
      showStatus("Please connect to the Ethereum Mainnet", true);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Error checking network:", e);
    return false;
  }
}

async function loadBidHistory() {
  try {
    const filter = contract.filters.NewBid();
    const events = await contract.queryFilter(filter, 0, "latest");
    const bidHistoryDiv = document.getElementById("bidHistory");
    if (!bidHistoryDiv) return; // Evitar errores si no está en la página
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

// Lógica específica para cada página
document.addEventListener("DOMContentLoaded", function () {
  // Detectar qué página estamos cargando
  const isBidPage = document.getElementById("bid-widget") !== null;
  const isLandingPage = document.getElementById("mobileInstructions") !== null; // Elemento único de landing

  // Lógica de bid.js
  if (isBidPage) {
    async function initBid() {
      try {
        console.log("Initializing bid page...");
        if (window.ethereum) {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          console.log("Using Web3Provider with window.ethereum");
        } else {
          provider = defaultProvider;
          console.log("Using default provider");
        }
        const network = await provider.getNetwork();
        console.log("Connected network:", network);
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
        showStatus("Error initializing bid page", true);
      }
    }

    async function connectWallet() {
      try {
        console.log("Connecting wallet...");
        const providerOptions = {
          walletconnect: {
            package: window.WalletConnectProvider,
            options: {
              rpc: { 1: "https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg" },
            },
          },
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
      if (web3Modal) {
        web3Modal.clearCachedProvider();
      }
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
        let message = await contract.currentMessage();
        let bid = await contract.currentBid();
        let totalShares = await contract.totalShares();
        if (message.trim() === "") message = "This is your message";
        document.getElementById("bannerMessage").innerText = message;
        document.getElementById("currentBid").innerText = ethers.utils.formatEther(bid);
        document.getElementById("totalShares").innerText = formatSharesFriendly(totalShares);

        updateChart(0);

        if (signer) {
          const userAddress = await signer.getAddress();
          const userShares = await contract.sharesOf(userAddress);
          const pending = await contract.pendingReward(userAddress);
          let userSharesPercentage = "0";
          if (!totalShares.eq(0)) {
            const percentage = userShares.mul(10000).div(totalShares).toNumber() / 100;
            userSharesPercentage = percentage.toFixed(2);
          }
          document.getElementById("pendingReward").innerText = ethers.utils.formatEther(pending);
          document.getElementById("userSharesPercentage").innerText = userSharesPercentage;
          updateChart(parseFloat(userSharesPercentage));
        }
        await loadBidHistory();
      } catch (err) {
        console.error("General error in getCurrentState:", err);
        showStatus("Error loading contract state", true);
      }
    }

    function updateChart(userPercentage) {
      const ctx = document.getElementById("sharesChart").getContext("2d");
      if (!sharesChart) {
        sharesChart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Your Shares", "Other Shares"],
            datasets: [{ data: [userPercentage, 100 - userPercentage], backgroundColor: ["#00E676", "#424242"] }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true },
            plugins: { tooltip: { callbacks: { label: (context) => context.label + ": " + context.parsed + "%" } } },
          },
        });
      } else {
        sharesChart.data.datasets[0].data = [userPercentage, 100 - userPercentage];
        sharesChart.update();
      }
    }

    function updateSimulationChart(simPercentage) {
      const ctxSim = document.getElementById("simulationChart").getContext("2d");
      if (!simulationChart) {
        simulationChart = new Chart(ctxSim, {
          type: "doughnut",
          data: {
            labels: ["Your Simulated Shares", "Other Shares"],
            datasets: [{ data: [simPercentage, 100 - simPercentage], backgroundColor: ["#00E676", "#424242"] }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true },
            plugins: { tooltip: { callbacks: { label: (context) => context.label + ": " + context.parsed + "%" } } },
          },
        });
      } else {
        simulationChart.data.datasets[0].data = [simPercentage, 100 - simPercentage];
        simulationChart.update();
      }
    }

    // Eventos de la interfaz
    document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
    document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);

    document.getElementById("newMessage").addEventListener("input", () => {
      const text = document.getElementById("newMessage").value || "This is your message";
      document.getElementById("smallPreview").innerText = text;
    });

    document.getElementById("smallPreview").addEventListener("click", () => {
      let text = document.getElementById("newMessage").value;
      if (text.trim() === "") text = "This is your message";
      document.getElementById("previewBanner").innerText = text;
      document.getElementById("modal").style.display = "block";
    });

    document.getElementById("placeBidBtn").addEventListener("click", async (e) => {
      e.preventDefault();
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
        const tx = await contract.placeBid(newMessage, { value: ethers.utils.parseEther(bidAmount) });
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

    const modal = document.getElementById("modal");
    const closeModal = document.getElementById("closeModal");
    closeModal.addEventListener("click", () => (modal.style.display = "none"));
    window.addEventListener("click", (event) => {
      if (event.target === modal) modal.style.display = "none";
    });

    const sharesInfoIcon = document.getElementById("sharesInfo");
    const sharesPopup = document.getElementById("sharesPopup");
    const closeSharesPopup = document.getElementById("closeSharesPopup");

    sharesInfoIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      sharesPopup.style.display = "block";
    });

    closeSharesPopup.addEventListener("click", () => (sharesPopup.style.display = "none"));

    window.addEventListener("click", (e) => {
      if (!sharesPopup.contains(e.target) && e.target !== sharesInfoIcon) sharesPopup.style.display = "none";
    });

    const goToSimulate = document.getElementById("goToSimulate");
    if (goToSimulate) {
      goToSimulate.addEventListener("click", (e) => {
        e.preventDefault();
        smoothScrollTo("simulateOwnershipSection", 800);
        sharesPopup.style.display = "none";
      });
    }

    function smoothScrollTo(targetId, duration = 800) {
      const target = document.getElementById(targetId);
      if (!target) return;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
      const startPosition = window.pageYOffset;
      const distance = targetPosition - startPosition;
      let startTime = null;

      function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
      }

      function easeInOutQuad(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t + b;
        t--;
        return (-c / 2) * (t * (t - 2) - 1) + b;
      }

      requestAnimationFrame(animation);
    }

    document.getElementById("simulateOwnershipBtn").addEventListener("click", async () => {
      const bidAmount = document.getElementById("simulateBidAmount").value;
      if (!bidAmount || parseFloat(bidAmount) <= 0) {
        showStatus("Please enter a valid amount in ETH.", true);
        return;
      }
      try {
        const bidValue = ethers.utils.parseEther(bidAmount);
        const SCALE = ethers.BigNumber.from("1000000000000");
        let bonusFactor = SCALE;
        let currentUserShares = ethers.BigNumber.from("0");
        let currentTotalShares = await contract.totalShares();
        if (signer) {
          const userAddress = await signer.getAddress();
          currentUserShares = await contract.sharesOf(userAddress);
          const hasClaimedBonus = await contract.earlyBirdClaimed(userAddress);
          const earlyBirdCount = await contract.earlyBirdCount();
          if (!hasClaimedBonus && earlyBirdCount.lt(10)) {
            bonusFactor = earlyBirdCount.lt(5) ? ethers.BigNumber.from("1500000000000") : ethers.BigNumber.from("1250000000000");
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

    // Iniciar la página de pujas
    initBid();
  }

  // Lógica de landing.js
  if (isLandingPage) {
    function initLanding() {
      console.log("Landing page initialized");
    }

    function setupDeviceToggle() {
      const radios = document.getElementsByName("deviceType");
      Array.from(radios).forEach(radio => {
        radio.addEventListener("change", function() {
          setDeviceView(this.value);
        });
      });
      const defaultDevice = isMobileDevice() ? "mobile" : "desktop";
      setDeviceView(defaultDevice);
    }

    function isMobileDevice() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function setDeviceView(device) {
      const mobileInstructions = document.getElementById("mobileInstructions");
      const desktopInstructions = document.getElementById("desktopInstructions");
      if (device === "mobile") {
        if (mobileInstructions) mobileInstructions.style.display = "block";
        if (desktopInstructions) desktopInstructions.style.display = "none";
      } else {
        if (mobileInstructions) mobileInstructions.style.display = "none";
        if (desktopInstructions) desktopInstructions.style.display = "block";
      }
    }

    async function initContractData() {
      try {
        const message = await contract.currentMessage();
        const bid = await contract.currentBid();
        if (message.trim() === "") {
          message = "This is your message";
        }
        document.getElementById("bannerMessage").innerText = message;
        await loadBidHistory();
      } catch (err) {
        console.error("Error initializing contract data:", err);
      }
    }

    // Iniciar la landing page
    initLanding();
    setupDeviceToggle();
    initContractData();
  }
});