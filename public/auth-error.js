const MESSAGES = {
  access_denied: {
    title: "Vous avez refusé l'autorisation.",
    detail:
      "Le fournisseur d'identité n'a transmis aucune information vous concernant.",
  },
  provider_error: {
    title: "Le fournisseur d'identité a renvoyé une erreur.",
    detail: "Réessayez dans quelques instants.",
  },
  provider_not_configured: {
    title: "Ce fournisseur n'est pas configuré sur ce serveur.",
    detail: "Les identifiants client sont absents de la configuration.",
  },
  unknown_provider: {
    title: "Fournisseur d'identité inconnu.",
    detail: "Utilisez l'un des boutons de la page de connexion.",
  },
  invalid_transaction: {
    title: "Session d'authentification expirée.",
    detail: "La demande a mis trop de temps ou a déjà été utilisée. Recommencez.",
  },
  state_mismatch: {
    title: "Vérification anti-CSRF échouée.",
    detail: "Le paramètre state ne correspond pas à la demande initiale.",
  },
  missing_code: {
    title: "Code d'autorisation absent.",
    detail: "La réponse du fournisseur est incomplète.",
  },
  invalid_id_token: {
    title: "Jeton d'identité invalide.",
    detail: "Les informations d'identité n'ont pas pu être validées.",
  },
  identity_mismatch: {
    title: "Incohérence d'identité détectée.",
    detail: "Par précaution, la connexion a été refusée.",
  },
  exchange_failed: {
    title: "Échec de l'échange du code d'autorisation.",
    detail: "Le serveur n'a pas pu obtenir de jeton auprès du fournisseur.",
  },
};

const PROVIDER_LABELS = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
};

const params = new URLSearchParams(window.location.search);
const message = MESSAGES[params.get("reason")] || {
  title: "La connexion n'a pas pu aboutir.",
  detail: "Une erreur inattendue est survenue.",
};
const providerLabel = PROVIDER_LABELS[params.get("provider")];

document.getElementById("error-title").textContent = providerLabel
  ? `${providerLabel} — ${message.title}`
  : message.title;
document.getElementById("error-detail").textContent = message.detail;
