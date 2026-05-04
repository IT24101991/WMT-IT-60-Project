const express = require("express");

const { getEligibility, getDonorByUserId, healthCheck } = require("../controllers/donorController");
const { getDonors } = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/all", protect, authorize("ADMIN"), getDonors);
router.get("/:id/eligibility", protect, getEligibility);
router.get("/user/:userId", protect, getDonorByUserId);
router.post("/health-check", protect, healthCheck);

module.exports = router;
