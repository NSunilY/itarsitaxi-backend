const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking"); // Make sure this path is correct

// GET Distance route
router.get("/distance", async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Both origin and destination are required." });
  }

  try {
    const result = await getDistance(origin, destination);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch distance." });
  }
});

// ✅ POST /api/bookings — Save booking to DB
router.post("/", async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
    } = req.body;

    if (!name || !mobile || !paymentMode || !carType || !distance || !totalFare) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newBooking = new Booking({
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
    });

    const savedBooking = await newBooking.save();

    res.status(201).json({
      success: true,
      message: "Booking saved successfully",
      bookingId: savedBooking._id,
    });
  } catch (err) {
    console.error("Booking Error:", err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;

