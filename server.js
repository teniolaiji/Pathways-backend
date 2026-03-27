const dotenv = require("dotenv");
dotenv.config();

const express      = require("express");
const cors         = require("cors");
const connectDB    = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const { protect }  = require("./middleware/authMiddleware");

const authRoutes         = require("./routes/authRoutes");
const profileRoutes      = require("./routes/profileRoutes");
const assessmentRoutes   = require("./routes/assessmentRoutes");
const pathwayRoutes      = require("./routes/pathwayRoutes");
const progressRoutes     = require("./routes/progressRoutes");
const adminRoutes        = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

app.get("/", (req, res) => res.json({ message: "Pathways API is running." }));

app.use("/api/auth",          authRoutes);
app.use("/api/profile",       profileRoutes);
app.use("/api/assessment",    assessmentRoutes);
app.use("/api/pathway",       pathwayRoutes);
app.use("/api/progress",      progressRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/protected", protect, (req, res) => {
  res.json({ message: "You accessed a protected route", user: req.user });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;