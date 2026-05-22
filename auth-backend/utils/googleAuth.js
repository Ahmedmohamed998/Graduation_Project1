const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client();

const allowedClientIds = process.env.GOOGLE_CLIENT_IDS
  .split(",")
  .map(id => id.trim());

async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: allowedClientIds,
  });

  return ticket.getPayload();
}

module.exports = { verifyGoogleToken };
