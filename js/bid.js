// bid.js

let sharesChart, simulationChart;

async function init() {
  try {
    console.log("Initializing bid page...");
    if (window.ethereum) {
      common.provider = new ethers.providers.Web3Provider(window.ethereum);
      console.log("Using Web3Provider with window.ethereum");
    } else {
      common.provider = common.defaultProvider;
      console.log("Using default provider");
    }
    const network = await common.provider.getNetwork();
    console.log("Connected network:", network);
    common.contract = new ethers.Contract(common.contractAddress, common.contractABI, common.provider);
    console.log("Contract initialized");
    await getCurrentState();
    updateSimulationChart(0);
    common.contract.on("NewBid", (bidder, bid, message) => {
      console.log("New bid detected");
      getCurrentState();
    });
  } catch (err) {
    console.error("Error in init:", err);
    common.showStatus("Error initializing bid page", true);
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
            1: "https://eth-mainnet.g.alchemy.com/v2/T_QL1fNKmAx8mKNHscnvfgYyJ9OkLIxg"
          }
        }
      }
    };
    if (!common.web3Modal) {
      common.web3Modal = new window.Web3Modal.default({
        cacheProvider: false,
        providerOptions,
        disableInjectedProvider: false,
      });
    }
    const externalProvider = await common.web3Modal.connect();
    common.provider = new ethers.providers.Web3Provider(externalProvider);
    if (!await checkNetwork()) return;
    common.signer = common.provider.getSigner();
    const address = await common.signer.getAddress();
    console.log("Wallet connected:", address);
    common.contract = new ethers.Contract(common.contractAddress, common.contractABI, common.signer);
    document.getElementById("connectWalletBtn").style.display = "none";
    document.getElementById("disconnectWalletBtn").style.display = "block";
    common.showStatus("Wallet connected successfully!");
    await getCurrentState();
  } catch (e) {
    console.error("Error connecting wallet:", e);
    let customMessage = common.getCustomErrorMessage(e, "connectWallet");
    if (!customMessage) customMessage = "Error connecting wallet.";
    common.showStatus(customMessage, true);
  }
}

function disconnectWallet() {
  if (common.web3Modal) { common.web3Modal.clearCachedProvider(); }
  common.provider = common.defaultProvider;
  common.signer = null;
  common.contract = new ethers.Contract(common.contractAddress, common.contractABI, common.provider);
  document.getElementById("connectWalletBtn").style.display = "block";
  document.getElementById("disconnectWalletBtn").style.display = "none";
  common.showStatus("Wallet disconnected.");
}

async function getCurrentState() {
  try {
    console.log("Getting current state...");
    if (!common.contract) {
      console.error("Contract not initialized");
      common.showStatus("Error: Contract not initialized", true);
      return;
    }
    let message = await common.contract.currentMessage();
    let bid = await common.contract.currentBid();
    let totalShares = await common.contract.totalShares();
    if (message.trim() === "") { message = "This is your message"; }
    document.getElementById("bannerMessage").innerText = message;
    document.getElementById("currentBid").innerText = ethers.utils.formatEther(bid);
    document.getElementById("totalShares").innerText = common.formatSharesFriendly(totalShares);

    updateChart(0);

    if (common.signer) {
      const userAddress = await common.signer.getAddress();
      const userShares = await common.contract.sharesOf(userAddress);
      const pending = await common.contract.pendingReward(userAddress);
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
    common.showStatus("Error loading contract state", true);
  }
}

function updateChart(userPercentage) {
  const ctx = document.getElementById("sharesChart").getContext("2d");
  if (!sharesChart) {
    sharesChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Your Shares", "Other Shares"],
        datasets: [{ data: [userPercentage, 100 - userPercentage], backgroundColor: ["#00E676", "#424242"] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true },
        plugins: { tooltip: { callbacks: { label: context => context.label + ": " + context.parsed + "%" } } }
      }
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
        datasets: [{ data: [simPercentage, 100 - simPercentage], backgroundColor: ["#00E676", "#424242"] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true },
        plugins: { tooltip: { callbacks: { label: context => context.label + ": " + context.parsed + "%" } } }
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

document.getElementById("placeBidBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!common.signer) {
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
    common.showStatus("Sending transaction...");
    const tx = await common.contract.placeBid(newMessage, { value: ethers.utils.parseEther(bidAmount) });
    await tx.wait();
    common.showStatus("Bid placed successfully!");
    document.getElementById("newMessage").value = "";
    document.getElementById("bidAmount").value = "";
    await getCurrentState();
  } catch (err) {
    console.error(err);
    let customMessage = common.getCustomErrorMessage(err, "placeBid");
    if (!customMessage) customMessage = "Error placing bid.";
    common.showStatus(customMessage, true);
  }
});

document.getElementById("withdrawBtn").addEventListener("click", async () => {
  if (!common.signer) {
    alert("Please connect your wallet.");
    return;
  }
  try {
    common.showStatus("Processing withdrawal...");
    const tx = await common.contract.withdraw();
    await tx.wait();
    common.showStatus("Funds withdrawn successfully!");
    await getCurrentState();
  } catch (err) {
    console.error(err);
    let customMessage = common.getCustomErrorMessage(err, "withdraw");
    if (!customMessage) customMessage = "Error withdrawing funds.";
    common.showStatus(customMessage, true);
  }
});

document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);

const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
closeModal.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", (event) => { if (event.target === modal) modal.style.display = "none"; });

document.addEventListener("DOMContentLoaded", () => {
  const sharesInfoIcon = document.getElementById("sharesInfo");
  const sharesPopup = document.getElementById("sharesPopup");
  const closeSharesPopup = document.getElementById("closeSharesPopup");

  sharesInfoIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    sharesPopup.style.display = "block";
  });

  closeSharesPopup.addEventListener("click", () => sharesPopup.style.display = "none");

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
});

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
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}

async function checkNetwork() {
  try {
    const network = await common.provider.getNetwork();
    if (network.chainId !== 1) {
      common.showStatus("Please connect to the Ethereum Mainnet", true);
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
    const filter = common.contract.filters.NewBid();
    const events = await common.contract.queryFilter(filter, 0, "latest");
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

document.getElementById("simulateOwnershipBtn").addEventListener("click", async () => {
  const bidAmount = document.getElementById("simulateBidAmount").value;
  if (!bidAmount || parseFloat(bidAmount) <= 0) {
    common.showStatus("Please enter a valid amount in ETH.", true);
    return;
  }
  try {
    const bidValue = ethers.utils.parseEther(bidAmount);
    const SCALE = ethers.BigNumber.from("1000000000000"); // 1e12
    let bonusFactor = SCALE; // Default 1.0x
    let currentUserShares = ethers.BigNumber.from("0");
    let currentTotalShares = await common.contract.totalShares();
    if (common.signer) {
      const userAddress = await common.signer.getAddress();
      currentUserShares = await common.contract.sharesOf(userAddress);
      const hasClaimedBonus = await common.contract.earlyBirdClaimed(userAddress);
      const earlyBirdCount = await common.contract.earlyBirdCount();
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
    document.getElementById("newShares").innerText = common.formatSharesFriendly(newShares);
    document.getElementById("bonusFactor").innerText = (bonusFactor.toNumber() / SCALE.toNumber()).toFixed(2);
    updateSimulationChart(ownershipPercentage);
    common.showStatus("Simulation completed successfully!");
  } catch (err) {
    console.error("Error in simulation:", err);
    let customMessage = common.getCustomErrorMessage(err, "simulate");
    if (!customMessage) customMessage = "Error performing simulation.";
    common.showStatus(customMessage, true);
  }
});

window.onload = init;