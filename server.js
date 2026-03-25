// ── Load environment variables FIRST ─────────────────────────────
const dotenv = require("dotenv");
dotenv.config();

const express      = require("express");
const cors         = require("cors");
const connectDB    = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const protect      = require("./middleware/authMiddleware");

// ── Route imports ─────────────────────────────────────────────────
const authRoutes       = require("./routes/authRoutes");
const profileRoutes    = require("./routes/profileRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const pathwayRoutes    = require("./routes/pathwayRoutes");
const progressRoutes   = require("./routes/progressRoutes");

// ── Connect to MongoDB ────────────────────────────────────────────
connectDB();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────
// Add your Netlify URL to FRONTEND_URL in your .env after deploying
// e.g. FRONTEND_URL=https://pathways-app.netlify.app
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean); // removes undefined if FRONTEND_URL not set yet

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Core middleware ───────────────────────────────────────────────
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Pathways API is running." });
});

// ── API Routes ────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/profile",    profileRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/pathway",    pathwayRoutes);
app.use("/api/progress",   progressRoutes);

// ── Protected route test ──────────────────────────────────────────
app.get("/api/protected", protect, (req, res) => {
  res.json({ message: "You accessed a protected route", user: req.user });
});

// ── Global error handler — must be last ───────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;