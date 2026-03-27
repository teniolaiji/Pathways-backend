const express = require("express");
const {
  generatePathway,
  regeneratePathway,
  getUserPathways,
  getPathwayById,
  getPathwayFeedbackAnalytics,
} = require("../controllers/pathwaysController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/generate/:assessmentId",           protect, generatePathway);
router.post("/:pathwayId/regenerate",            protect, regeneratePathway);
router.get  ("/",                                protect, getUserPathways);
router.get  ("/:pathwayId",                      protect, getPathwayById);
router.get  ("/:pathwayId/feedback-analytics",   protect, getPathwayFeedbackAnalytics);

module.exports = router;