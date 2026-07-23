document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generate-btn");
  const verifyForm = document.getElementById("verify-form");
  const qrSection = document.getElementById("qr-section");
  const errorBox = document.getElementById("error-message");
  const verifyMsg = document.getElementById("verify-message");

  function showError(message) {
    errorBox.innerHTML = message;
    errorBox.classList.remove("d-none");
  }

  generateBtn.addEventListener("click", async () => {
    errorBox.classList.add("d-none");
    const username = document.getElementById("username").value.trim();

    if (!username) {
      showError("Veuillez saisir un nom d'utilisateur.");
      return;
    }

    try {
      const res = await fetch("/enable-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        showError("Impossible de générer le QR code.");
        return;
      }

      const data = await res.json();
      document.getElementById("qr-code").src = data.qrCode;
      document.getElementById("secret").textContent = data.secret;
      qrSection.classList.remove("d-none");
    } catch (err) {
      showError("Erreur réseau.");
    }
  });

  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    verifyMsg.textContent = "";
    const username = document.getElementById("username").value.trim();
    const token = document.getElementById("totp").value.trim();

    const res = await fetch("/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, token }),
    });
    const data = await res.json();

    const type = res.ok ? "success" : "danger";
    const text = res.ok ? data.message : data.erreur || "Code invalide.";
    verifyMsg.innerHTML =
      '<div class="alert alert-' + type + ' mb-0">' + text + "</div>";
  });
});
