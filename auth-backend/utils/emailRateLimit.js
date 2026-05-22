const EmailRateLimit = require("../models/EmailRateLimit");

const LIMITS = {
  maxPerMinute: 1,     // 1 request per 60s
  maxPerHour: 3,       // 3 requests / hour
  maxPerDay: 10,       // 10 per 24h
  blockThreshold: 8,   // 8 requests in 5 minutes = suspicious
  blockDuration: 60 * 60 * 1000 // 1 hour
};

exports.checkEmailRateLimit = async (email, ip) => {
  const now = new Date();
  const oneMinute = new Date(now - 60 * 1000);
  const oneHour = new Date(now - 60 * 60 * 1000);
  const oneDay = new Date(now - 24 * 60 * 60 * 1000);
  const fiveMinutes = new Date(now - 5 * 60 * 1000);

  let record = await EmailRateLimit.findOne({ email });

  if (!record) {
    record = await EmailRateLimit.create({
      email,
      ip,
      attempts: 1,
      lastAttempt: now
    });
    return { allowed: true };
  }

  // Blocked?
  if (record.blockedUntil && record.blockedUntil > now) {
    return {
      allowed: false,
      reason: "Email temporarily blocked due to suspicious activity."
    };
  }

  // Suspicious? Too many in 5 min?
  if (record.lastAttempt >= fiveMinutes && record.attempts >= LIMITS.blockThreshold) {
    record.blockedUntil = new Date(now.getTime() + LIMITS.blockDuration);
    await record.save();
    return {
      allowed: false,
      reason: "Blocked for 1 hour due to excessive requests."
    };
  }

  // Too many per minute?
  const perMinute = await EmailRateLimit.countDocuments({
    email,
    lastAttempt: { $gte: oneMinute }
  });

  if (perMinute >= LIMITS.maxPerMinute) {
    return {
      allowed: false,
      reason: "Wait 60 seconds before requesting another email."
    };
  }

  // Too many per hour?
  const perHour = await EmailRateLimit.countDocuments({
    email,
    lastAttempt: { $gte: oneHour }
  });

  if (perHour >= LIMITS.maxPerHour) {
    return {
      allowed: false,
      reason: "Too many requests this hour."
    };
  }

  // Too many per day?
  const perDay = await EmailRateLimit.countDocuments({
    email,
    lastAttempt: { $gte: oneDay }
  });

  if (perDay >= LIMITS.maxPerDay) {
    return {
      allowed: false,
      reason: "Too many requests today."
    };
  }

  // Update record
  record.attempts += 1;
  record.lastAttempt = now;
  await record.save();

  return { allowed: true };
};
