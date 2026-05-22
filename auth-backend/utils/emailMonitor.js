// const cron = require("node-cron");
// const EmailLog = require("../models/EmailLog");
// const logger = require("./logger");

// function startEmailMonitor() {
//   // runs every 5 minutes
//   cron.schedule("*/5 * * * *", async () => {
//     try {
//       const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
//       const recentFailures = await EmailLog.countDocuments({ createdAt: { $gte: fiveMinsAgo }, status: "failed" });

//       if (recentFailures > 20) { // threshold example
//         logger.warn("Email failure spike detected", { recentFailures });
//         // optionally call webhook or send admin email
//       }

//       // detect repeated sends to single address
//       const pipeline = [
//         { $match: { createdAt: { $gte: new Date(Date.now() - 60*60*1000) } } },
//         { $group: { _id: "$email", count: { $sum: 1 } } },
//         { $match: { count: { $gte: 10 } } } // more than 10 sends in last hour
//       ];
//       const spikes = await EmailLog.aggregate(pipeline);
//       if (spikes.length) {
//         logger.warn("Many emails to the same address detected", { spikes });
//         // action: add to block list, notify admin, etc.
//       }
//     } catch (err) {
//       logger.error("emailMonitor error", { error: err.message });
//     }
//   });
// }

// module.exports = { startEmailMonitor };















// utils/emailMonitor.js

const cron = require("node-cron");
const EmailLog = require("../models/EmailLog");
const logger = require("./logger");

// Only start once (prevents double-starting in dev with hot reload)
let isRunning = false;

function startEmailMonitor() {
  if (isRunning) {
    logger.info("Email monitor already running. Skipping duplicate start.");
    return;
  }

  // Run every 5 minutes
  const job = cron.schedule("*/5 * * * *", async () => {
    try {
      const now = Date.now();
      const fiveMinsAgo = new Date(now - 5 * 60 * 1000);
      const oneHourAgo = new Date(now - 60 * 60 * 1000);

      // 1. Detect spike in failed emails
      const recentFailures = await EmailLog.countDocuments({
        createdAt: { $gte: fiveMinsAgo },
        status: "failed"
      });

      if (recentFailures > 20) {
        logger.warn("High email failure rate detected!", {
          recentFailures,
          timeWindow: "last 5 minutes",
          threshold: 20
        });

        // Optional: trigger alert (Slack, Discord, admin email, etc.)
        // await sendAlertToAdmin(`Email failure spike: ${recentFailures} failures in 5 min`);
      }

      // 2. Detect abuse: too many emails to the same address
      const abuseCandidates = await EmailLog.aggregate([
        { $match: { createdAt: { $gte: oneHourAgo } } },
        { $group: { _id: "$email", count: { $sum: 1 }, ips: { $addToSet: "$ip" } } },
        { $match: { count: { $gte: 12 } } } // 12+ emails in 1 hour = suspicious
      ]);

      if (abuseCandidates.length > 0) {
        logger.warn("Possible email abuse or brute-force detected", {
          affectedEmails: abuseCandidates.map(a => ({ email: a._id, count: a.count, uniqueIps: a.ips.length }))
        });

        // Future: auto-block email/IP temporarily
        // await blockEmailTemporarily(abuseCandidates.map(a => a._id));
      }

    } catch (err) {
      logger.error("Email monitor job failed", {
        error: err.message,
        stack: err.stack
      });
    }
  });

  // Start the cron job
  job.start();
  isRunning = true;

  logger.info("Email monitor started – running every 5 minutes");

  // Graceful shutdown handling
  const gracefulShutdown = () => {
    if (job) {
      job.stop();
      logger.info("Email monitor stopped.");
    }
    process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

module.exports = { startEmailMonitor };