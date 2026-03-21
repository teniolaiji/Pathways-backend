const express = require("express");
const {
  generatePathway,
  getUserPathways,
  getPathwayById,
} = require("../controllers/pathwaysController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// All pathway routes require authentication
router.post("/generate/:assessmentId", protect, generatePathway);
router.get("/", protect, getUserPathways);
router.get("/:pathwayId", protect, getPathwayById);

module.exports = router;