const express = require("express");
const path = require("path");
const db = require("../config/db");
const { basicAuthCheck, checkJWT } = require("../middlewares/checkAuth");

const router = express.Router();

router.post("/api/reports", basicAuthCheck, (req, res) => {
  const report = req.body;
  if (!report.title || !report.description) {
    return res.status(400).send("Missing title or description");
  }
  const sql = db.prepare(
    "INSERT INTO reports (user_id, title, description) VALUES (?, ?, ?)",
  );
  sql.run(req.user.id, report.title, report.description);
  res.status(201).send("Report created successfully");
});

// ROUTE GET

router.get("/api/me", checkJWT, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    name: user.name || user.username,
    role: user.role,
    email: user.email ?? null,
    provider: user.provider || "local",
  });
});

router.get("/bat-computer", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "bat-computer.html"));
});

router.get("/api/secrets", checkJWT, (req, res) => {
  res.json([
    { name: "Batarang", desc: "Arme de jet", icon: "fa-shuriken" },
    { name: "Grappin", desc: "Système d'accrochage", icon: "fa-hooks" },
    { name: "Bombe fumigène", desc: "Cache-fumée", icon: "fa-smog" },
  ]);
});

module.exports = router;
