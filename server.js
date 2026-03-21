// ── Load environment variables FIRST before anything else ────────
const dotenv = require("dotenv");
dotenv.config();

const express    = require("express");
const cors       = require("cors");
const connectDB  = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const protect    = require("./middleware/authMiddleware");

// ── Route imports ─────────────────────────────────────────────────
const authRoutes       = require("./routes/authRoutes");
const profileRoutes    = require("./routes/profileRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const pathwayRoutes    = require("./routes/pathwayRoutes");
const progressRoutes   = require("./routes/progressRoutes");

// ── Connect to MongoDB ────────────────────────────────────────────
connectDB();

const app = express();

// ── Core middleware ───────────────────────────────────────────────
app.use(cors());
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

// ── Protected route (used to verify JWT is working) ───────────────
app.get("/api/protected", protect, (req, res) => {
  res.json({ message: "You accessed a protected route", user: req.user });
});

// ── Global error handler — must be registered last ────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});