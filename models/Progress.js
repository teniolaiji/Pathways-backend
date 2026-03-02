const mongoose = require("mongoose");

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
    completedSteps: [String],
    leadershipScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Progress", progressSchema);