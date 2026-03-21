const express = require("express");
const { getProfile, updateProfile } = require("../controllers/profileController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);

module.exports = router;