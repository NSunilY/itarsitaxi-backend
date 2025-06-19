const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");

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

module.exports = router;

