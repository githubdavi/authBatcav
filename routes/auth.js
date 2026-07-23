const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { checkJWT } = require("../middlewares/checkAuth");
const { authenticator } = require("@otplib/preset-v11");
const qrcode = require("qrcode");

const router = express.Router();

router.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "register.html"));
});

router.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "login.html"));
});

router.get("/setup-2fa.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "setup-2fa.html"));
});

router.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }
  if (password.length < 8) {
    return res.status(400).send("Password must be at least 8 characters long");
  }
  const existingUser = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim().toLowerCase());
  if (existingUser) {
    return res.status(409).send("Username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(
    username.trim().toLowerCase(),
    passwordHash,
  );
  res.status(201).send("User registered successfully");
});

// ROUTE POST

router.post("/logout", (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);
  }

  res.clearCookie("JWT");
  res.clearCookie("refreshToken");
  res.redirect("/login.html");
});

const crypto = require("crypto");

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username?.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ erreur: "Identifiants incorrects" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    db.prepare(
      "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
    ).run(refreshToken, user.id, expiresAt);

    res.cookie("JWT", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 900000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("/bat-computer");
  } catch (error) {
    res.status(500).send("Erreur lors de la connexion.");
  }
});

router.post("/api/auth/refresh", (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ erreur: "Accès refusé" });

  const storedToken = db
    .prepare("SELECT * FROM refresh_tokens WHERE token = ?")
    .get(refreshToken);

  if (!storedToken || new Date() > new Date(storedToken?.expires_at)) {
    return res
      .status(401)
      .json({ erreur: "Session expirée, reconnectez-vous" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(storedToken.user_id);
  const newToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  res.cookie("JWT", newToken, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 900000,
  });
  res.json({ message: "Jeton d'accès rafraîchi." });
});

router.post("/api/auth/change-password", checkJWT, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ erreur: "Champs manquants." });
  }
  const passwordPolicy =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
  if (!passwordPolicy.test(newPassword)) {
    return res.status(400).json({
      erreur:
        "Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.",
    });
  }
  if (currentPassword === newPassword) {
    return res
      .status(400)
      .json({ erreur: "Ancien et nouveau mot de passe identiques." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ erreur: "Mot de passe actuel incorrect." });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
    newPasswordHash,
    req.user.id,
  );
  res.json({ message: "Mot de passe changé avec succès." });
});

router.post("/enable-2fa", checkJWT, async (req, res) => {
  const { username } = req.user;
  const secret = authenticator.generateSecret();

  const otpauth = authenticator.keyuri(username, "Batcave", secret);

  db.prepare("UPDATE users SET two_factor_secret = ? WHERE username = ?").run(
    secret,
    username,
  );

  const qrCodeImage = await qrcode.toDataURL(otpauth);

  res.json({ qrCode: qrCodeImage, secret: secret });
});

router.post("/verify-2fa", checkJWT, async (req, res) => {
  const { token } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || !user.two_factor_secret) {
    return res.status(400).json({ erreur: "La 2FA n'est pas activée." });
  }

  const isValid = authenticator.verify({
    token,
    secret: user.two_factor_secret,
  });

  if (!isValid) {
    return res.status(401).json({ erreur: "Token invalide." });
  }

  db.prepare("UPDATE users SET two_factor_enabled = 1 WHERE id = ?").run(
    user.id,
  );

  res.json({ message: "2FA activée avec succès." });
});

module.exports = router;
