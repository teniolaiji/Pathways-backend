const express = require("express");
const {
  registerUser, verifyEmail, loginUser,
  resendVerification, forgotPassword, resetPassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register",             registerUser);
router.get ("/verify-email",         verifyEmail);
router.post("/login",                loginUser);
router.post("/resend-verification",  resendVerification);
router.post("/forgot-password",      forgotPassword);
router.post("/reset-password",       resetPassword);

module.exports = router;