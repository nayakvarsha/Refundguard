require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRouter = require("./routes/api");
const liveRouter = require("./routes/live");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Express json parser with rawBody preservation for Razorpay X-Razorpay-Signature HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Serve public static files (e.g. test-checkout.html)
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes
app.use("/api/live", liveRouter);
app.use("/api", apiRouter);

// Serve built React frontend static files from frontend/dist
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));

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
