// utils/sendSMS.js
const axios = require('axios');
require('dotenv').config();

const sendSMS = async (to, message) => {
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'q',
        message,
        language: 'english',
        numbers: to,
      },
      {
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('SMS sending failed:', error.response?.data || error.message);
    throw new Error('Failed to send SMS');
  }
};

module.exports = sendSMS;

