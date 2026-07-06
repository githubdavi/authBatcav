const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const router = express.Router();

router.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "register.html"));
});

router.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "login.html"));
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
    username,
    passwordHash,
  );
  res.status(201).send("User registered successfully");
});

// ROUTE POST

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Erreur lors de la déconnexion.");
    }
    res.clearCookie("bat_identity");
    res.redirect("/login.html");
  });
});

router.post("/auth/login", (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(req.body.username);
  if (!user) {
    return res.status(401).send("Authentification ratée.");
  }
  const isPasswordValid = bcrypt.compareSync(req.body.password, user.password);
  if (!isPasswordValid) {
    return res.status(401).send("Authentification ratée.");
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).send("Erreur lors de la connexion.");
    }
    req.session.user = user;
    req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .send("Erreur lors de la sauvegarde de la session.");
      }
      res.redirect("/bat-computer");
    });
  });
});

module.exports = router;
