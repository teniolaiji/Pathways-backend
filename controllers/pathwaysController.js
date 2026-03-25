const Assessment = require("../models/Assessment");
const LearningPathway = require("../models/LearningPathway");
const { generateLearningPathway } = require("../services/aiService");
const { validateResourceUrl } = require("../services/personalizationEngine");

/**
 * Validates all resources in the AI result before saving to the database.
 * Runs all URL checks concurrently for speed.
 * Resources that fail the check are marked isValidated: false so the
 * frontend can warn the user or hide them.
 *
 * @param {Array} modules - The modules array from the AI response
 * @returns {Array}       - Modules with isValidated set on each resource
 */
const validateModuleResources = async (modules) => {
  const validated = await Promise.all(
    modules.map(async (mod) => {
      const validatedResources = await Promise.all(
        (mod.resources || []).map(async (resource) => {
          const isValid = await validateResourceUrl(resource.url);
          return { ...resource, isValidated: isValid };
        })
      );
      return { ...mod, resources: validatedResources };
    })
  );
  return validated;
};

/**
 * POST /api/pathway/generate/:assessmentId
 * Generates a personalised AI learning pathway and validates
 * all resource URLs before saving to the database.
 */
const generatePathway = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    // Confirm the assessment exists and belongs to this user
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      user: req.user.id,
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found." });
    }

    // Generate pathway from AI
    const aiResult = await generateLearningPathway(assessment);

    // Validate all resource URLs concurrently before saving
    // This adds ~3-5 seconds but ensures users only see working links
    console.log("[Pathway] Validating resource URLs...");
    const validatedModules = await validateModuleResources(aiResult.modules);

    const validCount = validatedModules
      .flatMap((m) => m.resources)
      .filter((r) => r.isValidated).length;
    const totalCount = validatedModules.flatMap((m) => m.resources).length;
    console.log(`[Pathway] ${validCount}/${totalCount} resources validated.`);

    // Save the pathway with validation results
    const pathway = await LearningPathway.create({
      user: req.user.id,
      assessment: assessment._id,
      title: aiResult.title,
      summary: aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules: validatedModules,
    });

    res.status(201).json({
      message: "Pathway generated successfully.",
      resourceValidation: { valid: validCount, total: totalCount },
      pathway,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(502).json({
        message: "AI returned an unexpected response. Please try again.",
      });
    }

    if (
      error.message?.includes("busy") ||
      error.message?.includes("quota") ||
      error.message?.includes("429") ||
      error.message?.includes("RATE_LIMIT")
    ) {
      return res.status(429).json({
        message:
          "The AI service is currently busy. Please wait 1 minute and try again.",
        retryAfterSeconds: 60,
      });
    }

    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/pathway
 * Returns all pathways for the authenticated user, newest first.
 */
const getUserPathways = async (req, res) => {
  try {
    const pathways = await LearningPathway.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate("assessment", "domain subfield skillLevel goals");

    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/pathway/:pathwayId
 * Returns a single pathway with its full assessment data.
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