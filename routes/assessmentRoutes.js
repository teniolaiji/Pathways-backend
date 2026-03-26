const express = require("express");
const {
  submitAssessment,
  getUserAssessments,
  getSubfields,
} = require("../controllers/assessmentController");
const protect = require("../middleware/authMiddleware");

const { protect } = require("../middleware/authMiddleware");


// Public — frontend calls this to populate domain/subfield dropdowns
router.get("/subfields", getSubfields);

// Protected — requires JWT
router.post("/", protect, submitAssessment);
router.get("/", protect, getUserAssessments);

module.exports = router;