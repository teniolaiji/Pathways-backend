const Assessment = require("../models/Assessment");
const LearningPathway = require("../models/LearningPathway");
const Progress = require("../models/Progress");
const {
  generateLearningPathway,
  replacebrokenResources,
  callGroq,
} = require("../services/aiService");
const { validateResourceUrl } = require("../services/personalizationEngine");

// ── Sanitisation constants ────────────────────────────────────────
const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const VALID_FORMATS = ["video", "article", "exercise", "course"];

// ── sanitiseDifficulty ────────────────────────────────────────────
const sanitiseDifficulty = (val) => {
  if (!val) return "beginner";
  const v = val.toLowerCase().trim();

  if (VALID_DIFFICULTIES.includes(v)) return v;

  // Contains check
  if (v.includes("advanced")) return "advanced";
  if (v.includes("intermediate")) return "intermediate";
  if (v.includes("beginner")) return "beginner";

  // Synonym map
  const map = {
    easy: "beginner",
    basic: "beginner",
    intro: "beginner",
    introductory: "beginner",
    introduction: "beginner",
    foundational: "beginner",
    foundation: "beginner",
    elementary: "beginner",
    starter: "beginner",
    novice: "beginner",
    "entry level": "beginner",
    "entry-level": "beginner",
    "getting started": "beginner",
    moderate: "intermediate",
    medium: "intermediate",
    mid: "intermediate",
    middle: "intermediate",
    "mid-level": "intermediate",
    midlevel: "intermediate",
    "semi-advanced": "intermediate",
    "beginner-intermediate": "intermediate",
    "beginner to intermediate": "intermediate",
    "intermediate-advanced": "intermediate",
    hard: "advanced",
    difficult: "advanced",
    expert: "advanced",
    senior: "advanced",
    complex: "advanced",
    professional: "advanced",
    "upper-intermediate": "advanced",
  };

  if (map[v]) return map[v];

  // Partial fallbacks
  if (v.includes("hard")) return "advanced";
  if (v.includes("expert")) return "advanced";
  if (v.includes("medium")) return "intermediate";
  if (v.includes("basic")) return "beginner";
  if (v.includes("intro")) return "beginner";
  if (v.includes("found")) return "beginner";
  if (v.includes("easy")) return "beginner";

  // Absolute catch-all
  console.log(
    `[Sanitise] Unknown difficulty "${val}" — defaulting to "beginner"`,
  );
  return "beginner";
};

// ── sanitiseFormat ────────────────────────────────────────────────
const sanitiseFormat = (val) => {
  if (!val) return "article";
  const v = val.toLowerCase().trim();

  // Already valid
  if (VALID_FORMATS.includes(v)) return v;

  // Contains a valid format word — catches ALL multi-word variants
  // e.g. "video lectures", "video tutorials", "video courses" → "video"
  // e.g. "interactive learning", "interactive coding" → "exercise"
  if (v.includes("video")) return "video";
  if (v.includes("course")) return "course";
  if (v.includes("exercise")) return "exercise";
  if (v.includes("interactive")) return "exercise";
  if (v.includes("article")) return "article";

  // Full string map — known synonyms
  const map = {
    // article
    webpage: "article",
    web: "article",
    website: "article",
    page: "article",
    tutorial: "article",
    blog: "article",
    book: "article",
    reading: "article",
    text: "article",
    documentation: "article",
    docs: "article",
    guide: "article",
    resource: "article",
    link: "article",
    post: "article",
    written: "article",
    reference: "article",
    "web page": "article",
    "blog post": "article",
    "written tutorial": "article",
    "tutorials and reference": "article",
    "language-specific tutorials": "article",
    // video
    podcast: "video",
    lecture: "video",
    talk: "video",
    webinar: "video",
    stream: "video",
    watch: "video",
    "video lecture": "video",
    "video tutorial": "video",
    "video lectures": "video",
    "video tutorials": "video",
    "video courses": "video",
    "online video": "video",
    // exercise
    project: "exercise",
    quiz: "exercise",
    practice: "exercise",
    assignment: "exercise",
    lab: "exercise",
    playground: "exercise",
    challenge: "exercise",
    workshop: "exercise",
    lesson: "exercise",
    lessons: "exercise",
    activity: "exercise",
    task: "exercise",
    coding: "exercise",
    "interactive lesson": "exercise",
    "interactive lessons": "exercise",
    "interactive learning": "exercise",
    "interactive coding": "exercise",
    "hands-on": "exercise",
    "hands on": "exercise",
    "coding exercise": "exercise",
    "practice exercise": "exercise",
    // course
    mooc: "course",
    certification: "course",
    program: "course",
    curriculum: "course",
    bootcamp: "course",
    "online course": "course",
    "free course": "course",
    "short course": "course",
    "learning path": "course",
    "learning module": "course",
    "lectures and assignments": "course",
  };

  if (map[v]) return map[v];

  // Partial word matching
  if (v.includes("lesson")) return "exercise";
  if (v.includes("practice")) return "exercise";
  if (v.includes("workshop")) return "exercise";
  if (v.includes("project")) return "exercise";
  if (v.includes("coding")) return "exercise";
  if (v.includes("lecture")) return "video";
  if (v.includes("watch")) return "video";
  if (v.includes("tutorial")) return "article";
  if (v.includes("read")) return "article";
  if (v.includes("guide")) return "article";
  if (v.includes("doc")) return "article";
  if (v.includes("reference")) return "article";
  if (v.includes("certif")) return "course";
  if (v.includes("program")) return "course";
  if (v.includes("boot")) return "course";
  if (v.includes("path")) return "course";
  if (v.includes("assign")) return "course";

  // Absolute catch-all — NEVER throws a validation error
  console.log(`[Sanitise] Unknown format "${val}" — defaulting to "article"`);
  return "article";
};

// ── sanitiseModules — applies both sanitisers to all modules ──────
const sanitiseModules = (modules) =>
  (modules || []).map((mod) => ({
    ...mod,
    difficulty: sanitiseDifficulty(mod.difficulty),
    resources: (mod.resources || []).map((r) => ({
      ...r,
      format: sanitiseFormat(r.format),
    })),
  }));

// ── ensureMinimumResources ────────────────────────────────────────
// Guarantees every module has at least one validated resource.
// If a module ends up with no valid resources after validation and
// replacement, requests one fallback resource from the AI.
const ensureMinimumResources = async (modules, subfieldLabel, domainLabel) => {
  const result = await Promise.all(
    modules.map(async (mod) => {
      const validResources = (mod.resources || []).filter(
        (r) => r.isValidated !== false,
      );

      // Module already has at least one valid resource — leave it alone
      if (validResources.length > 0) return mod;

      console.log(
        `[Pathway] Module "${mod.title}" has no valid resources. Requesting fallback...`,
      );

      // Ask AI for one guaranteed-working fallback resource
      const fallbackPrompt = `You are a STEAM education resource curator.

The learning module "${mod.title}" for ${subfieldLabel} (${domainLabel}) has no working resource links.
Please provide exactly ONE reliable, free learning resource for this topic.

STRICT REQUIREMENTS:
- Must be from one of these platforms only: YouTube, freeCodeCamp, Khan Academy, W3Schools, MDN Web Docs, MIT OpenCourseWare, CS50, Codecademy, fast.ai, Kaggle Learn
- The URL must be a real, specific page — not a homepage
- Must be completely free to access with no login required
- Must be directly relevant to: ${mod.title}

RESPOND WITH VALID JSON ONLY — a single object, not an array:
{
  "title": "Resource title",
  "url": "https://specific-working-url.com/page",
  "format": "video",
  "source": "Platform name",
  "isFree": true
}`;

      try {
        const rawText = await callGroq(fallbackPrompt);
        const cleaned = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .replace(/^\[/, "")
          .replace(/\]$/, "") // strip array brackets if AI wraps it
          .trim();

        const fallback = JSON.parse(cleaned);

        // Sanitise and validate the fallback
        const sanitised = {
          ...fallback,
          format: sanitiseFormat(fallback.format),
          isValidated: await validateResourceUrl(fallback.url),
        };

        console.log(
          `[Pathway] Fallback for "${mod.title}": ${sanitised.title} — valid: ${sanitised.isValidated}`,
        );

        return {
          ...mod,
          resources: [sanitised],
        };
      } catch (e) {
        console.error(
          `[Pathway] Fallback resource request failed for "${mod.title}":`,
          e.message,
        );

        // Last resort — add a hardcoded reliable resource based on domain
        const lastResort = getLastResortResource(mod.title, subfieldLabel);
        return { ...mod, resources: [lastResort] };
      }
    }),
  );

  return result;
};

// ── getLastResortResource ─────────────────────────────────────────
// Hardcoded fallback used only if AI fallback also fails.
// These URLs are extremely stable and unlikely to ever break.
const getLastResortResource = (moduleTitle, subfieldLabel) => {
  const sf = subfieldLabel.toLowerCase();

  if (
    sf.includes("web") ||
    sf.includes("html") ||
    sf.includes("css") ||
    sf.includes("javascript")
  ) {
    return {
      title: "MDN Web Docs — Web Technology Reference",
      url: "https://developer.mozilla.org/en-US/docs/Web",
      format: "article",
      source: "MDN Web Docs",
      isFree: true,
      isValidated: true,
    };
  }
  if (
    sf.includes("python") ||
    sf.includes("data science") ||
    sf.includes("machine learning")
  ) {
    return {
      title: "freeCodeCamp — Data Analysis with Python",
      url: "https://www.freecodecamp.org/learn/data-analysis-with-python/",
      format: "course",
      source: "freeCodeCamp",
      isFree: true,
      isValidated: true,
    };
  }
  if (
    sf.includes("math") ||
    sf.includes("statistic") ||
    sf.includes("algebra")
  ) {
    return {
      title: "Khan Academy — Mathematics",
      url: "https://www.khanacademy.org/math",
      format: "course",
      source: "Khan Academy",
      isFree: true,
      isValidated: true,
    };
  }
  if (
    sf.includes("science") ||
    sf.includes("biology") ||
    sf.includes("chemistry") ||
    sf.includes("physics")
  ) {
    return {
      title: "Khan Academy — Science",
      url: "https://www.khanacademy.org/science",
      format: "course",
      source: "Khan Academy",
      isFree: true,
      isValidated: true,
    };
  }
  if (sf.includes("sql") || sf.includes("database")) {
    return {
      title: "W3Schools SQL Tutorial",
      url: "https://www.w3schools.com/sql/",
      format: "article",
      source: "W3Schools",
      isFree: true,
      isValidated: true,
    };
  }
  if (sf.includes("cyber") || sf.includes("security")) {
    return {
      title: "CS50 Cybersecurity — Harvard",
      url: "https://cs50.harvard.edu/cybersecurity/",
      format: "course",
      source: "Harvard CS50",
      isFree: true,
      isValidated: true,
    };
  }

  // Universal fallback — freeCodeCamp covers almost every STEAM topic
  return {
    title: `freeCodeCamp — Learn ${subfieldLabel}`,
    url: "https://www.freecodecamp.org/learn",
    format: "course",
    source: "freeCodeCamp",
    isFree: true,
    isValidated: true,
  };
};
// ── validateAndFixResources ───────────────────────────────────────
const validateAndFixResources = async (modules, subfieldLabel, domainLabel) => {
  // Step 1 — validate all URLs concurrently
  const withValidation = await Promise.all(
    modules.map(async (mod) => ({
      ...mod,
      resources: await Promise.all(
        (mod.resources || []).map(async (r) => ({
          ...r,
          isValidated: await validateResourceUrl(r.url),
        })),
      ),
    })),
  );

  // Step 2 — collect broken resources
  const broken = [];
  withValidation.forEach((mod) => {
    mod.resources.forEach((r) => {
      if (!r.isValidated) broken.push({ ...r, _modTitle: mod.title });
    });
  });

  const totalResources = withValidation.flatMap((m) => m.resources).length;
  console.log(
    `[Pathway] ${totalResources - broken.length}/${totalResources} resources valid. ${broken.length} broken.`,
  );

  if (broken.length === 0) return withValidation;

  // Step 3 — ask AI to replace broken resources
  // Step 3 — ask AI to replace broken resources (up to 2 attempts)
  let replacements = [];
  let replaceAttempt = 0;
  const MAX_REPLACE_ATTEMPTS = 2;

  while (replaceAttempt < MAX_REPLACE_ATTEMPTS) {
    try {
      replaceAttempt++;
      console.log(
        `[Pathway] Requesting replacements — attempt ${replaceAttempt}/${MAX_REPLACE_ATTEMPTS}...`,
      );
      replacements = await replacebrokenResources(
        broken,
        subfieldLabel,
        domainLabel,
      );

      // Validate replacements
      const checked = await Promise.all(
        replacements.map(async (r) => ({
          ...r,
          isValidated: await validateResourceUrl(r.url),
        })),
      );

      const stillBroken = checked.filter((r) => !r.isValidated);

      if (stillBroken.length === 0) {
        console.log(
          `[Pathway] All replacements valid on attempt ${replaceAttempt}.`,
        );
        replacements = checked;
        break;
      }

      if (replaceAttempt < MAX_REPLACE_ATTEMPTS) {
        console.log(
          `[Pathway] ${stillBroken.length} replacements still broken. Retrying...`,
        );
        broken.length = 0;
        broken.push(...stillBroken);
      } else {
        replacements = checked;
      }
    } catch (e) {
      console.error("[Pathway] AI replacement failed:", e.message);
      break;
    }
  }

  // Step 4 — sanitise and validate replacements
  const validatedReplacements = await Promise.all(
    sanitiseModules([{ resources: replacements }])[0].resources.map(
      async (r) => ({
        ...r,
        isValidated: await validateResourceUrl(r.url),
      }),
    ),
  );

  // Step 5 — swap broken with replacements
  let idx = 0;
  return withValidation.map((mod) => ({
    ...mod,
    resources: mod.resources.map((r) => {
      if (r.isValidated) return r;
      const replacement = validatedReplacements[idx++];
      if (replacement) {
        console.log(`[Pathway] Replaced "${r.title}" → "${replacement.title}"`);
        return replacement;
      }
      return r;
    }),
  }));
  // Final safety net — ensure every module has at least one resource
  return ensureMinimumResources(swapped, subfieldLabel, domainLabel);
};

// ── generatePathway ───────────────────────────────────────────────
const generatePathway = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      _id: req.params.assessmentId,
      user: req.user.id,
    });
    if (!assessment)
      return res.status(404).json({ message: "Assessment not found." });

    const aiResult = await generateLearningPathway(assessment);

    // Sanitise then validate/fix resources
    aiResult.modules = sanitiseModules(aiResult.modules);

    const subfieldLabel =
      assessment.subfield
        ?.split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || "";
    const domainLabel =
      assessment.domain?.charAt(0).toUpperCase() +
        assessment.domain?.slice(1) || "";
    const validatedModules = await validateAndFixResources(
      aiResult.modules,
      subfieldLabel,
      domainLabel,
    );

    const pathway = await LearningPathway.create({
      user: req.user.id,
      assessment: assessment._id,
      title: aiResult.title,
      summary: aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules: validatedModules,
    });

    res
      .status(201)
      .json({ message: "Pathway generated successfully.", pathway });
  } catch (error) {
    if (error instanceof SyntaxError)
      return res.status(502).json({
        message: "AI returned an unexpected response. Please try again.",
      });
    if (
      error.message?.includes("RATE_LIMIT") ||
      error.message?.includes("busy")
    )
      return res.status(429).json({
        message: "AI service is busy. Please wait 1 minute.",
        retryAfterSeconds: 60,
      });
    res.status(500).json({ message: error.message });
  }
};

// ── regeneratePathway ─────────────────────────────────────────────
const regeneratePathway = async (req, res) => {
  try {
    const oldPathway = await LearningPathway.findOne({
      _id: req.params.pathwayId,
      user: req.user.id,
    });
    if (!oldPathway)
      return res.status(404).json({ message: "Pathway not found." });

    const assessment = await Assessment.findById(oldPathway.assessment);
    if (!assessment)
      return res.status(404).json({ message: "Assessment not found." });

    oldPathway.status = "archived";
    await oldPathway.save();

    const aiResult = await generateLearningPathway(assessment);

    // Sanitise then validate/fix resources
    aiResult.modules = sanitiseModules(aiResult.modules);

    const subfieldLabel =
      assessment.subfield
        ?.split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || "";
    const domainLabel =
      assessment.domain?.charAt(0).toUpperCase() +
        assessment.domain?.slice(1) || "";
    const validatedModules = await validateAndFixResources(
      aiResult.modules,
      subfieldLabel,
      domainLabel,
    );

    const newPathway = await LearningPathway.create({
      user: req.user.id,
      assessment: assessment._id,
      title: aiResult.title,
      summary: aiResult.summary,
      aiExplanation: aiResult.aiExplanation,
      modules: validatedModules,
    });

    res.status(201).json({
      message:
        "Pathway regenerated successfully. Your previous pathway has been archived.",
      oldPathwayId: oldPathway._id,
      pathway: newPathway,
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return res.status(502).json({
        message: "AI returned an unexpected response. Please try again.",
      });
    if (
      error.message?.includes("RATE_LIMIT") ||
      error.message?.includes("busy")
    )
      return res.status(429).json({
        message: "AI service is busy. Please wait 1 minute.",
        retryAfterSeconds: 60,
      });
    res.status(500).json({ message: error.message });
  }
};

// ── getUserPathways ───────────────────────────────────────────────
const getUserPathways = async (req, res) => {
  try {
    const { status, domain, subfield, search } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;

    let pathways = await LearningPathway.find(filter)
      .sort({ createdAt: -1 })
      .populate("assessment", "domain subfield skillLevel goals");

    if (domain)
      pathways = pathways.filter((p) => p.assessment?.domain === domain);
    if (subfield)
      pathways = pathways.filter((p) => p.assessment?.subfield === subfield);
    if (search) {
      const q = search.toLowerCase();
      pathways = pathways.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q),
      );
    }

    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── getPathwayById ────────────────────────────────────────────────
const getPathwayById = async (req, res) => {
  try {
    const pathway = await LearningPathway.findOne({
      _id: req.params.pathwayId,
      user: req.user.id,
    }).populate("assessment");

    if (!pathway)
      return res.status(404).json({ message: "Pathway not found." });
    res.json(pathway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── getPathwayFeedbackAnalytics ───────────────────────────────────
const getPathwayFeedbackAnalytics = async (req, res) => {
  try {
    const pathway = await LearningPathway.findOne({
      _id: req.params.pathwayId,
      user: req.user.id,
    });
    if (!pathway)
      return res.status(404).json({ message: "Pathway not found." });

    const progress = await Progress.findOne({
      user: req.user.id,
      pathway: req.params.pathwayId,
    });

    if (!progress || progress.feedbackLog.length === 0) {
      return res.json({ message: "No feedback submitted yet.", analytics: [] });
    }

    const moduleMap = {};
    pathway.modules.forEach((mod) => {
      moduleMap[mod._id.toString()] = {
        moduleId: mod._id,
        moduleTitle: mod.title,
        difficulty: { too_easy: 0, just_right: 0, too_hard: 0 },
        relevance: { not_relevant: 0, somewhat_relevant: 0, very_relevant: 0 },
        comments: [],
        totalFeedback: 0,
      };
    });

    progress.feedbackLog.forEach((entry) => {
      const key = entry.moduleId?.toString();
      if (!key || !moduleMap[key]) return;

      const hasFeedback =
        entry.feedback?.difficulty || entry.feedback?.relevance;
      if (!hasFeedback) return;

      moduleMap[key].totalFeedback++;

      if (
        entry.feedback?.difficulty &&
        moduleMap[key].difficulty[entry.feedback.difficulty] !== undefined
      ) {
        moduleMap[key].difficulty[entry.feedback.difficulty]++;
      }
      if (
        entry.feedback?.relevance &&
        moduleMap[key].relevance[entry.feedback.relevance] !== undefined
      ) {
        moduleMap[key].relevance[entry.feedback.relevance]++;
      }
      if (entry.feedback?.comment) {
        moduleMap[key].comments.push(entry.feedback.comment);
      }
    });

    res.json({
      pathwayTitle: pathway.title,
      analytics: Object.values(moduleMap).filter((m) => m.totalFeedback > 0),
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
