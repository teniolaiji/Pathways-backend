const mongoose = require("mongoose");

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
    },
    steps: [String],
    explanation: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningPathway", learningPathwaySchema);