const Assessment    = require("../models/Assessment");
const LearningPathway = require("../models/LearningPathway");
const Progress      = require("../models/Progress");
const { generateLearningPathway, replacebrokenResources } = require("../services/aiService");
const { validateResourceUrl }     = require("../services/personalizationEngine");

// Validates all resources concurrently before saving
/**
 * Validates all resource URLs. For any that fail, asks the AI
 * to suggest working replacements. Retries each replacement once.
 */
const validateAndFixResources = async (modules, subfieldLabel, domainLabel) => {
  // Step 1 — validate all URLs concurrently
  const withValidation = await Promise.all(
    modules.map(async (mod) => ({
      ...mod,
      resources: await Promise.all(
        (mod.resources || []).map(async (r) => ({
          ...r,
          isValidated: await validateResourceUrl(r.url),
        }))
      ),
    }))
  );

  // Step 2 — collect all broken resources
  const broken = [];
  withValidation.forEach((mod) => {
    mod.resources.forEach((r) => {
      if (!r.isValidated) {
        broken.push({ ...r, _modId: mod._id || mod.title });
      }
    });
  });

  console.log(`[Pathway] ${withValidation.flatMap(m => m.resources).filter(r => r.isValidated).length} valid, ${broken.length} broken resources.`);

  // Step 3 — if there are broken resources, ask AI for replacements
  if (broken.length === 0) return withValidation;

  let replacements = [];
  try {
    console.log(`[Pathway] Requesting ${broken.length} replacement(s) from AI...`);
    replacements = await replacebrokenResources(broken, subfieldLabel, domainLabel);
    console.log(`[Pathway] Got ${replacements.length} replacement(s).`);
  } catch (e) {
    console.error("[Pathway] AI replacement failed:", e.message);
    // If replacement fails, keep broken resources but marked as unvalidated
    return withValidation;
  }

  // Step 4 — validate the replacement URLs
  const validatedReplacements = await Promise.all(
    replacements.map(async (r) => ({
      ...r,
      isValidated: await validateResourceUrl(r.url),
    }))
  );

  // Step 5 — swap broken resources with replacements
  let replacementIndex = 0;
  const fixed = withValidation.map((mod) => ({
    ...mod,
    resources: mod.resources.map((r) => {
      if (r.isValidated) return r; // keep working resources as-is
      // Replace with next available replacement
      const replacement = validatedReplacements[replacementIndex];
      replacementIndex++;
      if (replacement) {
        console.log(`[Pathway] Replaced "${r.title}" with "${replacement.title}"`);
        return replacement;
      }
      return r; // fallback: keep original if no replacement available
    }),
  }));

  return fixed;
};

// POST /api/pathway/generate/:assessmentId
const generatePathway = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      _id: req.params.assessmentId,
      user: req.user.id,
    });
    if (!assessment) return res.status(404).json({ message: "Assessment not found." });

  const aiResult = await generateLearningPathway(assessment);

// ── Sanitise AI response before saving ──────────────────────
    const validDifficulties = ["beginner", "intermediate", "advanced"];
    const validFormats      = ["video", "article", "exercise", "course"];

    const sanitiseDifficulty = (val) => {
      if (!val) return "beginner";
      const v = val.toLowerCase();
      if (validDifficulties.includes(v)) return v;
      if (v.includes("advanced"))        return "advanced";
      if (v.includes("intermediate"))    return "intermediate";
      if (v.includes("hard"))            return "advanced";
      if (v.includes("medium"))          return "intermediate";
      if (v.includes("moderate"))        return "intermediate";
      if (v.includes("easy"))            return "beginner";
      return "beginner";
    };

    const sanitiseFormat = (val) => {
      if (!val) return "article";
      const v = val.toLowerCase();
      if (validFormats.includes(v)) return v;
      const map = {
        web:"article", website:"article", tutorial:"article",
        blog:"article", book:"article", reading:"article", text:"article",
        podcast:"video", lecture:"video", talk:"video", webinar:"video",
        interactive:"exercise", project:"exercise", quiz:"exercise",
        practice:"exercise", assignment:"exercise", lab:"exercise",
        mooc:"course", certification:"course", program:"course",
      };
      return map[v] || "article";
    };

    aiResult.modules = aiResult.modules.map((mod) => ({
      ...mod,
      difficulty: sanitiseDifficulty(mod.difficulty),
      resources: (mod.resources || []).map((r) => ({
        ...r,
        format: sanitiseFormat(r.format),
      })),
    }));
    // ── End sanitisation ─────────────────────────────────────────

    const subfieldLabel = assessment.subfield?.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "";
    const domainLabel   = assessment.domain?.charAt(0).toUpperCase() + assessment.domain?.slice(1) || "";
    const validatedModules = await validateAndFixResources(aiResult.modules, subfieldLabel, domainLabel);

    const pathway = await LearningPathway.create({
      user:          req.user.id,
      assessment:    assessment._id,
      title:         aiResult.title,
      summary:       aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules:       validatedModules,
    });

    res.status(201).json({ message: "Pathway generated successfully.", pathway });
  } catch (error) {
    if (error instanceof SyntaxError)
      return res.status(502).json({ message: "AI returned an unexpected response. Please try again." });
    if (error.message?.includes("RATE_LIMIT") || error.message?.includes("busy"))
      return res.status(429).json({ message: "AI service is busy. Please wait 1 minute.", retryAfterSeconds: 60 });
    res.status(500).json({ message: error.message });
  }
};

// POST /api/pathway/:pathwayId/regenerate
// Regenerates AI pathway from the same assessment, archives the old one
const regeneratePathway = async (req, res) => {
  try {
    const oldPathway = await LearningPathway.findOne({
      _id:  req.params.pathwayId,
      user: req.user.id,
    });
    if (!oldPathway) return res.status(404).json({ message: "Pathway not found." });

    const assessment = await Assessment.findById(oldPathway.assessment);
    if (!assessment) return res.status(404).json({ message: "Assessment not found." });

    // Archive the old pathway before replacing it
    oldPathway.status = "archived";
    await oldPathway.save();

    const aiResult         = await generateLearningPathway(assessment);
    const subfieldLabel = assessment.subfield?.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "";
    const domainLabel   = assessment.domain?.charAt(0).toUpperCase() + assessment.domain?.slice(1) || "";
    const validatedModules = await validateAndFixResources(aiResult.modules, subfieldLabel, domainLabel);

    const newPathway = await LearningPathway.create({
      user:          req.user.id,
      assessment:    assessment._id,
      title:         aiResult.title,
      summary:       aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules:       validatedModules,
    });

    res.status(201).json({
      message:       "Pathway regenerated successfully. Your previous pathway has been archived.",
      oldPathwayId:  oldPathway._id,
      pathway:       newPathway,
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return res.status(502).json({ message: "AI returned an unexpected response. Please try again." });
    if (error.message?.includes("RATE_LIMIT") || error.message?.includes("busy"))
      return res.status(429).json({ message: "AI service is busy. Please wait 1 minute.", retryAfterSeconds: 60 });
    res.status(500).json({ message: error.message });
  }
};

// GET /api/pathway
const getUserPathways = async (req, res) => {
  try {
    const { status, domain, subfield, search } = req.query;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    let pathways = await LearningPathway.find(filter)
      .sort({ createdAt: -1 })
      .populate("assessment", "domain subfield skillLevel goals");

    // Filter by domain/subfield from the populated assessment
    if (domain) {
      pathways = pathways.filter((p) => p.assessment?.domain === domain);
    }
    if (subfield) {
      pathways = pathways.filter((p) => p.assessment?.subfield === subfield);
    }
    // Search by title or summary
    if (search) {
      const q = search.toLowerCase();
      pathways = pathways.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q)
      );
    }

    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/pathway/:pathwayId
const getPathwayById = async (req, res) => {
  try {
    const pathway = await LearningPathway.findOne({
      _id:  req.params.pathwayId,
      user: req.user.id,
    }).populate("assessment");

    if (!pathway) return res.status(404).json({ message: "Pathway not found." });
    res.json(pathway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/pathway/:pathwayId/feedback-analytics
// Returns aggregated feedback data for all modules in a pathway
const getPathwayFeedbackAnalytics = async (req, res) => {
  try {
    const pathway = await LearningPathway.findOne({
      _id:  req.params.pathwayId,
      user: req.user.id,
    });
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const progress = await Progress.findOne({
      user:    req.user.id,
      pathway: req.params.pathwayId,
    });

    if (!progress || progress.feedbackLog.length === 0) {
      return res.json({ message: "No feedback submitted yet.", analytics: [] });
    }

    // Build analytics per module
    const moduleMap = {};
    pathway.modules.forEach((mod) => {
      moduleMap[mod._id.toString()] = {
        moduleId:    mod._id,
        moduleTitle: mod.title,
        difficulty:  { too_easy: 0, just_right: 0, too_hard: 0 },
        relevance:   { not_relevant: 0, somewhat_relevant: 0, very_relevant: 0 },
        comments:    [],
        totalFeedback: 0,
      };
    });

    progress.feedbackLog.forEach((entry) => {
      const key = entry.moduleId?.toString();
      if (!key || !moduleMap[key]) return;

      // Only count entries that have actual feedback values
      const hasFeedback = entry.feedback?.difficulty || entry.feedback?.relevance;
      if (!hasFeedback) return;

      moduleMap[key].totalFeedback++;

      if (entry.feedback?.difficulty) {
        moduleMap[key].difficulty[entry.feedback.difficulty] =
          (moduleMap[key].difficulty[entry.feedback.difficulty] || 0) + 1;
      }
      if (entry.feedback?.relevance) {
        moduleMap[key].relevance[entry.feedback.relevance] =
          (moduleMap[key].relevance[entry.feedback.relevance] || 0) + 1;
      }
      if (entry.feedback?.comment) {
        moduleMap[key].comments.push(entry.feedback.comment);
      }
    });

    res.json({
      pathwayTitle: pathway.title,
      analytics:    Object.values(moduleMap).filter((m) => m.totalFeedback > 0),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generatePathway,
  regeneratePathway,
  getUserPathways,
  getPathwayById,
  getPathwayFeedbackAnalytics,
};