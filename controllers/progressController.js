const Progress = require("../models/Progress");
const LearningPathway = require("../models/LearningPathway");
const {
  checkForNewBadges,
  calculateCompletionRate,
  validatePathwayResources,
} = require("../services/personalizationEngine");

// ── Mark a module complete ──────────────────────────────────────
/**
 * POST /api/progress/complete/:pathwayId/:moduleId
 *
 * Called when a learner clicks "Mark as Complete" on a module.
 * - Finds or creates the user's progress record for this pathway
 * - Records the completed module with optional feedback
 * - Recalculates the overall completion percentage
 * - Checks whether any new badges have been earned
 * - Marks the module as complete on the pathway document itself
 *
 * Returns the updated completion rate, any newly earned badges,
 * and the full progress record.
 */
const markModuleComplete = async (req, res) => {
  try {
    const { pathwayId, moduleId } = req.params;
    const { feedback } = req.body; // optional — { difficulty, relevance, comment }

    // 1. Confirm the pathway exists and belongs to this user
    const pathway = await LearningPathway.findOne({
      _id: pathwayId,
      user: req.user.id,
    });

    if (!pathway) {
      return res.status(404).json({ message: "Pathway not found." });
    }

    // 2. Confirm the module exists inside that pathway
    const module = pathway.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ message: "Module not found in pathway." });
    }

    // 3. Find existing progress record or create a fresh one
    let progress = await Progress.findOne({
      user: req.user.id,
      pathway: pathwayId,
    });

    if (!progress) {
      progress = new Progress({
        user: req.user.id,
        pathway: pathwayId,
        completedModules: [],
        earnedBadges: [],
      });
    }

    // 4. Prevent marking the same module complete twice
    const alreadyCompleted = progress.completedModules.some(
      (cm) => cm.moduleId.toString() === moduleId
    );

    if (alreadyCompleted) {
      return res
        .status(400)
        .json({ message: "This module has already been marked complete." });
    }

    // 5. Record the module completion
    const completionEntry = {
      moduleId,
      moduleTitle: module.title,
      completedAt: new Date(),
    };

    // Attach feedback if the user provided it
    if (feedback) {
      completionEntry.feedback = feedback;
      // Also append to the persistent feedback log for analytics
      progress.feedbackLog.push({
        moduleId,
        moduleTitle: module.title,
        feedback,
        loggedAt: new Date(),
      });
    }

    progress.completedModules.push(completionEntry);

    // 6. Recalculate completion percentage
    const totalModules = pathway.modules.length;
    const completedCount = progress.completedModules.length;

    progress.completionRate = calculateCompletionRate(
      completedCount,
      totalModules
    );
    progress.lastActive = new Date();

    // 7. Check for newly earned badges
    const newBadges = checkForNewBadges(
      completedCount,
      totalModules,
      progress.earnedBadges
    );

    if (newBadges.length > 0) {
      progress.earnedBadges.push(...newBadges);
    }

    // 8. Sync the isCompleted flag on the pathway module document
    module.isCompleted = true;

    // 9. Persist both documents
    await pathway.save();
    await progress.save();

    res.status(200).json({
      message: "Module marked as complete.",
      completionRate: progress.completionRate,
      completedCount,
      totalModules,
      newBadges,
      totalBadgesEarned: progress.earnedBadges.length,
      progress,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get progress for a pathway ──────────────────────────────────
/**
 * GET /api/progress/:pathwayId
 *
 * Returns the learner's full progress record for a given pathway,
 * including completed modules, earned badges, and completion rate.
 * Populates the pathway title and modules for context.
 */
const getProgress = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      user: req.user.id,
      pathway: req.params.pathwayId,
    }).populate("pathway", "title modules status");

    if (!progress) {
      return res.status(404).json({
        message:
          "No progress record found for this pathway. Complete a module to start tracking.",
      });
    }

    res.status(200).json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Flag a resource ─────────────────────────────────────────────
/**
 * POST /api/progress/flag/:pathwayId/:moduleId/:resourceId
 *
 * Allows a learner to flag a resource as broken, inaccessible,
 * or inappropriate. Each flag increments the resource's flagCount.
 * Once flagCount reaches 3, the resource is automatically marked
 * isValidated = false, removing it from active recommendations.
 */
const flagResource = async (req, res) => {
  try {
    const { pathwayId, moduleId, resourceId } = req.params;

    // Only the owner of the pathway can flag its resources
    const pathway = await LearningPathway.findOne({
      _id: pathwayId,
      user: req.user.id,
    });

    if (!pathway) {
      return res.status(404).json({ message: "Pathway not found." });
    }

    const module = pathway.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ message: "Module not found." });
    }

    const resource = module.resources.id(resourceId);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found." });
    }

    // Increment the flag count
    resource.flagCount += 1;

    // Auto-invalidate after 3 flags
    if (resource.flagCount >= 3) {
      resource.isValidated = false;
    }

    await pathway.save();

    res.status(200).json({
      message: "Resource flagged successfully.",
      resourceTitle: resource.title,
      flagCount: resource.flagCount,
      isValidated: resource.isValidated,
      autoInvalidated: resource.flagCount >= 3,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Validate all resource URLs in a pathway ─────────────────────
/**
 * POST /api/progress/validate/:pathwayId
 *
 * Sends a HEAD request to every resource URL in the pathway to
 * check if it is still reachable. Updates isValidated on each
 * resource accordingly. Resources with 3+ flags are skipped and
 * kept as invalid regardless of URL status.
 *
 * This can be called by the learner after generating a pathway,
 * or by an admin as part of content maintenance.
 *
 * Note: Uses native Node.js 18+ fetch — no external packages needed.
 * Takes 10–30 seconds depending on the number of resources.
 */
const triggerResourceValidation = async (req, res) => {
  try {
    const { pathwayId } = req.params;

    // Verify the pathway exists (admin can validate any pathway,
    // learner can only validate their own)
    const query =
      req.user.role === "admin"
        ? { _id: pathwayId }
        : { _id: pathwayId, user: req.user.id };

    const pathway = await LearningPathway.findOne(query);

    if (!pathway) {
      return res.status(404).json({ message: "Pathway not found." });
    }

    // Run validation — this updates and saves the pathway internally
    const updatedPathway = await validatePathwayResources(pathwayId);

    // Count how many resources passed and failed
    let validated = 0;
    let invalid = 0;

    for (const mod of updatedPathway.modules) {
      for (const resource of mod.resources) {
        resource.isValidated ? validated++ : invalid++;
      }
    }

    res.status(200).json({
      message: "Resource validation complete.",
      summary: {
        totalResources: validated + invalid,
        accessible: validated,
        inaccessible: invalid,
      },
      pathway: updatedPathway,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get all progress records for the current user ───────────────
/**
 * GET /api/progress
 *
 * Returns a summary of progress across all pathways for the
 * authenticated user. Useful for building a profile overview.
 */
const getAllProgress = async (req, res) => {
  try {
    const allProgress = await Progress.find({ user: req.user.id })
      .populate("pathway", "title status modules")
      .sort({ lastActive: -1 });

    // Build a lightweight summary array
    const summary = allProgress.map((p) => ({
      pathwayId: p.pathway?._id,
      pathwayTitle: p.pathway?.title,
      completionRate: p.completionRate,
      completedModules: p.completedModules.length,
      totalModules: p.pathway?.modules?.length ?? 0,
      badgesEarned: p.earnedBadges.length,
      lastActive: p.lastActive,
    }));

    res.status(200).json({ count: summary.length, summary, allProgress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  markModuleComplete,
  getProgress,
  getAllProgress,
  flagResource,
  triggerResourceValidation,
};