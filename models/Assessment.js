const mongoose = require("mongoose");

const STEAM_SUBFIELDS = {
  science: [
    "biology",
    "chemistry",
    "physics",
    "environmental_science",
    "neuroscience",
    "biotechnology",
    "astronomy",
  ],
  technology: [
    "web_development",
    "mobile_development",
    "data_science",
    "machine_learning",
    "cybersecurity",
    "cloud_computing",
    "devops",
    "ui_ux_design",
    "blockchain",
    "embedded_systems",
  ],
  engineering: [
    "software_engineering",
    "electrical_engineering",
    "mechanical_engineering",
    "civil_engineering",
    "chemical_engineering",
    "biomedical_engineering",
    "systems_engineering",
  ],
  mathematics: [
    "statistics",
    "data_analytics",
    "applied_mathematics",
    "financial_mathematics",
    "operations_research",
    "cryptography",
  ],
};

const assessmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    // Top-level domain (technology, engineering, science, mathematics)
    domain: {
      type: String,
      enum: ["technology", "engineering", "science", "mathematics"],
      required: true,
    },
    subfield: {
      type: String,
      required: true,
    },
    goals: {
      type: String,
      required: true,
    },
    constraints: {
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
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);


assessmentSchema.statics.STEAM_SUBFIELDS = STEAM_SUBFIELDS;

module.exports = mongoose.model("Assessment", assessmentSchema);