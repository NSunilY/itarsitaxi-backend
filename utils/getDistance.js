const { Client } = require("@googlemaps/google-maps-services-js");
require("dotenv").config();

const client = new Client({});

const getDistance = async (origin, destination) => {
  try {
    const response = await client.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
      timeout: 1000, // milliseconds
    });

    const distance = response.data.rows[0].elements[0].distance.text;
    const duration = response.data.rows[0].elements[0].duration.text;

    return { distance, duration };
  } catch (error) {
    console.error("Error fetching distance from Google Maps:", error);
    throw error;
  }
};

module.exports = getDistance;

