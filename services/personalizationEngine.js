const LearningPathway = require("../models/LearningPathway");

// ── Badge definitions ───────────────────────────────────────────
// These are the four badges a learner can earn through the platform.
// Add more here as the platform grows.
const BADGES = {
  FIRST_MODULE: {
    title: "First Step",
    description: "Completed your very first learning module. The journey begins!",
  },
  STREAK_3: {
    title: "On a Roll",
    description: "Completed 3 modules. You are building great momentum!",
  },
  HALFWAY: {
    title: "Halfway There",
    description: "Reached the halfway point of your learning pathway.",
  },
  PATHWAY_COMPLETE: {
    title: "Pathway Champion",
    description: "Completed every module in your learning pathway. Outstanding!",
  },
};

// ── Badge checker ───────────────────────────────────────────────
/**
 * Compares the learner's current progress against badge thresholds
 * and returns any newly earned badges that haven't been awarded yet.
 *
 * @param {Number} completedCount  - How many modules the user has now completed
 * @param {Number} totalModules    - Total modules in the pathway
 * @param {Array}  existingBadges  - Badges the user has already earned
 * @returns {Array} newBadges      - Array of badge objects to award now
 */
const checkForNewBadges = (completedCount, totalModules, existingBadges) => {
  // Build a set of titles already awarded so we never double-award
  const alreadyAwarded = new Set(existingBadges.map((b) => b.title));
  const newBadges = [];

  // Badge 1 — First module completed
  if (completedCount >= 1 && !alreadyAwarded.has(BADGES.FIRST_MODULE.title)) {
    newBadges.push(BADGES.FIRST_MODULE);
  }

  // Badge 2 — 3 modules completed
  if (completedCount >= 3 && !alreadyAwarded.has(BADGES.STREAK_3.title)) {
    newBadges.push(BADGES.STREAK_3);
  }

  // Badge 3 — Reached the halfway point (only meaningful if pathway has 2+ modules)
  const halfwayPoint = Math.ceil(totalModules / 2);
  if (
    totalModules > 1 &&
    completedCount >= halfwayPoint &&
    !alreadyAwarded.has(BADGES.HALFWAY.title)
  ) {
    newBadges.push(BADGES.HALFWAY);
  }

  // Badge 4 — All modules completed
  if (
    totalModules > 0 &&
    completedCount >= totalModules &&
    !alreadyAwarded.has(BADGES.PATHWAY_COMPLETE.title)
  ) {
    newBadges.push(BADGES.PATHWAY_COMPLETE);
  }

  return newBadges;
};

// ── Completion rate calculator ──────────────────────────────────
/**
 * Returns the learner's completion percentage as a whole number (0–100).
 *
 * @param {Number} completed  - Modules completed so far
 * @param {Number} total      - Total modules in the pathway
 * @returns {Number}          - Percentage e.g. 75
 */
const calculateCompletionRate = (completed, total) => {
  if (!total || total === 0) return 0;
  return Math.round((completed / total) * 100);
};

// ── Single URL validator ────────────────────────────────────────
/**
 * Checks whether a single resource URL is reachable by sending
 * a HEAD request (downloads only headers, not the full page).
 *
 * Uses the native `fetch` built into Node.js 18+.
 * No external packages needed.
 *
 * @param {String} url   - The resource URL to check
 * @returns {Boolean}    - true if the server responds 200-399, false otherwise
 */
const validateResourceUrl = async (url) => {
  try {
    const controller = new AbortController();

    // Abort the request if it takes more than 7 seconds
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        // Some servers block requests without a User-Agent header
        "User-Agent": "Pathways-Validator/1.0",
      },
    });

    clearTimeout(timeout);

    // Any 2xx or 3xx status means the URL is reachable
    return response.status < 400;
  } catch {
    // Network error, timeout, or invalid URL — treat as unreachable
    return false;
  }
};

// ── Bulk pathway resource validator ────────────────────────────
/**
 * Loops through every resource in every module of a pathway,
 * validates each URL, and updates the `isValidated` flag in the database.
 *
 * Resources flagged 3+ times by users are automatically kept as
 * isValidated = false regardless of URL reachability.
 *
 * @param {String} pathwayId  - MongoDB _id of the pathway to validate
 * @returns {Object}          - The updated pathway document
 */
const validatePathwayResources = async (pathwayId) => {
  const pathway = await LearningPathway.findById(pathwayId);
  if (!pathway) {
    throw new Error("Pathway not found.");
  }

  for (const mod of pathway.modules) {
    for (const resource of mod.resources) {
      // Skip resources already invalidated by user flags (3+ flags)
      if (resource.flagCount >= 3) {
        resource.isValidated = false;
        continue;
      }

      const isReachable = await validateResourceUrl(resource.url);
      resource.isValidated = isReachable;
    }
  }

  await pathway.save();
  return pathway;
};

module.exports = {
  checkForNewBadges,
  calculateCompletionRate,
  validateResourceUrl,
  validatePathwayResources,
};