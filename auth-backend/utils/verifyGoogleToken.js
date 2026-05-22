const { OAuth2Client } = require("google-auth-library");

const allowedClients = process.env.GOOGLE_CLIENT_IDS.split(",").map(id => id.trim());
const client = new OAuth2Client();

async function verifyGoogleToken(idToken) {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: allowedClients   // ← multiple supported
    });

    const payload = ticket.getPayload();

    return {
      success: true,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      googleId: payload.sub
    };

  } catch (error) {
    return {
      success: false,
      message: "Invalid Google token",
      error: error.message
    };
  }
}

module.exports = verifyGoogleToken;
