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

    try {
      const res = await fetch("/enable-2fa", { method: "POST" });

      if (res.status === 401) {
        showError(
          'Vous devez être connecté. <a href="/login.html">Se connecter</a>',
        );
        return;
      }
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
    const token = document.getElementById("totp").value.trim();

    const res = await fetch("/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();

    const type = res.ok ? "success" : "danger";
    const text = res.ok ? data.message : data.erreur || "Code invalide.";
    verifyMsg.innerHTML =
      '<div class="alert alert-' + type + ' mb-0">' + text + "</div>";
  });
});
