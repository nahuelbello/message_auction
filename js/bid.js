// bid.js
window.onload = init;

let provider, signer, contract, web3Modal;
let sharesChart, simulationChart;

async function init() {
  try {
    console.log("Initializing bid page...");
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      console.log("Using Web3Provider with window.ethereum");
    } else {
      provider = defaultProvider;
      console.log("Using default provider");
    }
    try {
      const network = await provider.getNetwork();
      console.log("Connected network:", network);
    } catch (e) {
      console.error("Network error:", e);
      showStatus("Network connection error", true);
      return;
    }
    contract = new ethers.Contract(contractAddress, contractABI, provider);
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
  if (web3Modal) web3Modal.clearCachedProvider();
  provider = defaultProvider;
  signer = null;
  contract = new ethers.Contract(contractAddress, contractABI, provider);
  document.getElementById("connectWalletBtn").style.display = "block";
  document.getElementById("disconnectWalletBtn").style.display = "none";
  showStatus("Wallet disconnected.");
}

async function getCurrentState() {
  try {
    let message, bid, totalShares;
    message = await contract.currentMessage().catch(() => "Error loading message");
    bid = await contract.currentBid().catch(() => ethers.BigNumber.from("0"));
    totalShares = await contract.totalShares().catch(() => ethers.BigNumber.from("0"));

    document.getElementById("bannerMessage").innerText = message || "This is your message";
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
    console.error("Error in getCurrentState:", err);
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
        datasets: [{
          data: [userPercentage, 100 - userPercentage],
          backgroundColor: ["#00E676", "#424242"]
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
                return context.label + ": " + context.parsed + "%";
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
  const ctxSim = document.getElementById("simulationChart").getContext("2d");
  if (!simulationChart) {
    simulationChart = new Chart(ctxSim, {
      type: "doughnut",
      data: {
        labels: ["Your Simulated Shares", "Other Shares"],
        datasets: [{
          data: [simPercentage, 100 - simPercentage],
          backgroundColor: ["#00E676", "#424242"]
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
                return context.label + ": " + context.parsed + "%";
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

// Agregar eventos para los elementos de la página de pujas…
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

// Cerrar modal de preview
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});
window.addEventListener("click", (event) => {
  if (event.target === modal) modal.style.display = "none";
});

// (Agrega aquí el resto de la lógica que necesites específica para la página de pujas)
