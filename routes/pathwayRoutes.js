const { generatePathway } = require("../controllers/pathwayController");
const protect = require("../middleware/authMiddleware");

router.post("/generate", protect, generatePathway);