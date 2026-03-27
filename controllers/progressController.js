const Progress   = require("../models/Progress");
const LearningPathway = require("../models/LearningPathway");
const {
  checkForNewBadges,
  calculateCompletionRate,
  validatePathwayResources,
} = require("../services/personalizationEngine");
const { notifyBadgeEarned } = require("../services/notificationService");

// POST /api/progress/complete/:pathwayId/:moduleId
const markModuleComplete = async (req, res) => {
  try {
    const { pathwayId, moduleId } = req.params;
    const { feedback } = req.body;

    const pathway = await LearningPathway.findOne({ _id: pathwayId, user: req.user.id });
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const module = pathway.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found in pathway." });

    let progress = await Progress.findOne({ user: req.user.id, pathway: pathwayId });
    if (!progress) {
      progress = new Progress({ user: req.user.id, pathway: pathwayId, completedModules: [], earnedBadges: [] });
    }

    const alreadyCompleted = progress.completedModules.some(
      (cm) => cm.moduleId.toString() === moduleId
    );
    if (alreadyCompleted) {
      return res.status(400).json({ message: "This module has already been marked complete." });
    }

    const completionEntry = { moduleId, moduleTitle: module.title, completedAt: new Date() };
    if (feedback) {
      completionEntry.feedback = feedback;
      progress.feedbackLog.push({ moduleId, moduleTitle: module.title, feedback, loggedAt: new Date() });
    }
    progress.completedModules.push(completionEntry);

    const totalModules  = pathway.modules.length;
    const completedCount = progress.completedModules.length;
    progress.completionRate = calculateCompletionRate(completedCount, totalModules);
    progress.lastActive     = new Date();

    const newBadges = checkForNewBadges(completedCount, totalModules, progress.earnedBadges);
    if (newBadges.length > 0) {
      progress.earnedBadges.push(...newBadges);
      // Fire badge notifications + emails (non-blocking)
      notifyBadgeEarned(req.user.id, newBadges).catch(console.error);
    }

    // If all modules done, update pathway status
    if (completedCount >= totalModules) {
      pathway.status = "completed";
    }

    module.isCompleted = true;
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

// GET /api/progress/:pathwayId
const getProgress = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      user: req.user.id,
      pathway: req.params.pathwayId,
    }).populate("pathway", "title modules status");

    if (!progress) {
      return res.status(404).json({ message: "No progress found for this pathway." });
    }
    res.status(200).json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/progress
const getAllProgress = async (req, res) => {
  try {
    const allProgress = await Progress.find({ user: req.user.id })
      .populate("pathway", "title status modules")
      .sort({ lastActive: -1 });

    const summary = allProgress.map((p) => ({
      pathwayId:        p.pathway?._id,
      pathwayTitle:     p.pathway?.title,
      completionRate:   p.completionRate,
      completedModules: p.completedModules.length,
      totalModules:     p.pathway?.modules?.length ?? 0,
      badgesEarned:     p.earnedBadges.length,
      lastActive:       p.lastActive,
    }));

    res.status(200).json({ count: summary.length, summary, allProgress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/progress/flag/:pathwayId/:moduleId/:resourceId
const flagResource = async (req, res) => {
  try {
    const { pathwayId, moduleId, resourceId } = req.params;

    const pathway = await LearningPathway.findOne({ _id: pathwayId, user: req.user.id });
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const module   = pathway.modules.id(moduleId);
    if (!module)   return res.status(404).json({ message: "Module not found." });

    const resource = module.resources.id(resourceId);
    if (!resource) return res.status(404).json({ message: "Resource not found." });

    resource.flagCount += 1;
    if (resource.flagCount >= 3) resource.isValidated = false;

    await pathway.save();

    res.status(200).json({
      message:         "Resource flagged successfully.",
      resourceTitle:   resource.title,
      flagCount:       resource.flagCount,
      isValidated:     resource.isValidated,
      autoInvalidated: resource.flagCount >= 3,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/progress/validate/:pathwayId
const triggerResourceValidation = async (req, res) => {
  try {
    const query = req.user.role === "admin"
      ? { _id: req.params.pathwayId }
      : { _id: req.params.pathwayId, user: req.user.id };

    const pathway = await LearningPathway.findOne(query);
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const updatedPathway = await validatePathwayResources(req.params.pathwayId);

    let validated = 0, invalid = 0;
    for (const mod of updatedPathway.modules) {
      for (const resource of mod.resources) {
        resource.isValidated ? validated++ : invalid++;
      }
    }

    res.status(200).json({
      message: "Resource validation complete.",
      summary: { totalResources: validated + invalid, accessible: validated, inaccessible: invalid },
      pathway: updatedPathway,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  markModuleComplete, getProgress, getAllProgress,
  flagResource, triggerResourceValidation,
};