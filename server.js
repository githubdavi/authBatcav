const express = require("express");
const bcrypt = require("bcrypt");
const app = express();
const port = 3000;
const Database = require("better-sqlite3");
const db = new Database("bdd.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    time_connection DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT OR IGNORE INTO users (username, password, role)
VALUES ('admin', '$2b$12$Cyc1Sw7dhqGepUEib6y2QOnm44J/ZudiKQiVo.xkDPRpu3UQer62y', 'ADMIN');
`);

module.exports = db;
app.use(express.json());
app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

app.post("/register", async (req, res) => {
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

app.post("/logout", (req, res) => {
  res
    .set("WWW-Authenticate", 'Basic realm="Accès restreint"')
    .status(401)
    .send("Déconnecté.");
});

app.post("/api/reports", basicAuthCheck, (req, res) => {
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

app.get("/api/me", basicAuthCheck, (req, res) => {
  const user = req.user;
  res.json({ id: user.id, name: user.username });
});

app.get("/bat-computer", basicAuthCheck, (req, res) => {
  res.sendFile(__dirname + "/private/bat-computer.html");
});

app.get("/api/secrets", basicAuthCheck, (req, res) => {
  res.json([
    { name: "Batarang", desc: "Arme de jet", icon: "fa-shuriken" },
    { name: "Grappin", desc: "Système d'accrochage", icon: "fa-hooks" },
    { name: "Bombe fumigène", desc: "Cache-fumée", icon: "fa-smog" },
  ]);
});

function basicAuthCheck(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res
      .set("WWW-Authenticate", 'Basic realm="Accès restreint"')
      .status(401)
      .send("Authentification requise.");
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const [username, password] = decoded.split(":");

  const sql = db.prepare("SELECT * FROM users WHERE username = ?");
  const user = sql.get(username.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res
      .set("WWW-Authenticate", 'Basic realm="Accès restreint"')
      .status(401)
      .send("Identifiants invalides.");
  }
  if (user.role != "ADMIN") {
    return res
      .set("WWW-Authenticate", 'Basic realm="Accès restreint"')
      .status(403)
      .send("Accès refusé");
  }
  insertLog(user.username, user.id);
  req.user = { id: user.id, username: user.username };
  next();
}

function insertLog(username, id) {
  const sql = db.prepare("INSERT INTO logs (username, user_id) VALUES (?, ?)");
  sql.run(username, id);
}
