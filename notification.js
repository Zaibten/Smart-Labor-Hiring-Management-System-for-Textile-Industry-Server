// notification.js
const fetch = require("node-fetch");

// Store Expo push tokens (in production, you'd store these in a database)
let expoPushTokens = [];

/**
 * Send a push notification via Expo's push notification service
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
 * Send notification to multiple devices (batch)
 */
async function sendBatchNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log("❌ No tokens provided for batch notification");
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
      console.log(`✅ Batch notification sent to ${tokens.length} devices`);
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

// ─────────────────────────────────────────────
// 1. NEW JOB POSTED → notify all Labour users
// ─────────────────────────────────────────────
async function notifyLabourUsersAboutNewJob(labourUsers, job) {
  if (!labourUsers || labourUsers.length === 0) {
    console.log("⚠️ No labour users to notify");
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
    screen: "JobDetails",
  };

  const validTokens = labourUsers
    .filter((u) => u.expoPushToken && u.expoPushToken !== "")
    .map((u) => u.expoPushToken);

  if (validTokens.length === 0) {
    console.log("⚠️ No valid push tokens found among labour users");
    return { successCount: 0, failCount: 0 };
  }

  console.log(`📨 Notifying ${validTokens.length} labour users about new job`);
  return await sendBatchNotifications(validTokens, title, body, data);
}

// ─────────────────────────────────────────────
// 2. JOB APPLICATION SUBMITTED → notify Contractor
// ─────────────────────────────────────────────
async function notifyContractorAboutApplication(contractorToken, labour, job) {
  if (!contractorToken) {
    console.log("⚠️ Contractor has no push token, skipping notification");
    return false;
  }

  const title = "👷 New Job Application!";
  const body = `${labour.firstName} ${labour.lastName} applied for "${job.title}"`;
  const data = {
    type: "job_application",
    jobId: job._id.toString(),
    jobTitle: job.title,
    labourEmail: labour.email,
    labourName: `${labour.firstName} ${labour.lastName}`,
    screen: "ApplicationDetails",
  };

  console.log(`📨 Notifying contractor about application on job: ${job.title}`);
  return await sendPushNotification(contractorToken, title, body, data);
}

// ─────────────────────────────────────────────
// 3. APPLICATION STATUS CHANGED → notify Labour
// ─────────────────────────────────────────────
async function notifyLabourAboutApplicationStatus(labourToken, job, status) {
  if (!labourToken) {
    console.log("⚠️ Labour has no push token, skipping notification");
    return false;
  }

  const isAccepted = status === "accepted";
  const title = isAccepted
    ? "✅ Application Accepted!"
    : "❌ Application Rejected";
  const body = isAccepted
    ? `Congratulations! Your application for "${job.title}" has been accepted.`
    : `Your application for "${job.title}" was not selected this time.`;

  const data = {
    type: "application_status",
    jobId: job._id.toString(),
    jobTitle: job.title,
    status,
    screen: "MyApplications",
  };

  console.log(`📨 Notifying labour about application status: ${status}`);
  return await sendPushNotification(labourToken, title, body, data);
}

// ─────────────────────────────────────────────
// 4. BORROW REQUEST RECEIVED → notify target Industry
// ─────────────────────────────────────────────
async function notifyIndustryAboutBorrowRequest(
  industryToken,
  fromEmail,
  borrow,
) {
  if (!industryToken) {
    console.log("⚠️ Target industry has no push token, skipping");
    return false;
  }

  const title = "🔄 New Borrow Request!";
  const body = `${fromEmail} wants to borrow ${borrow.labourRequired} worker(s) — Skills: ${borrow.skills}`;
  const data = {
    type: "borrow_request",
    borrowId: borrow._id.toString(),
    fromEmail,
    labourRequired: borrow.labourRequired?.toString(),
    skills: borrow.skills,
    screen: "IncomingBorrows",
  };

  console.log(`📨 Notifying industry about borrow request from: ${fromEmail}`);
  return await sendPushNotification(industryToken, title, body, data);
}

// ─────────────────────────────────────────────
// 5. BORROW REQUEST APPROVED → notify requester Industry
// ─────────────────────────────────────────────
async function notifyIndustryAboutBorrowApproval(requesterToken, borrow) {
  if (!requesterToken) {
    console.log("⚠️ Requester industry has no push token, skipping");
    return false;
  }

  const title = "✅ Borrow Request Approved!";
  const body = `Your borrow request to ${borrow.toIndustryEmail} for ${borrow.labourRequired} worker(s) has been approved!`;
  const data = {
    type: "borrow_approved",
    borrowId: borrow._id.toString(),
    toIndustryEmail: borrow.toIndustryEmail,
    screen: "MyBorrows",
  };

  console.log(`📨 Notifying industry about borrow approval`);
  return await sendPushNotification(requesterToken, title, body, data);
}

// ─────────────────────────────────────────────
// 6. NEW CHAT MESSAGE → notify receiver
// ─────────────────────────────────────────────
async function sendChatNotification(
  receiverToken,
  senderName,
  message,
  additionalData = {},
) {
  if (!receiverToken) {
    console.log("⚠️ Receiver has no push token, skipping chat notification");
    return false;
  }

  const title = "💬 New Message";
  const body = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;
  const data = {
    type: "new_chat_message",
    senderName,
    senderEmail: additionalData.senderEmail || "",
    chatWith: additionalData.senderEmail || "",
    screen: "ChatScreen",
    ...additionalData,
  };

  console.log(`📨 Sending chat notification from ${senderName}`);
  return await sendPushNotification(receiverToken, title, body, data);
}

// ─────────────────────────────────────────────
// 7. REVIEW ADDED → notify the reviewed user
// ─────────────────────────────────────────────
async function notifyUserAboutNewReview(
  userToken,
  reviewerEmail,
  rating,
  jobTitle,
) {
  if (!userToken) {
    console.log("⚠️ User has no push token, skipping review notification");
    return false;
  }

  const stars = "⭐".repeat(Math.round(rating));
  const title = "⭐ New Review Received!";
  const body = `${reviewerEmail} gave you ${stars} (${rating}/5)${jobTitle ? ` for "${jobTitle}"` : ""}`;
  const data = {
    type: "new_review",
    reviewerEmail,
    rating: rating.toString(),
    screen: "Profile",
  };

  console.log(`📨 Notifying user about new review from: ${reviewerEmail}`);
  return await sendPushNotification(userToken, title, body, data);
}

// ─────────────────────────────────────────────
// 8. SERVER START (existing)
// ─────────────────────────────────────────────
async function sendServerStartNotification() {
  console.log(
    "🚀 Server started. Push token list has",
    expoPushTokens.length,
    "entries.",
  );

  if (expoPushTokens.length === 0) {
    console.log("⚠️ No registered tokens. Skipping server start notification.");
    return;
  }

  const currentTime = new Date().toLocaleString();
  await sendBatchNotifications(
    getAllTokens(),
    "🟢 Server Started",
    `Server started at ${currentTime}`,
  );
}

// ─────────────────────────────────────────────
// Token management helpers
// ─────────────────────────────────────────────
function registerPushToken(token, userId = null) {
  if (!token) return false;
  const existing = expoPushTokens.find((t) => t.token === token);
  if (!existing) {
    expoPushTokens.push({ token, userId, registeredAt: new Date() });
    console.log(`✅ Registered push token: ${token.substring(0, 20)}...`);
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
  // Job notifications
  notifyLabourUsersAboutNewJob,
  notifyContractorAboutApplication,
  notifyLabourAboutApplicationStatus,
  // Borrow notifications
  notifyIndustryAboutBorrowRequest,
  notifyIndustryAboutBorrowApproval,
  // Chat
  sendChatNotification,
  // Review
  notifyUserAboutNewReview,
};
