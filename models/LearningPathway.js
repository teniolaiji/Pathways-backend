const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  format: {
    type: String,
    enum: ["video", "article", "exercise", "course"],
    default: "article",
  },
  source: { type: String },
  isFree: { type: Boolean, default: true },
  isValidated: { type: Boolean, default: false },
  flagCount: { type: Number, default: 0 },
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    default: "beginner",
  },
  estimatedHours: { type: Number, default: 1 },
  domain: { type: String },
  reason: { type: String }, // AI explanation for why this module is included
  resources: [resourceSchema],
  isCompleted: { type: Boolean, default: false },
});

const learningPathwaySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    title: { type: String, required: true },
    summary: { type: String },
    modules: [moduleSchema],
    aiExplanation: { type: String }, // overall AI reasoning
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningPathway", learningPathwaySchema);