const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const upsertStatement = db.prepare(`
  INSERT INTO users (username, provider, provider_user_id, email, display_name, role)
  VALUES (@username, @provider, @providerUserId, @email, @displayName, 'USER')
  ON CONFLICT (provider, provider_user_id) DO UPDATE SET
    email        = COALESCE(excluded.email, users.email),
    display_name = COALESCE(excluded.display_name, users.display_name)
`);

const selectFederatedUser = db.prepare(
  "SELECT * FROM users WHERE provider = ? AND provider_user_id = ?",
);

function upsertFederatedUser({ provider, providerUserId, email, displayName }) {
  if (!provider || !providerUserId) {
    throw new Error("Identité fédérée incomplète (provider / provider_user_id).");
  }

  upsertStatement.run({
    username: `${provider}:${providerUserId}`,
    provider,
    providerUserId: String(providerUserId),
    email: email ?? null,
    displayName: displayName ?? null,
  });

  return selectFederatedUser.get(provider, String(providerUserId));
}

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function issueSession(res, user) {
  const accessToken = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      provider: user.provider,
      email: user.email,
      name: user.display_name || user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = crypto.randomBytes(40).toString("hex");
  db.prepare(
    "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(
    refreshToken,
    user.id,
    new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  );

  res.cookie("JWT", accessToken, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

module.exports = { upsertFederatedUser, issueSession };
