const User = require("../models/User");
const Profile = require("../models/Profile");
const Assessment = require("../models/Assessment");
const LearningPathway = require("../models/LearningPathway");
const Progress = require("../models/Progress");

// ── GET /api/admin/stats ─────────────────────────────────────────
const getPlatformStats = async (req, res) => {
  try {
    const [
      totalUsers, totalLearners, totalAdmins,
      totalPathways, totalAssessments,
      activePathways, completedPathways,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "learner" }),
      User.countDocuments({ role: "admin" }),
      LearningPathway.countDocuments(),
      Assessment.countDocuments(),
      LearningPathway.countDocuments({ status: "active" }),
      LearningPathway.countDocuments({ status: "completed" }),
      User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt"),
    ]);

    const pathwaysWithFlags = await LearningPathway.find({
      "modules.resources.flagCount": { $gte: 1 },
    });
    let flaggedResourceCount = 0;
    pathwaysWithFlags.forEach((p) => {
      p.modules.forEach((m) => {
        m.resources.forEach((r) => { if (r.flagCount >= 1) flaggedResourceCount++; });
      });
    });

    res.json({
      users: { total: totalUsers, learners: totalLearners, admins: totalAdmins },
      pathways: { total: totalPathways, active: activePathways, completed: completedPathways },
      assessments: { total: totalAssessments },
      flaggedResources: flaggedResourceCount,
      recentUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/admin/users ─────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const pathwayCounts = await LearningPathway.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    pathwayCounts.forEach((p) => { countMap[p._id.toString()] = p.count; });

    const enriched = users.map((u) => ({
      ...u.toObject(),
      pathwayCount: countMap[u._id.toString()] || 0,
    }));

    res.json({
      users: enriched,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/admin/users/:userId ─────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    const [profile, assessments, pathways, progress] = await Promise.all([
      Profile.findOne({ user: user._id }),
      Assessment.find({ user: user._id }).sort({ createdAt: -1 }),
      LearningPathway.find({ user: user._id }).sort({ createdAt: -1 }),
      Progress.find({ user: user._id }).populate("pathway", "title"),
    ]);

    res.json({ user, profile, assessments, pathways, progress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/admin/users/:userId ─────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (req.params.userId === req.user._id.toString() && role === "learner") {
      return res.status(400).json({ message: "You cannot remove your own admin privileges." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { ...(name && { name }), ...(email && { email }), ...(role && { role }) },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: "User updated successfully.", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/admin/users/:userId ──────────────────────────────
const deleteUser = async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    await Promise.all([
      Profile.deleteMany({ user: req.params.userId }),
      Assessment.deleteMany({ user: req.params.userId }),
      LearningPathway.deleteMany({ user: req.params.userId }),
      Progress.deleteMany({ user: req.params.userId }),
      User.findByIdAndDelete(req.params.userId),
    ]);

    res.json({ message: `User ${user.name} and all their data have been deleted.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/admin/users/:userId/promote ─────────────────────────
const promoteToAdmin = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role: "admin" },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `${user.name} has been promoted to admin.`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/admin/users/:userId/demote ──────────────────────────
const demoteToLearner = async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot demote yourself." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role: "learner" },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `${user.name} has been demoted to learner.`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/admin/pathways ──────────────────────────────────────
const getAllPathways = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [pathways, total] = await Promise.all([
      LearningPathway.find(filter)
        .populate("user", "name email")
        .populate("assessment", "domain subfield skillLevel")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LearningPathway.countDocuments(filter),
    ]);

    res.json({
      pathways,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/admin/pathways/:pathwayId ────────────────────────
const deletePathway = async (req, res) => {
  try {
    const pathway = await LearningPathway.findById(req.params.pathwayId);
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    await Promise.all([
      Progress.deleteMany({ pathway: req.params.pathwayId }),
      LearningPathway.findByIdAndDelete(req.params.pathwayId),
    ]);

    res.json({ message: "Pathway and associated progress deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/admin/flagged-resources ────────────────────────────
const getFlaggedResources = async (req, res) => {
  try {
    const pathways = await LearningPathway.find({
      "modules.resources.flagCount": { $gte: 1 },
    }).populate("user", "name email");

    const flagged = [];
    pathways.forEach((pathway) => {
      pathway.modules.forEach((mod) => {
        mod.resources.forEach((resource) => {
          if (resource.flagCount >= 1) {
            flagged.push({
              pathwayId: pathway._id,
              pathwayTitle: pathway.title,
              pathwayUser: pathway.user,
              moduleId: mod._id,
              moduleTitle: mod.title,
              resourceId: resource._id,
              resourceTitle: resource.title,
              resourceUrl: resource.url,
              flagCount: resource.flagCount,
              isValidated: resource.isValidated,
            });
          }
        });
      });
    });

    flagged.sort((a, b) => b.flagCount - a.flagCount);
    res.json({ count: flagged.length, flaggedResources: flagged });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/admin/resources/:pathwayId/:moduleId/:resourceId/restore
const restoreResource = async (req, res) => {
  try {
    const { pathwayId, moduleId, resourceId } = req.params;
    const pathway = await LearningPathway.findById(pathwayId);
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const mod = pathway.modules.id(moduleId);
    if (!mod) return res.status(404).json({ message: "Module not found." });

    const resource = mod.resources.id(resourceId);
    if (!resource) return res.status(404).json({ message: "Resource not found." });

    resource.flagCount = 0;
    resource.isValidated = true;
    await pathway.save();

    res.json({ message: "Resource restored successfully.", resource });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/admin/resources/:pathwayId/:moduleId/:resourceId ─
const removeResource = async (req, res) => {
  try {
    const { pathwayId, moduleId, resourceId } = req.params;
    const pathway = await LearningPathway.findById(pathwayId);
    if (!pathway) return res.status(404).json({ message: "Pathway not found." });

    const mod = pathway.modules.id(moduleId);
    if (!mod) return res.status(404).json({ message: "Module not found." });

    mod.resources.pull({ _id: resourceId });
    await pathway.save();

    res.json({ message: "Resource permanently removed." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPlatformStats,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  promoteToAdmin,
  demoteToLearner,
  getAllPathways,
  deletePathway,
  getFlaggedResources,
  restoreResource,
  removeResource,
};