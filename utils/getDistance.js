const { Client } = require("@googlemaps/google-maps-services-js");
require("dotenv").config();

const client = new Client({});

const getDistance = async (origin, destination) => {
  try {
    const response = await client.directions({
      params: {
        origin,
        destination,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
      timeout: 1000,
    });

    const route = response.data.routes[0];
    const leg = route.legs[0];

    const distanceInKm = leg.distance.value / 1000;
    const duration = leg.duration.text;

    // ✅ Count tolls (if "toll" is mentioned in step instructions)
    const tollCount = leg.steps.filter(step =>
      step.html_instructions.toLowerCase().includes("toll")
    ).length;

    return {
      distance: distanceInKm,
      duration,
      tollCount,
    };
  } catch (error) {
    console.error("Error fetching directions from Google Maps:", error);
    throw error;
  }
};

module.exports = getDistance;

