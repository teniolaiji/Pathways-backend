const mongoose = require("mongoose");

// ── Badge sub-schema ────────────────────────────────────────────
const badgeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  awardedAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Completed module sub-schema ─────────────────────────────────
const completedModuleSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  moduleTitle: {
    type: String,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  // Optional feedback the user gives after finishing a module
  feedback: {
    difficulty: {
      type: String,
      enum: ["too_easy", "just_right", "too_hard"],
    },
    relevance: {
      type: String,
      enum: ["not_relevant", "somewhat_relevant", "very_relevant"],
    },
    comment: {
      type: String,
      maxlength: 500,
    },
  },
});

// ── Main progress schema ────────────────────────────────────────
const progressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pathway: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LearningPathway",
      required: true,
    },
    completedModules: [completedModuleSchema],
    earnedBadges: [badgeSchema],

    // Percentage 0–100, recalculated on every module completion
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Updated every time the user interacts with the pathway
    lastActive: {
      type: Date,
      default: Date.now,
    },

    // Full log of all feedback submissions for future analysis
    feedbackLog: [
      {
        moduleId: mongoose.Schema.Types.ObjectId,
        moduleTitle: String,
        feedback: Object,
        loggedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Ensure one progress record per user per pathway
progressSchema.index({ user: 1, pathway: 1 }, { unique: true });

module.exports = mongoose.model("Progress", progressSchema);