// bid.js

// Se ejecuta al cargar la ventana
window.onload = init;

let provider, signer, contract, web3Modal;
let sharesChart, simulationChart;

/**
 * Inicializa la página de pujas configurando el proveedor, el contrato y los eventos.
 */
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
    console.log("Contract initialized");
    await getCurrentState();
    updateSimulationChart(0);
    // Escucha nuevos eventos de pujas
    contract.on("NewBid", (bidder, bid, message) => {
      console.log("New bid detected");
      getCurrentState();
    });
  } catch (err) {
    console.error("Error in init:", err);
    showStatus("Error initializing bid page", true);
  }
}

/**
 * Conecta la wallet del usuario usando Web3Modal.
 */
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

/**
 * Desconecta la wallet del usuario.
 */
function disconnectWallet() {
  if (web3Modal) { web3Modal.clearCachedProvider(); }
  provider = defaultProvider;
  signer = null;
  contract = new ethers.Contract(contractAddress, contractABI, provider);
  document.getElementById("connectWalletBtn").style.display = "block";
  document.getElementById("disconnectWalletBtn").style.display = "none";
  showStatus("Wallet disconnected.");
}

/**
 * Obtiene el estado actual del contrato y actualiza la interfaz.
 */
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

/**
 * Actualiza el gráfico principal con el porcentaje de shares del usuario.
 * @param {number} userPercentage - El porcentaje de shares del usuario.
 */
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

/**
 * Actualiza el gráfico de simulación con un porcentaje simulado de shares.
 * @param {number} simPercentage - El porcentaje simulado de shares.
 */
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

// Eventos para actualizar la vista previa del mensaje
document.getElementById("newMessage").addEventListener("input", () => {
  const text = document.getElementById("newMessage").value || "This is your message";
  document.getElementById("smallPreview").innerText = text;
});

// Muestra el modal de vista previa al hacer clic en la vista previa
document.getElementById("smallPreview").addEventListener("click", () => {
  let text = document.getElementById("newMessage").value;
  if (text.trim() === "") { text = "This is your message"; }
  document.getElementById("previewBanner").innerText = text;
  document.getElementById("modal").style.display = "block";
});

// Evento para colocar una puja
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

// Evento para el botón de retiro de fondos
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

// Eventos para conectar/desconectar la wallet
document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);

// Cierra el modal de vista previa
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

// Funcionalidad para el popup de explicación de shares
document.addEventListener("DOMContentLoaded", function() {
  const sharesInfoIcon = document.getElementById("sharesInfo");
  const sharesPopup = document.getElementById("sharesPopup");
  const closeSharesPopup = document.getElementById("closeSharesPopup");

  sharesInfoIcon.addEventListener("click", function(e) {
    e.stopPropagation();
    sharesPopup.style.display = "block";
  });

  closeSharesPopup.addEventListener("click", function(e) {
    e.stopPropagation();
    sharesPopup.style.display = "none";
  });

  window.addEventListener("click", function(e) {
    if (!sharesPopup.contains(e.target) && e.target !== sharesInfoIcon) {
      sharesPopup.style.display = "none";
    }
  });
});

/**
 * Función para realizar scroll suave hasta el elemento destino.
 * @param {string} targetId - El ID del elemento destino.
 * @param {number} [duration=800] - Duración de la animación en milisegundos.
 */
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

// Evento para el enlace que lleva a la sección del simulador
document.addEventListener("DOMContentLoaded", function() {
  const goToSimulate = document.getElementById("goToSimulate");
  if (goToSimulate) {
    goToSimulate.addEventListener("click", function(e) {
      e.preventDefault();
      smoothScrollTo("simulateOwnershipSection", 800);
      document.getElementById("sharesPopup").style.display = "none";
    });
  }
});

/**
 * Función para verificar si se está conectado a la red correcta.
 * @returns {boolean} - True si la red es la correcta (chainId 1), false en caso contrario.
 */
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

/**
 * Carga el historial de pujas y lo muestra en la interfaz.
 */
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
