const Profile = require("../models/Profile");

/**
 * GET /api/profile
 * Get the authenticated user's profile.
 */
const getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id }).populate(
      "user",
      "name email"
    );

    if (!profile) {
      return res
        .status(404)
        .json({ message: "Profile not found. Please complete an assessment." });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/profile
 * Update the authenticated user's profile.
 */
const updateProfile = async (req, res) => {
  try {
    const {
      goals,
      steamDomains,
      skillLevel,
      timeAvailability,
      internetAccess,
      learningPace,
      preferredLanguage,
    } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      {
        ...(goals && { goals }),
        ...(steamDomains && { steamDomains }),
        ...(skillLevel && { skillLevel }),
        ...(timeAvailability && { timeAvailability }),
        ...(internetAccess && { internetAccess }),
        ...(learningPace && { learningPace }),
        ...(preferredLanguage && { preferredLanguage }),
      },
      { upsert: true, new: true }
    );

    res.json({ message: "Profile updated.", profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProfile, updateProfile };