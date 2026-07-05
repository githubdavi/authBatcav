const bcrypt = require("bcrypt");
const db = require("../config/db");

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

function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  req.user = req.session.user;
  next();
}

function insertLog(username, id) {
  const sql = db.prepare("INSERT INTO logs (username, user_id) VALUES (?, ?)");
  sql.run(username, id);
}

module.exports = { basicAuthCheck, isAuthenticated };
