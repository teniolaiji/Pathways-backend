const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["learner", "admin"], default: "learner" },

    // Email verification
    isVerified:              { type: Boolean, default: false },
    verificationToken:       { type: String,  default: null  },
    verificationTokenExpiry: { type: Date,    default: null  },

    // Password reset
    resetPasswordToken:  { type: String, default: null },
    resetPasswordExpiry: { type: Date,   default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);