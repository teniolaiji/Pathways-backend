const crypto = require("crypto");
const User   = require("../models/User");
const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

const generateToken = () => crypto.randomBytes(32).toString("hex");
const signJWT = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email and password are required." });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "User already exists." });

    const salt = await bcrypt.genSalt(10);
    const verificationToken  = generateToken();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      name, email,
      password: await bcrypt.hash(password, salt),
      verificationToken,
      verificationTokenExpiry: verificationExpiry,
    });

    try { await sendVerificationEmail(email, name, verificationToken); }
    catch (e) { console.error("[Auth] Verification email failed:", e.message); }

    res.status(201).json({
      message: "Account created. Please check your email to verify your account.",
      _id: user._id, name: user.name, email: user.email,
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// GET /api/auth/verify-email?token=...
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token required." });

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired link." });

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    res.json({ message: "Email verified. You can now log in." });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials." });

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        resendAvailable: true,
      });
    }

    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ message: "Invalid credentials." });

    res.json({
      token: signJWT(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    const generic = { message: "If registered, a verification link has been sent." };

    if (!user || user.isVerified) return res.json(generic);

    user.verificationToken       = generateToken();
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await sendVerificationEmail(user.email, user.name, user.verificationToken);

    res.json(generic);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const generic = { message: "If registered, a password reset link has been sent." };
    const user = await User.findOne({ email });
    if (!user) return res.json(generic);

    user.resetPasswordToken  = generateToken();
    user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendPasswordResetEmail(user.email, user.name, user.resetPasswordToken);

    res.json(generic);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ message: "Token and password required." });
    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters." });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired reset link." });

    const salt = await bcrypt.genSalt(10);
    user.password            = await bcrypt.hash(password, salt);
    user.resetPasswordToken  = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = {
  registerUser, verifyEmail, loginUser,
  resendVerification, forgotPassword, resetPassword,
};