async function fetchWithRetry(url, options = {}) {
  let response = await fetch(url, options);

  if (response.status === 401) {
    console.warn("JWT expiré. Tentative de rafraîchissement automatique...");
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
    });

    if (refreshResponse.ok) {
      console.log("Nouveau JWT obtenu ! Rejeu de la requête initiale.");
      response = await fetch(url, options);
    } else {
      console.error("Le Refresh Token est également invalide ou révoqué.");
      window.location.href = "/login.html";
      return null;
    }
  }
  return response;
}

fetchWithRetry("/api/me")
  .then((res) => {
    if (res) return res.json();
  })
  .then((data) => {
    if (data) {
      document.getElementById("username").innerText = data.name;
      document.getElementById("user-email").innerText = data.email ?? "";
      document.getElementById("user-role").innerText = data.role ?? "";
    }
  })
  .catch((err) => console.error("Erreur d'affichage :", err));

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/login.html";
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Les gadgets
    const gadgetsResponse = await fetchWithRetry("/api/secrets");
    if (!gadgetsResponse) return;
    const gadgets = await gadgetsResponse.json();

    const container = document.querySelector("#gadgets");
    gadgets.forEach((gadget) => {
      const col = document.createElement("div");
      col.className = "col-12 col-md-6 col-lg-4";
      col.innerHTML = `
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-solid ${gadget.icon} me-2"></i>${gadget.name}
            </h5>
            <p class="card-text text-muted">${gadget.desc}</p>
          </div>
        </div>`;
      container.appendChild(col);
    });
  } catch (e) {
    console.error("Erreur de chargement :", e);
  }
});
