const Donor = require("../models/Donor");
const asyncHandler = require("../utils/asyncHandler");
const { serializeDonor } = require("../utils/serializers");

const MINIMUM_DONATION_GAP_DAYS = 60;

const buildEligibility = (donor) => {
  if (!donor) {
    return {
      eligible: false,
      reason: "Donor profile not found.",
      type: "PROFILE"
    };
  }

  if (donor.safetyStatus !== "SAFE") {
    return {
      eligible: false,
      reason: donor.positiveReason || "You are not eligible to donate because your latest test result is not safe.",
      type: "SAFETY"
    };
  }

  if (donor.lastDonationDate) {
    const lastDonation = new Date(donor.lastDonationDate);
    const nextEligibleDate = new Date(lastDonation);
    nextEligibleDate.setDate(nextEligibleDate.getDate() + MINIMUM_DONATION_GAP_DAYS);

    if (nextEligibleDate > new Date()) {
      const daysRemaining = Math.ceil((nextEligibleDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        eligible: false,
        reason: "You donated recently and must wait at least 60 days before booking again.",
        type: "RECENT_DONATION",
        daysRemaining,
        nextEligibleDate
      };
    }
  }

  return {
    eligible: true,
    reason: "Eligible to donate"
  };
};

const getDonorByUserId = asyncHandler(async (req, res) => {
  const donor = await Donor.findOne({ user: req.params.userId }).populate("user", "-password");

  if (!donor) {
    res.status(404);
    throw new Error("Donor profile not found");
  }

  res.status(200).json(serializeDonor(donor));
});

const getEligibility = asyncHandler(async (req, res) => {
  const donor = await Donor.findOne({ user: req.params.id });
  res.status(200).json(buildEligibility(donor));
});

const healthCheck = asyncHandler(async (req, res) => {
  const { diseases, medications, surgery, travel } = req.body;
  const ineligible = [diseases, medications, surgery, travel].some(Boolean);

  res.status(200).json({
    eligible: !ineligible,
    reason: ineligible ? "Health questionnaire marked you as temporarily ineligible." : "Health questionnaire passed."
  });
});

module.exports = {
  getDonorByUserId,
  getEligibility,
  healthCheck,
  buildEligibility
};
