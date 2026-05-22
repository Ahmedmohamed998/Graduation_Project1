const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(to, message) {
  return client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
    body: message,
  });
}

module.exports = { sendSMS };
