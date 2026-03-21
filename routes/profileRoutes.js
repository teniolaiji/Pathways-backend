const express = require("express");
const {
  markModuleComplete,
  getProgress,
  getAllProgress,
  flagResource,
  triggerResourceValidation,
} = require("../controllers/progressController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// GET  /api/progress              — all progress summaries for the logged-in user
router.get("/", protect, getAllProgress);

// GET  /api/progress/:pathwayId   — progress for one specific pathway
router.get("/:pathwayId", protect, getProgress);

// POST /api/progress/complete/:pathwayId/:moduleId — mark a module as done
router.post("/complete/:pathwayId/:moduleId", protect, markModuleComplete);

// POST /api/progress/flag/:pathwayId/:moduleId/:resourceId — flag a bad resource
router.post("/flag/:pathwayId/:moduleId/:resourceId", protect, flagResource);

// POST /api/progress/validate/:pathwayId — validate all resource URLs
router.post("/validate/:pathwayId", protect, triggerResourceValidation);

module.exports = router;