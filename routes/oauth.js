const express = require("express");
const path = require("path");

const {
  getProvider,
  isProviderConfigured,
  redirectUriFor,
} = require("../config/oauthProviders");
const {
  createTransaction,
  consumeTransaction,
  safeEquals,
  inspectIdToken,
  TRANSACTION_TTL_MS,
} = require("../services/oauth");
const { upsertFederatedUser, issueSession } = require("../services/users");

const router = express.Router();

const TRANSACTION_COOKIE = "oauth_txn";

const TRANSACTION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: TRANSACTION_TTL_MS,
  path: "/auth",
};

function redirectToError(res, reason, providerId) {
  const params = new URLSearchParams({ reason });
  if (providerId) params.set("provider", providerId);
  return res.redirect(`/auth-error.html?${params.toString()}`);
}

router.get("/auth-error.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "auth-error.html"));
});

router.get("/auth/:provider", (req, res) => {
  const provider = getProvider(req.params.provider);

  if (!provider) {
    return redirectToError(res, "unknown_provider");
  }
  if (!isProviderConfigured(provider)) {
    return redirectToError(res, "provider_not_configured", provider.id);
  }

  const transaction = createTransaction(provider.id);

  const authorizationUrl = new URL(provider.authorizationEndpoint);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", provider.clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUriFor(provider.id));
  authorizationUrl.searchParams.set("scope", provider.scope);
  authorizationUrl.searchParams.set("state", transaction.state);

  if (provider.supportsPkce) {
    authorizationUrl.searchParams.set("code_challenge", transaction.codeChallenge);
    authorizationUrl.searchParams.set(
      "code_challenge_method",
      transaction.codeChallengeMethod,
    );
  }

  for (const [key, value] of Object.entries(provider.extraAuthorizationParams)) {
    authorizationUrl.searchParams.set(key, value);
  }

  res.cookie(TRANSACTION_COOKIE, transaction.id, TRANSACTION_COOKIE_OPTIONS);
  res.redirect(authorizationUrl.toString());
});

router.get("/auth/:provider/callback", async (req, res) => {
  const provider = getProvider(req.params.provider);
  const transactionId = req.cookies?.[TRANSACTION_COOKIE];

  const transaction = consumeTransaction(transactionId);
  res.clearCookie(TRANSACTION_COOKIE, { path: "/auth" });

  if (!provider) {
    return redirectToError(res, "unknown_provider");
  }

  if (req.query.error) {
    console.warn(
      `[OAuth:${provider.id}] autorisation refusée : ${req.query.error} - ${req.query.error_description || ""}`,
    );
    const reason =
      req.query.error === "access_denied" ? "access_denied" : "provider_error";
    return redirectToError(res, reason, provider.id);
  }

  if (!transaction || transaction.providerId !== provider.id) {
    return redirectToError(res, "invalid_transaction", provider.id);
  }

  if (!safeEquals(String(req.query.state || ""), transaction.state)) {
    return redirectToError(res, "state_mismatch", provider.id);
  }

  const code = req.query.code;
  if (!code || typeof code !== "string") {
    return redirectToError(res, "missing_code", provider.id);
  }

  try {
    const tokens = await exchangeCodeForTokens(provider, code, transaction);

    if (!tokens.access_token) {
      throw new Error("Réponse du token endpoint sans access_token.");
    }

    let expectedSubject = null;
    if (provider.isOidc && tokens.id_token) {
      const claims = inspectIdToken(tokens.id_token, {
        issuer: provider.issuer,
        audience: provider.clientId,
      });
      if (!claims) {
        return redirectToError(res, "invalid_id_token", provider.id);
      }
      expectedSubject = claims.sub;
    }

    const profile = await provider.fetchProfile(tokens);

    if (expectedSubject && profile.providerUserId !== String(expectedSubject)) {
      return redirectToError(res, "identity_mismatch", provider.id);
    }

    const user = upsertFederatedUser({
      provider: provider.id,
      providerUserId: profile.providerUserId,
      email: profile.email,
      displayName: profile.displayName,
    });

    issueSession(res, user);
    return res.redirect("/bat-computer");
  } catch (error) {
    console.error(`[OAuth:${provider.id}] échec du flux :`, error.message);
    return redirectToError(res, "exchange_failed", provider.id);
  }
});

async function exchangeCodeForTokens(provider, code, transaction) {
  const parameters = {
    grant_type: "authorization_code",
    code,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uri: redirectUriFor(provider.id),
  };

  if (provider.supportsPkce) {
    parameters.code_verifier = transaction.codeVerifier;
  }

  let response;
  if (provider.tokenRequestMethod === "GET") {
    const url = new URL(provider.tokenEndpoint);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } else {
    response = await fetch(provider.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(parameters).toString(),
    });
  }

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Token endpoint : réponse non JSON (${raw.slice(0, 200)})`);
  }

  if (!response.ok || payload.error) {
    throw new Error(
      `Token endpoint : ${payload.error || response.status} - ${payload.error_description || ""}`,
    );
  }
  return payload;
}

module.exports = router;
