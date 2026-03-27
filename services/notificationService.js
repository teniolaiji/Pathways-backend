const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendBadgeEmail } = require("./emailService");

/**
 * Creates an in-app notification for a user.
 */
const createNotification = async (userId, type, title, message, link = null, meta = {}) => {
  try {
    const notification = await Notification.create({
      user: userId, type, title, message, link, meta,
    });
    return notification;
  } catch (error) {
    // Never crash the main flow because of a notification failure
    console.error("[Notifications] Failed to create notification:", error.message);
    return null;
  }
};

/**
 * Creates badge notifications + sends badge email.
 */
const notifyBadgeEarned = async (userId, badges) => {
  try {
    const user = await User.findById(userId).select("name email");

    for (const badge of badges) {
      await createNotification(
        userId,
        "badge",
        `🏅 Badge Earned: ${badge.title}`,
        badge.description,
        "/pathways",
        { badge }
      );

      // Also send an email for each badge (non-blocking)
      if (user?.email) {
        sendBadgeEmail(user.email, user.name, badge.title, badge.description)
          .catch((e) => console.error("[Notifications] Badge email failed:", e.message));
      }
    }
  } catch (error) {
    console.error("[Notifications] notifyBadgeEarned failed:", error.message);
  }
};

/**
 * Notifies user when a flagged resource is restored by admin.
 */
const notifyResourceRestored = async (userId, resourceTitle, pathwayTitle) => {
  await createNotification(
    userId,
    "resource_restored",
    "Resource Restored",
    `The resource "${resourceTitle}" in your pathway "${pathwayTitle}" has been reviewed and restored by an admin.`,
    "/pathways"
  );
};

/**
 * Notifies user when a flagged resource is permanently removed by admin.
 */
const notifyResourceRemoved = async (userId, resourceTitle, pathwayTitle) => {
  await createNotification(
    userId,
    "resource_removed",
    "Resource Removed",
    `The resource "${resourceTitle}" in your pathway "${pathwayTitle}" has been permanently removed. Your pathway may have been updated.`,
    "/pathways"
  );
};

/**
 * Sends a welcome notification on first login after verification.
 */
const notifyWelcome = async (userId, name) => {
  await createNotification(
    userId,
    "welcome",
    `Welcome to Pathways, ${name}!`,
    "Your account is set up. Start by taking an assessment to generate your personalised learning pathway.",
    "/assessment"
  );
};

module.exports = {
  createNotification,
  notifyBadgeEarned,
  notifyResourceRestored,
  notifyResourceRemoved,
  notifyWelcome,
};