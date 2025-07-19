// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking");
const sendSMS = require("../utils/sendSMS");

const ITARSI_LOCATION = "Itarsi, Madhya Pradesh";

const safe = (v, fallback = "Not Provided") => (v || "").toString().trim() || fallback;

const sanitizeSMS = (text) => {
  return (text || "")
    .replace(/[–—]/g, "-")
    .replace(/[₹•“”‘’]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
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
    console.log("📥 Incoming booking request body:\n", JSON.stringify(req.body, null, 2));

    const {
      name,
      mobile,
      email = "",
      paymentMode,
      carType,
      distance,
      totalFare,
      tollCount = 0,
      pickupDate,
      pickupTime,
      tripType,
      pickupLocation,
      dropLocation,
      duration = "",
    } = req.body;

    // Mandatory field check
const missingFields = [];
if (!name) missingFields.push("name");
if (!mobile) missingFields.push("mobile");
if (!paymentMode) missingFields.push("paymentMode");
if (!carType) missingFields.push("carType");
if (distance === undefined || distance === null) missingFields.push("distance");
if (totalFare === undefined || totalFare === null) missingFields.push("totalFare");
if (!tripType) missingFields.push("tripType");
if (!pickupLocation) missingFields.push("pickupLocation");
if (!dropLocation) missingFields.push("dropLocation");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields,
      });
    }

    if (paymentMode !== "Cash on Arrival") {
      return res.status(400).json({ success: false, message: "Invalid route for prepaid bookings" });
    }

    const { distanceInKm: pickupDistanceFromItarsi } = await getDistance(ITARSI_LOCATION, pickupLocation);
    const { distanceInKm: dropDistanceFromItarsi } = await getDistance(ITARSI_LOCATION, dropLocation);

    if (tripType === "Local") {
      if (pickupDistanceFromItarsi > 15 || dropDistanceFromItarsi > 15) {
        return res.status(400).json({
          success: false,
          message: "For Local trips, both pickup and drop must be within 15 KM of Itarsi.",
        });
      }
    }

    if (["One Way", "Round Trip"].includes(tripType)) {
      if (dropDistanceFromItarsi < 15) {
        return res.status(400).json({
          success: false,
          message: "Drop location must be at least 15 KM from Itarsi for this trip type.",
        });
      }
    }

    if (tripType === "Airport" && !dropLocation.toLowerCase().includes("airport")) {
      return res.status(400).json({
        success: false,
        message: "Drop location must be a valid airport for Airport trip type.",
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
      tollCount,
      pickupDate,
      pickupTime,
      tripType,
      pickupLocation,
      dropLocation,
      duration,
      paymentStatus: "Pending",
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    // SMS logic
    const nameText = sanitizeSMS(safe(name));
    const carText = sanitizeSMS(safe(carType));
    const fareText = sanitizeSMS(safe(totalFare));
    const pickupText = sanitizeSMS(`${safe(pickupDate)} ${safe(pickupTime)}`);
    const pickupLocText = sanitizeSMS(safe(pickupLocation));
    const dropText = sanitizeSMS(safe(dropLocation));
    const mobileText = sanitizeSMS(safe(mobile));

    const customerMessage = `Hi ${nameText}, your ItarsiTaxi booking is confirmed. Car: ${carText}, Fare: Rs${fareText}, Pickup: ${pickupText} from ${pickupLocText}. Thank you!`;
    const adminMessage = `New booking by ${nameText} (${mobileText}). Pickup: ${pickupLocText} ${pickupText}, Drop: ${dropText}, Car: ${carText}, Fare: Rs${fareText}`;
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
    res.status(500).json({ success: false, message: "Booking failed", error: err.message });
  }
});

module.exports = router;

