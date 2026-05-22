const admin = require('firebase-admin');
const path  = require('path');
const logger = require('./logger');

// Path to the service-account JSON.
// In Docker the env var points to the bind-mounted file (/app/firebase-adminsdk.json).
// For local development it falls back to the relative path one level above home-backend.
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(
      __dirname,
      '../../hasibha-notificatio-firebase-adminsdk-fbsvc-ac5586ab12.json'
    );

let _initialized = false;

/**
 * Initialize Firebase Admin SDK (idempotent — safe to call multiple times).
 * Returns the admin instance so callers can use admin.messaging(), etc.
 */
function initFirebase() {
  if (_initialized || admin.apps.length > 0) {
    return admin;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
    });
    _initialized = true;
    logger.info('✅ Firebase Admin SDK initialized successfully');
  } catch (err) {
    logger.error('❌ Firebase Admin SDK initialization failed:', err.message);
    throw err;
  }

  return admin;
}

module.exports = { initFirebase, admin };
