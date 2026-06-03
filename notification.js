// // notification.js
// const fetch = require("node-fetch");

// // Store Expo push tokens (in production, you'd store these in a database)
// let expoPushTokens = [];

// /**
//  * Send a push notification via Expo's push notification service
//  */
// async function sendPushNotification(expoPushToken, title, body, data = {}) {
//   if (!expoPushToken) {
//     console.log("❌ No Expo push token provided");
//     return false;
//   }

//   const message = {
//     to: expoPushToken,
//     sound: "default",
//     title,
//     body,
//     data,
//     priority: "high",
//   };

//   try {
//     const response = await fetch("https://exp.host/--/api/v2/push/send", {
//       method: "POST",
//       headers: {
//         Accept: "application/json",
//         "Accept-encoding": "gzip, deflate",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(message),
//     });

//     const result = await response.json();

//     if (response.ok) {
//       console.log("✅ Push notification sent successfully!");
//       return true;
//     } else {
//       console.error("❌ Failed to send notification:", result);
//       return false;
//     }
//   } catch (error) {
//     console.error("❌ Error sending notification:", error.message);
//     return false;
//   }
// }

// /**
//  * Send notification to multiple devices (batch)
//  */
// async function sendBatchNotifications(tokens, title, body, data = {}) {
//   if (!tokens || tokens.length === 0) {
//     console.log("❌ No tokens provided for batch notification");
//     return { successCount: 0, failCount: 0 };
//   }

//   const messages = tokens.map((token) => ({
//     to: token,
//     sound: "default",
//     title,
//     body,
//     data,
//     priority: "high",
//   }));

//   try {
//     const response = await fetch("https://exp.host/--/api/v2/push/send", {
//       method: "POST",
//       headers: {
//         Accept: "application/json",
//         "Accept-encoding": "gzip, deflate",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(messages),
//     });

//     const result = await response.json();

//     if (response.ok) {
//       console.log(`✅ Batch notification sent to ${tokens.length} devices`);
//       return { successCount: tokens.length, failCount: 0, result };
//     } else {
//       console.error("❌ Failed to send batch notifications:", result);
//       return { successCount: 0, failCount: tokens.length, error: result };
//     }
//   } catch (error) {
//     console.error("❌ Error sending batch notifications:", error.message);
//     return { successCount: 0, failCount: tokens.length, error: error.message };
//   }
// }

// // ─────────────────────────────────────────────
// // 1. NEW JOB POSTED → notify all Labour users
// // ─────────────────────────────────────────────
// async function notifyLabourUsersAboutNewJob(labourUsers, job) {
//   if (!labourUsers || labourUsers.length === 0) {
//     console.log("⚠️ No labour users to notify");
//     return { successCount: 0, failCount: 0 };
//   }

//   const title = "🆕 New Job Posted!";
//   const body = `${job.skill} worker needed in ${job.location} | Budget: Rs.${job.budget}`;
//   const data = {
//     jobId: job._id.toString(),
//     title: job.title,
//     location: job.location,
//     budget: job.budget.toString(),
//     skill: job.skill,
//     type: "new_job",
//     screen: "JobDetails",
//   };

//   const validTokens = labourUsers
//     .filter((u) => u.expoPushToken && u.expoPushToken !== "")
//     .map((u) => u.expoPushToken);

//   if (validTokens.length === 0) {
//     console.log("⚠️ No valid push tokens found among labour users");
//     return { successCount: 0, failCount: 0 };
//   }

//   console.log(`📨 Notifying ${validTokens.length} labour users about new job`);
//   return await sendBatchNotifications(validTokens, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 2. JOB APPLICATION SUBMITTED → notify Contractor
// // ─────────────────────────────────────────────
// async function notifyContractorAboutApplication(contractorToken, labour, job) {
//   if (!contractorToken) {
//     console.log("⚠️ Contractor has no push token, skipping notification");
//     return false;
//   }

//   const title = "👷 New Job Application!";
//   const body = `${labour.firstName} ${labour.lastName} applied for "${job.title}"`;
//   const data = {
//     type: "job_application",
//     jobId: job._id.toString(),
//     jobTitle: job.title,
//     labourEmail: labour.email,
//     labourName: `${labour.firstName} ${labour.lastName}`,
//     screen: "ApplicationDetails",
//   };

//   console.log(`📨 Notifying contractor about application on job: ${job.title}`);
//   return await sendPushNotification(contractorToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 3. APPLICATION STATUS CHANGED → notify Labour
// // ─────────────────────────────────────────────
// async function notifyLabourAboutApplicationStatus(labourToken, job, status) {
//   if (!labourToken) {
//     console.log("⚠️ Labour has no push token, skipping notification");
//     return false;
//   }

//   const isAccepted = status === "accepted";
//   const title = isAccepted
//     ? "✅ Application Accepted!"
//     : "❌ Application Rejected";
//   const body = isAccepted
//     ? `Congratulations! Your application for "${job.title}" has been accepted.`
//     : `Your application for "${job.title}" was not selected this time.`;

//   const data = {
//     type: "application_status",
//     jobId: job._id.toString(),
//     jobTitle: job.title,
//     status,
//     screen: "MyApplications",
//   };

//   console.log(`📨 Notifying labour about application status: ${status}`);
//   return await sendPushNotification(labourToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 4. BORROW REQUEST RECEIVED → notify target Industry
// // ─────────────────────────────────────────────
// async function notifyIndustryAboutBorrowRequest(
//   industryToken,
//   fromEmail,
//   borrow,
// ) {
//   if (!industryToken) {
//     console.log("⚠️ Target industry has no push token, skipping");
//     return false;
//   }

//   const title = "🔄 New Borrow Request!";
//   const body = `${fromEmail} wants to borrow ${borrow.labourRequired} worker(s) — Skills: ${borrow.skills}`;
//   const data = {
//     type: "borrow_request",
//     borrowId: borrow._id.toString(),
//     fromEmail,
//     labourRequired: borrow.labourRequired?.toString(),
//     skills: borrow.skills,
//     screen: "IncomingBorrows",
//   };

//   console.log(`📨 Notifying industry about borrow request from: ${fromEmail}`);
//   return await sendPushNotification(industryToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 5. BORROW REQUEST APPROVED → notify requester Industry
// // ─────────────────────────────────────────────
// async function notifyIndustryAboutBorrowApproval(requesterToken, borrow) {
//   if (!requesterToken) {
//     console.log("⚠️ Requester industry has no push token, skipping");
//     return false;
//   }

//   const title = "✅ Borrow Request Approved!";
//   const body = `Your borrow request to ${borrow.toIndustryEmail} for ${borrow.labourRequired} worker(s) has been approved!`;
//   const data = {
//     type: "borrow_approved",
//     borrowId: borrow._id.toString(),
//     toIndustryEmail: borrow.toIndustryEmail,
//     screen: "MyBorrows",
//   };

//   console.log(`📨 Notifying industry about borrow approval`);
//   return await sendPushNotification(requesterToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 6. NEW CHAT MESSAGE → notify receiver
// // ─────────────────────────────────────────────
// async function sendChatNotification(
//   receiverToken,
//   senderName,
//   message,
//   additionalData = {},
// ) {
//   if (!receiverToken) {
//     console.log("⚠️ Receiver has no push token, skipping chat notification");
//     return false;
//   }

//   const title = "💬 New Message";
//   const body = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;
//   const data = {
//     type: "new_chat_message",
//     senderName,
//     senderEmail: additionalData.senderEmail || "",
//     chatWith: additionalData.senderEmail || "",
//     screen: "ChatScreen",
//     ...additionalData,
//   };

//   console.log(`📨 Sending chat notification from ${senderName}`);
//   return await sendPushNotification(receiverToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 7. REVIEW ADDED → notify the reviewed user
// // ─────────────────────────────────────────────
// async function notifyUserAboutNewReview(
//   userToken,
//   reviewerEmail,
//   rating,
//   jobTitle,
// ) {
//   if (!userToken) {
//     console.log("⚠️ User has no push token, skipping review notification");
//     return false;
//   }

//   const stars = "⭐".repeat(Math.round(rating));
//   const title = "⭐ New Review Received!";
//   const body = `${reviewerEmail} gave you ${stars} (${rating}/5)${jobTitle ? ` for "${jobTitle}"` : ""}`;
//   const data = {
//     type: "new_review",
//     reviewerEmail,
//     rating: rating.toString(),
//     screen: "Profile",
//   };

//   console.log(`📨 Notifying user about new review from: ${reviewerEmail}`);
//   return await sendPushNotification(userToken, title, body, data);
// }

// // ─────────────────────────────────────────────
// // 8. SERVER START (existing)
// // ─────────────────────────────────────────────
// async function sendServerStartNotification() {
//   console.log(
//     "🚀 Server started. Push token list has",
//     expoPushTokens.length,
//     "entries.",
//   );

//   if (expoPushTokens.length === 0) {
//     console.log("⚠️ No registered tokens. Skipping server start notification.");
//     return;
//   }

//   const currentTime = new Date().toLocaleString();
//   await sendBatchNotifications(
//     getAllTokens(),
//     "🟢 Server Started",
//     `Server started at ${currentTime}`,
//   );
// }

// // ─────────────────────────────────────────────
// // Token management helpers
// // ─────────────────────────────────────────────
// function registerPushToken(token, userId = null) {
//   if (!token) return false;
//   const existing = expoPushTokens.find((t) => t.token === token);
//   if (!existing) {
//     expoPushTokens.push({ token, userId, registeredAt: new Date() });
//     console.log(`✅ Registered push token: ${token.substring(0, 20)}...`);
//   }
//   return true;
// }

// function getAllTokens() {
//   return expoPushTokens.map((t) => t.token);
// }

// module.exports = {
//   sendPushNotification,
//   sendBatchNotifications,
//   registerPushToken,
//   getAllTokens,
//   sendServerStartNotification,
//   // Job notifications
//   notifyLabourUsersAboutNewJob,
//   notifyContractorAboutApplication,
//   notifyLabourAboutApplicationStatus,
//   // Borrow notifications
//   notifyIndustryAboutBorrowRequest,
//   notifyIndustryAboutBorrowApproval,
//   // Chat
//   sendChatNotification,
//   // Review
//   notifyUserAboutNewReview,
// };

// notification.js
const fetch = require("node-fetch");
const Pusher = require("pusher");

// Initialize Pusher with your credentials
const pusher = new Pusher({
  appId: "2162066",
  key: "640d90118e27570b7dc4",
  secret: "e5be248b526198858ac6",
  cluster: "ap2",
  useTLS: true,
});

// Store Expo push tokens (in production, you'd store these in a database)
let expoPushTokens = [];

// ─────────────────────────────────────────────
// PUSHER HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Send a real-time Pusher notification to a specific channel
 */
async function sendPusherNotification(channel, event, data) {
  try {
    pusher.trigger(channel, event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
    console.log(
      `✅ Pusher notification sent to channel: ${channel}, event: ${event}`,
    );
    return true;
  } catch (error) {
    console.error("❌ Pusher notification error:", error);
    return false;
  }
}

/**
 * Send real-time job notification to all labour users
 */
async function sendPusherJobNotification(job, action = "new_job") {
  const channel = "labour-jobs";
  const event = "job-update";
  const data = {
    action,
    jobId: job._id.toString(),
    title: job.title,
    location: job.location,
    budget: job.budget,
    skill: job.skill,
    description: job.description,
    workersRequired: job.workersRequired,
    startDate: job.startDate,
    endDate: job.endDate,
    shift: job.shift,
    contact: job.contact,
    createdBy: {
      name: `${job.createdBy.firstName} ${job.createdBy.lastName}`,
      email: job.createdBy.email,
    },
    createdAt: new Date().toISOString(),
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send real-time application notification to contractor
 */
async function sendPusherApplicationNotification(
  job,
  labour,
  status = "applied",
) {
  const channel = `contractor-${job.createdBy.userId}`;
  const event = "application-update";
  const data = {
    action: status,
    jobId: job._id.toString(),
    jobTitle: job.title,
    labour: {
      id: labour._id?.toString(),
      name: `${labour.firstName} ${labour.lastName}`,
      email: labour.email,
      skills: labour.skills || [],
    },
    appliedAt: new Date().toISOString(),
    status,
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send real-time status update notification to labour
 */
async function sendPusherStatusNotification(job, labourId, status) {
  const channel = `labour-${labourId}`;
  const event = "application-status";
  const data = {
    action: "status_update",
    jobId: job._id.toString(),
    jobTitle: job.title,
    status,
    updatedAt: new Date().toISOString(),
    message:
      status === "accepted"
        ? `Congratulations! Your application for "${job.title}" has been accepted.`
        : `Your application for "${job.title}" has been ${status}.`,
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send real-time borrow request notification
 */
async function sendPusherBorrowNotification(borrow, action = "new_request") {
  const channel = `industry-${borrow.toIndustryEmail}`;
  const event = "borrow-update";
  const data = {
    action,
    borrowId: borrow._id.toString(),
    fromIndustry: borrow.fromIndustryEmail,
    labourRequired: borrow.labourRequired,
    skills: borrow.skills,
    description: borrow.description,
    date: borrow.date,
    time: borrow.time,
    location: borrow.location,
    status: borrow.status,
    createdAt: new Date().toISOString(),
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send real-time chat message notification
 */
async function sendPusherChatNotification(
  receiverId,
  senderInfo,
  message,
  chatId,
) {
  const channel = `chat-${receiverId}`;
  const event = "new-message";
  const data = {
    messageId: Date.now().toString(),
    chatId,
    sender: {
      id: senderInfo.id,
      name: `${senderInfo.firstName} ${senderInfo.lastName}`,
      email: senderInfo.email,
      image: senderInfo.image,
    },
    message: message.substring(0, 500),
    timestamp: new Date().toISOString(),
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send real-time review notification
 */
async function sendPusherReviewNotification(userId, reviewData) {
  const channel = `user-${userId}`;
  const event = "new-review";
  const data = {
    reviewerEmail: reviewData.reviewerEmail,
    rating: reviewData.rating,
    feedback: reviewData.feedback || "",
    jobTitle: reviewData.jobTitle || null,
    createdAt: new Date().toISOString(),
  };

  return await sendPusherNotification(channel, event, data);
}

/**
 * Send server start notification via Pusher (broadcast)
 */
async function sendPusherServerStartNotification() {
  const channel = "system-notifications";
  const event = "server-status";
  const data = {
    action: "server_started",
    message: "Server has started successfully",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  return await sendPusherNotification(channel, event, data);
}

// ─────────────────────────────────────────────
// EXPO PUSH NOTIFICATION FUNCTIONS (existing)
// ─────────────────────────────────────────────

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
      console.log("✅ Expo push notification sent successfully!");
      return true;
    } else {
      console.error("❌ Failed to send Expo notification:", result);
      return false;
    }
  } catch (error) {
    console.error("❌ Error sending Expo notification:", error.message);
    return false;
  }
}

/**
 * Send batch Expo push notifications
 */
async function sendBatchPushNotifications(tokens, title, body, data = {}) {
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
      console.log(
        `✅ Batch Expo notification sent to ${tokens.length} devices`,
      );
      return { successCount: tokens.length, failCount: 0, result };
    } else {
      console.error("❌ Failed to send batch Expo notifications:", result);
      return { successCount: 0, failCount: tokens.length, error: result };
    }
  } catch (error) {
    console.error("❌ Error sending batch Expo notifications:", error.message);
    return { successCount: 0, failCount: tokens.length, error: error.message };
  }
}

// ─────────────────────────────────────────────
// COMBINED NOTIFICATION FUNCTIONS (Expo + Pusher)
// ─────────────────────────────────────────────

/**
 * 1. NEW JOB POSTED → notify all Labour users (Expo + Pusher)
 */
async function notifyLabourUsersAboutNewJob(labourUsers, job) {
  // Send Pusher real-time notification (for all connected clients)
  await sendPusherJobNotification(job, "new_job");

  // Send Expo push notifications (for mobile devices)
  if (!labourUsers || labourUsers.length === 0) {
    console.log("⚠️ No labour users to notify via Expo");
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

  console.log(
    `📨 Notifying ${validTokens.length} labour users via Expo about new job`,
  );
  return await sendBatchPushNotifications(validTokens, title, body, data);
}

/**
 * 2. JOB APPLICATION SUBMITTED → notify Contractor (Expo + Pusher)
 */
async function notifyContractorAboutApplication(contractorToken, labour, job) {
  // Send Pusher real-time notification
  await sendPusherApplicationNotification(job, labour, "applied");

  // Send Expo push notification
  if (!contractorToken) {
    console.log("⚠️ Contractor has no push token, skipping Expo notification");
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

  console.log(
    `📨 Notifying contractor via Expo about application on job: ${job.title}`,
  );
  return await sendPushNotification(contractorToken, title, body, data);
}

/**
 * 3. APPLICATION STATUS CHANGED → notify Labour (Expo + Pusher)
 */
async function notifyLabourAboutApplicationStatus(
  labourToken,
  job,
  status,
  labourId,
) {
  // Send Pusher real-time notification
  if (labourId) {
    await sendPusherStatusNotification(job, labourId, status);
  }

  // Send Expo push notification
  if (!labourToken) {
    console.log("⚠️ Labour has no push token, skipping Expo notification");
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

  console.log(
    `📨 Notifying labour via Expo about application status: ${status}`,
  );
  return await sendPushNotification(labourToken, title, body, data);
}

/**
 * 4. BORROW REQUEST RECEIVED → notify target Industry (Expo + Pusher)
 */
async function notifyIndustryAboutBorrowRequest(
  industryToken,
  fromEmail,
  borrow,
) {
  // Send Pusher real-time notification
  await sendPusherBorrowNotification(borrow, "new_request");

  // Send Expo push notification
  if (!industryToken) {
    console.log(
      "⚠️ Target industry has no push token, skipping Expo notification",
    );
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

  console.log(
    `📨 Notifying industry via Expo about borrow request from: ${fromEmail}`,
  );
  return await sendPushNotification(industryToken, title, body, data);
}

/**
 * 5. BORROW REQUEST APPROVED → notify requester Industry (Expo + Pusher)
 */
async function notifyIndustryAboutBorrowApproval(requesterToken, borrow) {
  // Send Pusher real-time notification
  await sendPusherBorrowNotification(borrow, "approved");

  // Send Expo push notification
  if (!requesterToken) {
    console.log(
      "⚠️ Requester industry has no push token, skipping Expo notification",
    );
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

  console.log(`📨 Notifying industry via Expo about borrow approval`);
  return await sendPushNotification(requesterToken, title, body, data);
}

/**
 * 6. NEW CHAT MESSAGE → notify receiver (Expo + Pusher)
 */
async function sendChatNotification(
  receiverToken,
  senderName,
  message,
  additionalData = {},
) {
  // Send Pusher real-time notification
  if (additionalData.receiverId) {
    await sendPusherChatNotification(
      additionalData.receiverId,
      {
        id: additionalData.senderId,
        firstName: senderName.split(" ")[0] || senderName,
        lastName: senderName.split(" ")[1] || "",
        email: additionalData.senderEmail || "",
        image: additionalData.senderImage || "",
      },
      message,
      additionalData.chatId || null,
    );
  }

  // Send Expo push notification
  if (!receiverToken) {
    console.log(
      "⚠️ Receiver has no push token, skipping Expo chat notification",
    );
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

/**
 * 7. REVIEW ADDED → notify the reviewed user (Expo + Pusher)
 */
async function notifyUserAboutNewReview(
  userToken,
  reviewerEmail,
  rating,
  jobTitle,
  userId,
) {
  // Send Pusher real-time notification
  if (userId) {
    await sendPusherReviewNotification(userId, {
      reviewerEmail,
      rating,
      jobTitle,
    });
  }

  // Send Expo push notification
  if (!userToken) {
    console.log("⚠️ User has no push token, skipping Expo review notification");
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

  console.log(
    `📨 Notifying user via Expo about new review from: ${reviewerEmail}`,
  );
  return await sendPushNotification(userToken, title, body, data);
}

/**
 * 8. SERVER START - Send notifications via both methods
 */
async function sendServerStartNotification() {
  console.log("🚀 Server started. Sending startup notifications...");

  // Send Pusher broadcast notification
  await sendPusherServerStartNotification();

  // Send Expo push notifications to registered tokens
  if (expoPushTokens.length === 0) {
    console.log(
      "⚠️ No registered Expo tokens. Skipping Expo server start notification.",
    );
    return;
  }

  const currentTime = new Date().toLocaleString();
  await sendBatchPushNotifications(
    getAllTokens(),
    "🟢 Server Started",
    `Server started at ${currentTime}`,
    { type: "server_status" },
  );
}

// ─────────────────────────────────────────────
// Token management helpers (unchanged)
// ─────────────────────────────────────────────
function registerPushToken(token, userId = null) {
  if (!token) return false;
  const existing = expoPushTokens.find((t) => t.token === token);
  if (!existing) {
    expoPushTokens.push({ token, userId, registeredAt: new Date() });
    console.log(`✅ Registered Expo push token: ${token.substring(0, 20)}...`);
  }
  return true;
}

function getAllTokens() {
  return expoPushTokens.map((t) => t.token);
}

// ─────────────────────────────────────────────
// Pusher channel subscription helpers
// ─────────────────────────────────────────────

/**
 * Get Pusher channel name for a specific user type and identifier
 */
function getPusherChannel(userType, identifier) {
  const channels = {
    labour: (labourId) => `labour-${labourId}`,
    contractor: (contractorId) => `contractor-${contractorId}`,
    industry: (industryEmail) => `industry-${industryEmail}`,
    chat: (userId) => `chat-${userId}`,
    user: (userId) => `user-${userId}`,
  };

  return channels[userType] ? channels[userType](identifier) : null;
}

/**
 * Authenticate a Pusher private channel subscription
 */
function authenticatePusherChannel(socketId, channelName, userId) {
  // This function should be called from your Express route
  // You need to verify the user is authorized to subscribe to this channel
  const authResponse = pusher.authenticate(socketId, channelName);
  return authResponse;
}

module.exports = {
  // Expo push functions
  sendPushNotification,
  sendBatchPushNotifications,
  registerPushToken,
  getAllTokens,

  // Pusher functions
  sendPusherNotification,
  sendPusherJobNotification,
  sendPusherApplicationNotification,
  sendPusherStatusNotification,
  sendPusherBorrowNotification,
  sendPusherChatNotification,
  sendPusherReviewNotification,
  sendPusherServerStartNotification,
  getPusherChannel,
  authenticatePusherChannel,

  // Combined notification functions
  sendServerStartNotification,
  notifyLabourUsersAboutNewJob,
  notifyContractorAboutApplication,
  notifyLabourAboutApplicationStatus,
  notifyIndustryAboutBorrowRequest,
  notifyIndustryAboutBorrowApproval,
  sendChatNotification,
  notifyUserAboutNewReview,
};
