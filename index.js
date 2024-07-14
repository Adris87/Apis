const https = require("https");
const osut = require("node-os-utils");
const fs = require("fs");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
// const servers = https.createServer(ssl, app);
const io = require("socket.io")(server);
// const ios = require("socket.io")(servers);
const session = require("express-session");
const MemoryStore = require('memorystore')(session);
const chalk = require("chalk");
const cookieParser = require("cookie-parser");
const expressLayout = require("express-ejs-layouts");
const passport = require("passport");
const flash = require("connect-flash");
const schedule = require("node-schedule");
// const redis = require('redis');
// const RedisStore = require("connect-redis").default;
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
// const redisClient = redis.createClient();
const dotenv = require("dotenv");
const {
  checkUsername,
  delUser,
  resetAllLimit,
  resetTodayReq,
} = require("./database/db");
const {
  SitemapStream,
  streamToPromise
} = require("sitemap");
const {
  createGzip
} = require("zlib");
const {
  Readable
} = require("stream");
const apiRouters = require("./routes/api");
const userRouters = require("./routes/users");
const adminRouters = require("./routes/admin");
const premiumRouters = require("./routes/premium");
const path = require("path");
const {
  connectMongoDb
} = require("./database/connect");
const {
  own,
  port
} = require("./lib/settings");
const {
  ignoreFavicon
} = require("./lib/functions");
const {
  ExpiredTime,
  getTotalReq,
  getTodayReq,
  getVisitor,
  getTotalUser,
  addRequest,
  addVisitor
} = require("./database/premium");

PORT = process.env.PORT || port;
dotenv.config();
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 6e4,
  max: 5e3,
  message: "Oops too many requests",
});
let AntiSPAM = rateLimit({
  windowMs: 1500,
  max: 15,
  keyGenerator: function (e, r) {
    return e.ip;
  },
  message: "Too Many Requests!!!",
});
function formatSizeUnits(bytes) {
  if (bytes >= 1073741824) {
    bytes = (bytes / 1073741824).toFixed(2) + " GB";
  } else if (bytes >= 1048576) {
    bytes = (bytes / 1048576).toFixed(2) + " MB";
  } else if (bytes >= 1024) {
    bytes = (bytes / 1024).toFixed(2) + " KB";
  } else if (bytes > 1) {
    bytes = bytes + " bytes";
  } else if (bytes == 1) {
    bytes = bytes + " byte";
  } else {
    bytes = "0 bytes";
  }
  return bytes;
}
app.use(limiter),
app.set("view engine", "ejs"),

app.use(expressLayout);
app.use(express.static("public"));
app.use(morgan(function (e, r, s) {
  return [
    r.ip,
    e.method(r, s),
    e.url(r, s),
    200 == e.status(r, s)
    ? chalk.green(e.status(r, s)): chalk.cyan(e.status(r, s)),
    e["response-time"](r, s) + " ms",
    e.res(r, s, "content-length"),
  ].join(" | ");
}));
app.use(ignoreFavicon);
app.use(express.static(path.join(__dirname, "hasil")));
app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 864e5
  },
  store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    })
}));
app.use(express.urlencoded({
  extended: true
}));

app.use(express.json()),
app.use(cookieParser()),
app.use(function (e, r, s, a) {
  console.error(e.stack),
  s.status(500).sendFile(__dirname + "/public/500.html");
}),

app.use(express.json());
app.use(cookieParser());
app.use(function (e, r, s, a) {
  console.error(e.stack);
  s.status(500).sendFile(__dirname + "/public/500.html");
});
app.use(passport.initialize());
app.use(passport.session());
require("./lib/config")(passport);
app.use(flash());
app.use(AntiSPAM);

function checkBot(req, res, next) {
  if (!req.user) {
    if (/(googlebot|bingbot|Slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|facebookexternalhit|telegram|whatsapp)/gi.test(req.headers["User-agent"])) return next();
    req.flash("error_msg", "Sebelum lanjut, login dulu ya kak");
    res.redirect("/users?ref="+req.path);
  } else next();
}

function getResetTime() {
  var now = new Date(); // waktu saat ini
  var year = now.getFullYear(); // tahun saat ini
  var month = now.getMonth(); // bulan saat ini
  var day = now.getDate(); // hari saat ini
  var night = new Date(year, month, day, 23, 59, 59); // waktu tengah malam hari ini
  var remainingTime = night.getTime() - now.getTime(); // waktu yang tersisa hingga tengah malam
  var hours = Math.floor(remainingTime / (1000 * 60 * 60)); // jumlah jam
  var minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60)); // jumlah menit
  var seconds = Math.floor((remainingTime % (1000 * 60)) / 1000); // jumlah detik
  
  // format waktu menjadi HH:MM:SS
  var formattedHours = ("0" + hours).slice(-2);
  var formattedMinutes = ("0" + minutes).slice(-2);
  var formattedSeconds = ("0" + seconds).slice(-2);
  
  return formattedHours + ":" + formattedMinutes + ":" + formattedSeconds;
}

io.on("connection", async () => {
  dt = {
    memoryUsage: formatSizeUnits(process.memoryUsage().rss),
    resetTime: getResetTime()
  };
  io.emit("status", dt);
});
setInterval(async () => {
  dt = {
    memoryUsage: formatSizeUnits(process.memoryUsage().rss),
    resetTime: getResetTime()
  };
  io.emit("status", dt);
}, 1000);

app.use(function (req, res, next) {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  res.locals.req = req;
  next();
});

app.use(function (req, res, next) {
  getTotalUser();
  addRequest();
  next();
});

app.all("/robots.txt", function (req, res, next) {
  res.type("text/plain");
  res.send(
    `User-agent: *\nAllow: /\nDisallow: /api\n\nSitemap: ${req.protocol}://${req.hostname}/sitemap.xml`
  );
});

app.all("/sitemap.xml", function (e, r) {
  try {
    r.header("Content-Type", "application/xml");
    r.header("Content-Encoding", "gzip");

    const s = new SitemapStream({
      hostname: e.protocol + "://" + e.hostname,
    });
    const a = s.pipe(createGzip());

    s.write({
      url: "/", changefreq: "daily", priority: 1
    });
    s.write({
      url: "/price", changefreq: "daily", priority: 0.9
    });
    s.write({
      url: "/contact", changefreq: "daily", priority: 0.9
    });
    s.write({
      url: "/users/register", changefreq: "daily", priority: 0.9
    });
    s.write({
      url: "/users/login", changefreq: "daily", priority: 0.9
    });
    s.write({
      url: "/users/lupapassword", changefreq: "daily", priority: 0.9
    });

    streamToPromise(a)
    .then((e) => {
      sitemap = e;
    });

    s.end();
    a.pipe(r).on("error", (e) => {
      throw e;
    });
  } catch (e) {
    console.error(e);
    r.status(500).end();
  }
});

app.get("/", checkBot, (req, res) => {
  res.redirect("/dashboard");
});

app.get("/dashboard", checkBot, async (e, r) => {
  const startTime = new Date();
  addVisitor();
  const totalReq = await getTotalReq();
  const todayReq = await getTodayReq();
  const visitorCount = await getVisitor();
  const userTotal = await getTotalUser();
  const requestTime = new Date() - startTime;

  r.render("index", {
    title: "Dashboard",
    ipadd: e.ip.replace("::ffff:", ""),
    total: totalReq,
    today: todayReq,
    resetTime: getResetTime(),
    visitor: visitorCount,
    rt: requestTime,
    userTotal: userTotal,
    limit: e.user && e.user.limit,
    username: e.user && e.user.username,
    apikey: e.user ? e.user.apikey: "APIKEY",
    premium: e.user && (e.user.premium !== null ? "yes": "free"),
    isOwner: e.user && own.includes(e.user.username),
    active_index: true,
    memUsage: formatSizeUnits(process.memoryUsage().rss),
    active_price: false,
    active_contact: false,
    active_tos: false,
    global: global,
    layout: "layouts/main",
  });
});

app.get("/contact", checkBot, (e, r) => {
  r.render("contact", {
    title: "Kontak",
    apikey: e.user ? e.user.apikey: "APIKEY",
    isOwner: !!e.user && own.includes(e.user.username),
    active_index: !1,
    active_price: !1,
    active_contact: !0,
    active_tos: !1,
    global: global,
    layout: "layouts/main",
  });
}),
app.get("/tos", checkBot, (req, res) => {
  res.render("tos", {
    title: "Terms Of Service",
    apikey: req.user ? req.user.apikey: "APIKEY",
    isOwner: !!req.user && own.includes(req.user.username),
    active_index: false,
    active_price: false,
    active_contact: false,
    active_tos: true,
    global: global,
    layout: "layouts/main",
  });
});

app.get("/price", checkBot, (req, res) => {
  res.render("price", {
    title: "Harga",
    apikey: req.user ? req.user.apikey: "APIKEY",
    isOwner: !!req.user && own.includes(req.user.username),
    active_index: false,
    active_price: true,
    active_contact: false,
    global: global,
    layout: "layouts/main",
  });
});

app.use(["/api"], apiRouters);
app.use("/users", userRouters);
app.use("/admin", adminRouters);
app.use("/premium", premiumRouters);
app.set("json spaces", 2);

app.use((e, r, s) => {
  r.status(404).sendFile(process.cwd() + "/public/404.html");
});

connectMongoDb().then(() => {
 // redisClient.connect().catch(console.error)
  server.listen(PORT, () => {
    console.log(
      chalk.green(`example app listening at http://localhost:${PORT}`)
    );
    schedule.scheduleJob("* * * * *", () => {
      ExpiredTime();
    });
    schedule.scheduleJob('0 0 * * *', function() {
      resetAllLimit();
      resetTodayReq();
      console.log("semua limit telah direset!")
    });
  });
});
