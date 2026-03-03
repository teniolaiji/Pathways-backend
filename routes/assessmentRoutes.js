const express = require("express");
const {
  submitAssessment,
  getUserAssessments,
  getSubfields,
} = require("../controllers/assessmentController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();


router.get("/subfields", getSubfields);
router.post("/", protect, submitAssessment);
router.get("/", protect, getUserAssessments);

module.exports = router;