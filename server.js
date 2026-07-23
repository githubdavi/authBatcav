require("dotenv").config();

const express = require("express");
const app = express();
const port = 3000;
const helmet = require("helmet");

require("./config/db");

const authRoutes = require("./routes/auth");
const oauthRoutes = require("./routes/oauth");
const batcomputerRoutes = require("./routes/batcomputer");
const cookieParser = require("cookie-parser");

app.use(
  helmet({
    strictTransportSecurity: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => res.redirect("/login.html"));

app.use(authRoutes);
app.use(oauthRoutes);
app.use(batcomputerRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
