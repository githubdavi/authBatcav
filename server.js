const express = require("express");
const bcrypt = require("bcrypt");
const app = express();
const port = 3000;
const Database = require("better-sqlite3");
const db = new Database("bdd.db");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`,
).run();
module.exports = db;
app.use(express.json());

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

app.post("/register", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  console.log("username", username);
  console.log("password", password);
  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }
  if (password.length < 8) {
    return res.status(400).send("Password must be at least 8 characters long");
  }
  const existingUser = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  if (existingUser) {
    return res.status(400).send("Username already exists");
  }

  const passwordHash = bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(
    username,
    passwordHash,
  );
  res.status(201).send("User registered successfully");
});
