require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRouter = require("./routes/api");
const liveRouter = require("./routes/live");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
}));

// Express json & urlencoded parser with 50mb limit and rawBody preservation for Razorpay X-Razorpay-Signature HMAC verification
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

// Serve public static files (e.g. test-checkout.html)
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes (support both /api/* and stripped /* rewrites on Vercel)
app.use("/api/live", liveRouter);
app.use("/api", apiRouter);
app.use("/live", liveRouter);
app.use("/", apiRouter);

// Serve built React frontend static files from frontend/dist
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));

// Express Error Handling Middleware to ensure API responses are always valid JSON
app.use((err, req, res, next) => {
  if (err) {
    console.error("Express Error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "An unexpected error occurred on the server.",
    });
  }
  next();
});

// Fallback to React index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RefundGuard unified application running on http://localhost:${PORT}`);
  });
}

module.exports = app;
