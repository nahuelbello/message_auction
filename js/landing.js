// landing.js

// Execute when the DOM is fully loaded (for the landing page)
document.addEventListener("DOMContentLoaded", function() {
  initLanding();
  setupDeviceToggle();
});

/**
 * Initialization function for the landing page.
 * Add any landing page specific initialization here, e.g., starting animations or displaying static messages.
 */
function initLanding() {
  console.log("Landing page initialized");
  // Add any static data or effects initialization here.
}

/**
 * Configures the device toggle functionality on the landing page.
 * Listens for changes on radio buttons to switch between mobile and desktop views.
 */
function setupDeviceToggle() {
  // Assuming you have radio buttons with the name "deviceType" on the landing page
  const radios = document.getElementsByName("deviceType");
  Array.from(radios).forEach(function(radio) {
    radio.addEventListener("change", function() {
      setDeviceView(this.value);
    });
  });
  const defaultDevice = isMobileDevice() ? "mobile" : "desktop";
  setDeviceView(defaultDevice);
}

/**
 * Detects whether the current device is a mobile device.
 * @returns {boolean} - True if the device is mobile, false otherwise.
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Shows or hides sections based on the selected device view.
 * @param {string} device - The device type ("mobile" or "desktop").
 */
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
