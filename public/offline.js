const statusElement = document.getElementById("connection-status");
const retryButton = document.getElementById("retry-connection");

function checkConnection() {
  if (!statusElement) return;

  if (navigator.onLine) {
    statusElement.textContent = "Conexão restaurada! Recarregando...";
    statusElement.className = "status online";
    window.setTimeout(() => window.location.reload(), 800);
    return;
  }

  statusElement.textContent = "Ainda sem conexão. Tentando reconectar...";
}

retryButton?.addEventListener("click", () => window.location.reload());
window.addEventListener("online", checkConnection);
window.setInterval(checkConnection, 5000);
checkConnection();
