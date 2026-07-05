document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const errorMessage = document.getElementById("error-message");

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("d-none");
  }

  function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("d-none");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      showError("Veuillez renseigner un nom d'utilisateur et un mot de passe.");
      return;
    }
    if (password.length < 8) {
      showError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    const response = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const message = await response.text();

    if (response.ok) {
      alert("Inscription réussie : " + message);
    } else {
      showError(message);
    }
  });
});

async function logout() {
  await fetch("/logout", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa("logout:logout") },
  });
  window.location.href = "/register.html";
}
