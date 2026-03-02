const Assessment = require("../models/Assessment");
const Profile = require("../models/Profile");

const STEAM_SUBFIELDS = {
  science: [
    "biology", "chemistry", "physics", "environmental_science",
    "neuroscience", "biotechnology", "astronomy",
  ],
  technology: [
    "web_development", "mobile_development", "data_science", "machine_learning",
    "cybersecurity", "cloud_computing", "devops", "ui_ux_design",
    "blockchain", "embedded_systems",
  ],
  engineering: [
    "software_engineering", "electrical_engineering", "mechanical_engineering",
    "civil_engineering", "chemical_engineering", "biomedical_engineering",
    "systems_engineering",
  ],
  mathematics: [
    "statistics", "data_analytics", "applied_mathematics",
    "financial_mathematics", "operations_research", "cryptography",
  ],
};

/**
 * POST /api/assessment
 * Submit a new assessment. Validates that the subfield belongs
 * to the chosen domain before saving.
 */
const submitAssessment = async (req, res) => {
  try {
    const { skillLevel, domain, subfield, goals, constraints } = req.body;

    // Required field check
    if (!skillLevel || !domain || !subfield || !goals) {
      return res.status(400).json({
        message: "skillLevel, domain, subfield, and goals are all required.",
      });
    }

    // Validate domain
    if (!STEAM_SUBFIELDS[domain]) {
      return res.status(400).json({
        message: `Invalid domain "${domain}". Must be one of: ${Object.keys(STEAM_SUBFIELDS).join(", ")}`,
      });
    }

    // Validate that the subfield belongs to the chosen domain
    if (!STEAM_SUBFIELDS[domain].includes(subfield)) {
      return res.status(400).json({
        message: `"${subfield}" is not a valid subfield for domain "${domain}". Valid options: ${STEAM_SUBFIELDS[domain].join(", ")}`,
      });
    }

    // Save assessment
    const assessment = await Assessment.create({
      user: req.user.id,
      skillLevel,
      domain,
      subfield,
      goals,
      constraints: constraints || {},
    });

    // Keep the user's profile in sync with latest assessment data
    await Profile.findOneAndUpdate(
      { user: req.user.id },
      {
        skillLevel,
        steamDomains: [domain],
        goals: goals.split(",").map((g) => g.trim()),
        ...(constraints && {
          timeAvailability: constraints.timeAvailability,
          internetAccess: constraints.internetAccess,
          learningPace: constraints.learningPace,
          preferredLanguage: constraints.preferredLanguage,
        }),
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      message: "Assessment submitted successfully.",
      assessmentId: assessment._id,
      assessment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/assessment
 * Retrieve all assessments for the authenticated user.
 */
const getUserAssessments = async (req, res) => {
  try {
    const assessments = await Assessment.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/assessment/subfields
 * Returns the full subfield map so the frontend can
 * dynamically populate domain → subfield dropdowns.
 */
const getSubfields = (req, res) => {
  res.json(STEAM_SUBFIELDS);
};

module.exports = { submitAssessment, getUserAssessments, getSubfields };