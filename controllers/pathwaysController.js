const Assessment = require("../models/Assessment");
const LearningPathway = require("../models/LearningPathway");
const { generateLearningPathway } = require("../services/aiService");

/**
 * POST /api/pathway/generate/:assessmentId
 * Generate a personalised AI learning pathway from a submitted assessment.
 */
const generatePathway = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    // Find the assessment and verify it belongs to this user
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      user: req.user.id,
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found." });
    }

    // Call the AI service
    const aiResult = await generateLearningPathway(assessment);

    // Save the generated pathway to the database
    const pathway = await LearningPathway.create({
      user: req.user.id,
      assessment: assessment._id,
      title: aiResult.title,
      summary: aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules: aiResult.modules,
    });

    res.status(201).json({
      message: "Pathway generated successfully.",
      pathway,
    });
  } catch (error) {
    // Handle JSON parse errors from the AI response gracefully
    if (error instanceof SyntaxError) {
      return res.status(502).json({
        message: "AI returned an unexpected response. Please try again.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/pathway
 * Get all pathways for the authenticated user.
 */
const getUserPathways = async (req, res) => {
  try {
    const pathways = await LearningPathway.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate("assessment", "skillLevel selectedDomains goals");

    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/pathway/:pathwayId
 * Get a single pathway by ID.
 */
const getPathwayById = async (req, res) => {
  try {
    const pathway = await LearningPathway.findOne({
      _id: req.params.pathwayId,
      user: req.user.id,
    }).populate("assessment");

    if (!pathway) {
      return res.status(404).json({ message: "Pathway not found." });
    }

    res.json(pathway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generatePathway, getUserPathways, getPathwayById };