const crypto = require("crypto");

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || "v21.0";

function redirectUriFor(providerId) {
  return `${APP_BASE_URL}/auth/${providerId}/callback`;
}

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "batcave-oauth-client",
};

async function readJsonOrThrow(response, context) {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `${context} : HTTP ${response.status} - ${raw.slice(0, 200)}`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${context} : réponse non JSON - ${raw.slice(0, 200)}`);
  }
}

const providers = {
  google: {
    id: "google",
    label: "Google",
    isOidc: true,
    supportsPkce: true,
    tokenRequestMethod: "POST",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    issuer: "https://accounts.google.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    extraAuthorizationParams: {
      access_type: "online",
      prompt: "select_account",
    },

    async fetchProfile(tokens) {
      const response = await fetch(this.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await readJsonOrThrow(response, "Google userinfo");

      return {
        providerUserId: String(profile.sub),
        email: profile.email || null,
        displayName: profile.name || profile.email || `google-${profile.sub}`,
      };
    },
  },

  github: {
    id: "github",
    label: "GitHub",
    isOidc: false,
    supportsPkce: false,
    tokenRequestMethod: "POST",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userInfoEndpoint: "https://api.github.com/user",
    scope: "read:user user:email",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    extraAuthorizationParams: {},

    async fetchProfile(tokens) {
      const response = await fetch(this.userInfoEndpoint, {
        headers: {
          ...GITHUB_API_HEADERS,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const profile = await readJsonOrThrow(response, "GitHub /user");

      let email = profile.email || null;
      if (!email) {
        const emailsResponse = await fetch(
          "https://api.github.com/user/emails",
          {
            headers: {
              ...GITHUB_API_HEADERS,
              Authorization: `Bearer ${tokens.access_token}`,
            },
          },
        );
        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primary = Array.isArray(emails)
            ? emails.find((entry) => entry.primary && entry.verified)
            : null;
          email = primary?.email || null;
        }
      }

      return {
        providerUserId: String(profile.id),
        email,
        displayName: profile.name || profile.login || `github-${profile.id}`,
      };
    },
  },

  facebook: {
    id: "facebook",
    label: "Facebook",
    isOidc: false,
    supportsPkce: true,
    tokenRequestMethod: "GET",
    authorizationEndpoint: `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`,
    tokenEndpoint: `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`,
    userInfoEndpoint: `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me`,
    scope: "public_profile,email",
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    extraAuthorizationParams: {},

    async fetchProfile(tokens) {
      const appSecretProof = crypto
        .createHmac("sha256", this.clientSecret)
        .update(tokens.access_token)
        .digest("hex");

      const url = new URL(this.userInfoEndpoint);
      url.searchParams.set("fields", "id,name,email");
      url.searchParams.set("access_token", tokens.access_token);
      url.searchParams.set("appsecret_proof", appSecretProof);

      const response = await fetch(url);
      const profile = await readJsonOrThrow(response, "Facebook /me");

      return {
        providerUserId: String(profile.id),
        email: profile.email || null,
        displayName: profile.name || `facebook-${profile.id}`,
      };
    },
  },
};

function getProvider(providerId) {
  return Object.prototype.hasOwnProperty.call(providers, providerId)
    ? providers[providerId]
    : null;
}

function isProviderConfigured(provider) {
  return Boolean(provider?.clientId && provider?.clientSecret);
}

module.exports = {
  providers,
  getProvider,
  isProviderConfigured,
  redirectUriFor,
  APP_BASE_URL,
};
