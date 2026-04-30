// notification.js
const fetch = require("node-fetch");

// Store Expo push tokens (in production, you'd store these in a database)
let expoPushTokens = [];

/**
 * Send a push notification via Expo's push notification service
 * @param {string} expoPushToken - The Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 */
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) {
    console.log("❌ No Expo push token provided");
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: "default",
    title: title,
    body: body,
    data: data,
    priority: "high",
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Notification sent successfully!");
      return true;
    } else {
      console.error("❌ Failed to send notification:", result);
      return false;
    }
  } catch (error) {
    console.error("❌ Error sending notification:", error.message);
    return false;
  }
}

/**
 * Send notification to multiple devices
 * @param {array} tokens - Array of Expo push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data
 */
async function sendBatchNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log("❌ No tokens provided for batch notification");
    return { successCount: 0, failCount: 0 };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: title,
    body: body,
    data: data,
    priority: "high",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Sent notifications to ${tokens.length} devices`);
      return { successCount: tokens.length, failCount: 0, result };
    } else {
      console.error("❌ Failed to send batch notifications:", result);
      return { successCount: 0, failCount: tokens.length, error: result };
    }
  } catch (error) {
    console.error("❌ Error sending batch notifications:", error.message);
    return { successCount: 0, failCount: tokens.length, error: error.message };
  }
}

/**
 * Notify all labour users about a new job
 * @param {Array} labourUsers - Array of labour user objects with expoPushToken
 * @param {Object} job - The job object that was created
 * @returns {Object} Result with successCount and failCount
 */
async function notifyLabourUsersAboutNewJob(labourUsers, job) {
  if (!labourUsers || labourUsers.length === 0) {
    console.log("⚠️ No labour users to notify");
    return { successCount: 0, failCount: 0 };
  }

  // Prepare notification message
  const notificationTitle = "🆕 New Job Posted!";
  const notificationBody = `${job.skill} worker needed in ${job.location} | Budget: Rs.${job.budget}`;

  const notificationData = {
    jobId: job._id.toString(),
    title: job.title,
    location: job.location,
    budget: job.budget.toString(),
    skill: job.skill,
    type: "new_job",
    screen: "JobDetails",
  };

  // Collect all valid tokens
  const validTokens = labourUsers
    .filter(
      (user) =>
        user.expoPushToken &&
        user.expoPushToken !== null &&
        user.expoPushToken !== "",
    )
    .map((user) => user.expoPushToken);

  if (validTokens.length === 0) {
    console.log("⚠️ No valid push tokens found among labour users");
    return { successCount: 0, failCount: 0 };
  }

  console.log(`📨 Sending notifications to ${validTokens.length} labour users`);

  // Send batch notification
  const result = await sendBatchNotifications(
    validTokens,
    notificationTitle,
    notificationBody,
    notificationData,
  );

  return result;
}

/**
 * Register a new Expo push token
 * @param {string} token - Expo push token to register
 * @param {string} userId - Optional user ID to associate with token
 */
function registerPushToken(token, userId = null) {
  if (!token) return false;

  // Check if token already exists
  const existingToken = expoPushTokens.find((t) => t.token === token);

  if (!existingToken) {
    expoPushTokens.push({
      token: token,
      userId: userId,
      registeredAt: new Date(),
    });
    console.log(`✅ Registered new push token: ${token.substring(0, 20)}...`);
  } else {
    console.log(`ℹ️ Token already registered`);
  }

  return true;
}

/**
 * Get all registered tokens
 */
function getAllTokens() {
  return expoPushTokens.map((t) => t.token);
}

/**
 * Send server start notification
 */
async function sendServerStartNotification() {
  console.log("🚀 Sending server start notification...");

  if (expoPushTokens.length === 0) {
    console.log(
      "⚠️ No registered tokens found. Add a token first using registerPushToken()",
    );
    console.log(
      '📝 Example: registerPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")',
    );
    return;
  }

  const currentTime = new Date().toLocaleString();
  await sendBatchNotifications(
    getAllTokens(),
    "🟢 Server Started",
    `Server has been successfully started at ${currentTime}`,
  );
}

// Export all functions
module.exports = {
  sendPushNotification,
  sendBatchNotifications,
  registerPushToken,
  getAllTokens,
  sendServerStartNotification,
  notifyLabourUsersAboutNewJob, // Add this new function to exports
};
