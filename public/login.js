document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const twofaForm = document.getElementById("twofa-form");
  const errorMessage = document.getElementById("error-message");
  let pendingUsername = "";

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("d-none");
  }

  function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("d-none");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 403) {
      window.location.href = "/setup-2fa.html";
      return;
    }

    if (response.ok && data.requires2FA) {
      pendingUsername = data.username;
      loginForm.classList.add("d-none");
      twofaForm.classList.remove("d-none");
      return;
    }

    showError(data.error || data.erreur || "Erreur de connexion.");
  });

  twofaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const token = document.getElementById("totp").value.trim();

    const response = await fetch("/api/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: pendingUsername, token }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      window.location.href = "/bat-computer";
      return;
    }

    showError(data.error || data.erreur || "Code invalide.");
  });
});
