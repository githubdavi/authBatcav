const crypto = require("crypto");

const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const transactions = new Map();

function base64url(buffer) {
  return buffer.toString("base64url");
}

function createPkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}

function purgeExpiredTransactions() {
  const now = Date.now();
  for (const [id, transaction] of transactions) {
    if (transaction.expiresAt <= now) {
      transactions.delete(id);
    }
  }
}

function createTransaction(providerId) {
  purgeExpiredTransactions();

  const id = base64url(crypto.randomBytes(16));
  const state = base64url(crypto.randomBytes(32));
  const pkce = createPkcePair();

  transactions.set(id, {
    providerId,
    state,
    codeVerifier: pkce.codeVerifier,
    expiresAt: Date.now() + TRANSACTION_TTL_MS,
  });

  return { id, state, ...pkce };
}

function consumeTransaction(id) {
  if (!id) return null;

  const transaction = transactions.get(id);
  transactions.delete(id);

  if (!transaction || transaction.expiresAt <= Date.now()) {
    return null;
  }
  return transaction;
}

function safeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function inspectIdToken(idToken, { issuer, audience }) {
  if (typeof idToken !== "string") return null;

  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  const issuerOk = claims.iss === issuer || claims.iss === `https://${issuer}`;
  const audienceOk = Array.isArray(claims.aud)
    ? claims.aud.includes(audience)
    : claims.aud === audience;
  const notExpired =
    typeof claims.exp === "number" && claims.exp * 1000 > Date.now();

  if (!issuerOk || !audienceOk || !notExpired) {
    return null;
  }
  return claims;
}

module.exports = {
  createPkcePair,
  createTransaction,
  consumeTransaction,
  safeEquals,
  inspectIdToken,
  TRANSACTION_TTL_MS,
};
