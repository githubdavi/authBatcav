const express = require("express");
const app = express();
const port = 3000;

require("dotenv").config();
require("./config/db");

const authRoutes = require("./routes/auth");
const batcomputerRoutes = require("./routes/batcomputer");
const session = require("express-session");

app.use(
  session({
    name: "bat_identity",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 1800000,
    },
  }),
);
app.use(express.json());
app.use(express.static("public"));

app.use(authRoutes);
app.use(batcomputerRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
