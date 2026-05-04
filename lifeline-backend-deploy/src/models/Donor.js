const mongoose = require("mongoose");

const donorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    bloodType: {
      type: String,
      default: "UNKNOWN"
    },
    lastDonationDate: Date,
    weight: Number,
    gender: String,
    dateOfBirth: Date,
    province: String,
    district: String,
    nearestHospital: String,
    safetyStatus: {
      type: String,
      enum: ["SAFE", "POSITIVE", "BLOCKED"],
      default: "SAFE"
    },
    positiveReason: String
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Donor", donorSchema);
