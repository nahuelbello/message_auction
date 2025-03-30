// landing.js

// Se ejecuta cuando el DOM se carga (para la landing page)
document.addEventListener("DOMContentLoaded", function() {
    initLanding();
    setupDeviceToggle();
  });
  
  // Función de inicialización para la landing page
  function initLanding() {
    // Aquí puedes agregar cualquier inicialización específica de la landing,
    // por ejemplo, iniciar animaciones, mostrar mensajes estáticos, etc.
    console.log("Landing page initialized");
    // Si necesitas cargar algún dato estático o activar algún efecto, lo agregas aquí.
  }
  
// Configurar el toggle de dispositivo (si usas esta funcionalidad en la landing)
  function setupDeviceToggle() {
    // Suponiendo que tengas radio buttons con name "deviceType" en la landing
    const radios = document.getElementsByName("deviceType");
    Array.from(radios).forEach(function(radio) {
      radio.addEventListener("change", function() {
        setDeviceView(this.value);
      });
    });
    const defaultDevice = isMobileDevice() ? "mobile" : "desktop";
    setDeviceView(defaultDevice);
  }
  
  // Función para detectar si es dispositivo móvil
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Función para mostrar/ocultar secciones según el dispositivo
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
  