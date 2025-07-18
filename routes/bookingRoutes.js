const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking");
const sendSMS = require("../utils/sendSMS");

const safe = (v, fallback = "Not Provided") => (v || "").toString().trim() || fallback;

// ✅ Sanitize all SMS content to remove Unicode characters
const sanitizeSMS = (text) => {
  return (text || "")
    .replace(/[–—]/g, "-")           // Replace en dash/em dash with hyphen
    .replace(/[₹•“”‘’]/g, "")        // Remove special symbols/quotes
    .replace(/[^\x00-\x7F]/g, "")    // Remove non-ASCII characters
    .trim();
};

router.get("/distance", async (req, res) => {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: "Both origin and destination are required." });
  }

  try {
    const result = await getDistance(origin, destination);
    res.json(result);
  } catch (err) {
    console.error("❌ Error in distance API:", err.message);
    res.status(500).json({ error: "Failed to fetch distance." });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("📥 Incoming booking request:", req.body);

    const {
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      dropLocation,
      pickupDate,
      pickupTime,
      tripType,
      duration,
    } = req.body;

    if (!name || !mobile || !paymentMode || !carType || !distance || !totalFare) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ❌ Only allow saving here for 'Cash on Arrival'
    if (paymentMode !== "Cash on Arrival") {
      return res.status(400).json({
        success: false,
        message: "Invalid route for prepaid bookings",
      });
    }

    const newBooking = new Booking({
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      dropLocation,
      pickupDate,
      pickupTime,
      tripType,
      duration,
      paymentStatus: "Pending",
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    // ✅ SMS logic
    const nameText = sanitizeSMS(safe(name));
    const carText = sanitizeSMS(safe(carType));
    const fareText = sanitizeSMS(safe(totalFare));
    const pickupText = sanitizeSMS(`${safe(pickupDate)} ${safe(pickupTime)}`);
    const dropText = sanitizeSMS(safe(dropLocation));
    const mobileText = sanitizeSMS(safe(mobile));
    const customerMessage = `Hi ${nameText}, your ItarsiTaxi booking is confirmed. Car: ${carText}, Fare: Rs${fareText}, Pickup: ${pickupText}. Thank you!`;
    const adminMessage = `New booking by ${nameText} (${mobileText}). Pickup: ${pickupText}, Drop: ${dropText}, Car: ${carText}, Fare: Rs${fareText}`;
    const adminPhone = process.env.ADMIN_PHONE || "91XXXXXXXXXX";

    await sendSMS(mobileText, customerMessage);
    await sendSMS(adminPhone, adminMessage);

    res.status(201).json({
      success: true,
      message: "Booking saved successfully",
      bookingId: savedBooking._id,
    });
  } catch (err) {
    console.error("🔥 Booking Error:", err.message || err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;

