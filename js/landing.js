// landing.js

document.addEventListener("DOMContentLoaded", function() {
  initLanding();
  setupDeviceToggle();
  initContractData();
});

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
    const message = await common.contract.currentMessage();
    const bid = await common.contract.currentBid();
    if (message.trim() === "") { message = "This is your message"; }
    document.getElementById("bannerMessage").innerText = message;
    await loadBidHistory();
  } catch (err) {
    console.error("Error initializing contract data:", err);
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