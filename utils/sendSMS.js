// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (number, message) => {
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        message,
        language: 'english',
        route: 'q',
        numbers: Array.isArray(number) ? number.join(',') : number,
      },
      {
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.return === true) {
      console.log(`✅ SMS sent to ${number}:`, response.data);
    } else {
      console.error(`❌ SMS failed for ${number}:`, response.data);
    }
  } catch (error) {
    console.error(`❌ SMS sending failed to ${number}:`, error.response?.data || error.message);
  }
};

module.exports = sendSMS;

