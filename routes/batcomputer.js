const express = require("express");
const path = require("path");
const db = require("../config/db");
const { basicAuthCheck, isAuthenticated } = require("../middlewares/checkAuth");

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

router.get("/api/me", isAuthenticated, (req, res) => {
  const user = req.user;
  res.json({ id: user.id, name: user.username });
});

router.get("/bat-computer", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "bat-computer.html"));
});

router.get("/api/secrets", isAuthenticated, (req, res) => {
  res.json([
    { name: "Batarang", desc: "Arme de jet", icon: "fa-shuriken" },
    { name: "Grappin", desc: "Système d'accrochage", icon: "fa-hooks" },
    { name: "Bombe fumigène", desc: "Cache-fumée", icon: "fa-smog" },
  ]);
});

module.exports = router;
