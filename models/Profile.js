const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    goals: {
      type: [String],
      default: [],
    },
    steamDomains: {
      type: [String],
      enum: ["technology", "engineering", "arts", "mathematics", "science"],
      default: [],
    },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    timeAvailability: {
      type: String,
      enum: ["less_than_2hrs", "2_to_5hrs", "more_than_5hrs"],
      default: "2_to_5hrs",
    },
    internetAccess: {
      type: String,
      enum: ["low", "moderate", "high"],
      default: "moderate",
    },
    learningPace: {
      type: String,
      enum: ["slow", "moderate", "fast"],
      default: "moderate",
    },
    preferredLanguage: {
      type: String,
      default: "English",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);