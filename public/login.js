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

    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.redirected) {
      window.location.href = response.url;
    } else {
      showError(await response.text());
    }
  });
});
