const express = require("express");
const {
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
} = require("../controllers/adminController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// Every admin route requires BOTH protect (valid JWT) AND adminOnly (role === admin)
router.use(protect, adminOnly);

// ── Platform stats ────────────────────────────────────────────────
router.get("/stats", getPlatformStats);

// ── User management ───────────────────────────────────────────────
router.get("/users",              getAllUsers);
router.get("/users/:userId",      getUserById);
router.put("/users/:userId",      updateUser);
router.delete("/users/:userId",   deleteUser);
router.put("/users/:userId/promote", promoteToAdmin);
router.put("/users/:userId/demote",  demoteToLearner);

// ── Pathway management ────────────────────────────────────────────
router.get("/pathways",                  getAllPathways);
router.delete("/pathways/:pathwayId",    deletePathway);

// ── Resource management ───────────────────────────────────────────
router.get("/flagged-resources",  getFlaggedResources);
router.put("/resources/:pathwayId/:moduleId/:resourceId/restore", restoreResource);
router.delete("/resources/:pathwayId/:moduleId/:resourceId",      removeResource);

module.exports = router;