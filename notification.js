// notification.js
const fetch = require("node-fetch");

let expoPushTokens = [];

/**
 * Send a push notification via Expo
 */
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) {
    console.log("❌ No Expo push token provided");
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
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
      console.log("✅ Push notification sent successfully!");
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
 * Send batch push notifications
 */
async function sendBatchNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
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
      return { successCount: tokens.length, failCount: 0, result };
    } else {
      return { successCount: 0, failCount: tokens.length, error: result };
    }
  } catch (error) {
    return { successCount: 0, failCount: tokens.length, error: error.message };
  }
}

async function notifyLabourUsersAboutNewJob(labourUsers, job) {
  if (!labourUsers || labourUsers.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  const title = "🆕 New Job Posted!";
  const body = `${job.skill} worker needed in ${job.location} | Budget: Rs.${job.budget}`;
  const data = {
    jobId: job._id.toString(),
    title: job.title,
    location: job.location,
    budget: job.budget.toString(),
    skill: job.skill,
    type: "new_job",
  };

  const validTokens = labourUsers
    .filter((u) => u.expoPushToken && u.expoPushToken !== "")
    .map((u) => u.expoPushToken);

  if (validTokens.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  return await sendBatchNotifications(validTokens, title, body, data);
}

async function notifyContractorAboutApplication(contractorToken, labour, job) {
  if (!contractorToken) return false;

  const title = "👷 New Job Application!";
  const body = `${labour.firstName} ${labour.lastName} applied for "${job.title}"`;
  const data = {
    type: "job_application",
    jobId: job._id.toString(),
    jobTitle: job.title,
    labourEmail: labour.email,
  };

  return await sendPushNotification(contractorToken, title, body, data);
}

async function notifyLabourAboutApplicationStatus(labourToken, job, status) {
  if (!labourToken) return false;

  const isAccepted = status === "accepted";
  const title = isAccepted ? "✅ Application Accepted!" : "❌ Application Rejected";
  const body = isAccepted
    ? `Congratulations! Your application for "${job.title}" has been accepted.`
    : `Your application for "${job.title}" was not selected this time.`;

  const data = {
    type: "application_status",
    jobId: job._id.toString(),
    jobTitle: job.title,
    status,
  };

  return await sendPushNotification(labourToken, title, body, data);
}

async function notifyIndustryAboutBorrowRequest(industryToken, fromEmail, borrow) {
  if (!industryToken) return false;

  const title = "🔄 New Borrow Request!";
  const body = `${fromEmail} wants to borrow ${borrow.labourRequired} worker(s) — Skills: ${borrow.skills}`;
  const data = {
    type: "borrow_request",
    borrowId: borrow._id.toString(),
    fromEmail,
  };

  return await sendPushNotification(industryToken, title, body, data);
}

async function notifyIndustryAboutBorrowApproval(requesterToken, borrow) {
  if (!requesterToken) return false;

  const title = "✅ Borrow Request Approved!";
  const body = `Your borrow request to ${borrow.toIndustryEmail} for ${borrow.labourRequired} worker(s) has been approved!`;
  const data = {
    type: "borrow_approved",
    borrowId: borrow._id.toString(),
  };

  return await sendPushNotification(requesterToken, title, body, data);
}

async function notifyUserAboutNewReview(userToken, reviewerEmail, rating, jobTitle) {
  if (!userToken) return false;

  const stars = "⭐".repeat(Math.round(rating));
  const title = "⭐ New Review Received!";
  const body = `${reviewerEmail} gave you ${stars} (${rating}/5)${jobTitle ? ` for "${jobTitle}"` : ""}`;
  const data = {
    type: "new_review",
    reviewerEmail,
    rating: rating.toString(),
  };

  return await sendPushNotification(userToken, title, body, data);
}

async function sendChatNotification(receiverToken, senderName, message, additionalData = {}) {
  if (!receiverToken) return false;

  const title = "💬 New Message";
  const body = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;
  const data = {
    type: "new_chat_message",
    senderName,
    senderEmail: additionalData.senderEmail || "",
    ...additionalData,
  };

  return await sendPushNotification(receiverToken, title, body, data);
}

async function sendServerStartNotification() {
  console.log("🚀 Server started.");
}

function registerPushToken(token, userId = null) {
  if (!token) return false;
  const existing = expoPushTokens.find((t) => t.token === token);
  if (!existing) {
    expoPushTokens.push({ token, userId, registeredAt: new Date() });
  }
  return true;
}

function getAllTokens() {
  return expoPushTokens.map((t) => t.token);
}

module.exports = {
  sendPushNotification,
  sendBatchNotifications,
  registerPushToken,
  getAllTokens,
  sendServerStartNotification,
  notifyLabourUsersAboutNewJob,
  notifyContractorAboutApplication,
  notifyLabourAboutApplicationStatus,
  notifyIndustryAboutBorrowRequest,
  notifyIndustryAboutBorrowApproval,
  sendChatNotification,
  notifyUserAboutNewReview,
};