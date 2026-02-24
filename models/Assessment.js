const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    interests: [String],
    goals: String,
    skillLevel: String,
    constraints: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);