// const express = require("express");
// const mongoose = require("mongoose");
// const router = express.Router();
// const sgMail = require("@sendgrid/mail");
// const http = require("http");
// const socketIO = require("socket.io");
// const notification = require("./notification");

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // ==================== SCHEMA ====================
// const chatSchema = new mongoose.Schema(
//   {
//     senderEmail: { type: String, required: true },
//     receiverEmail: { type: String, required: true },
//     message: { type: String, required: true },
//     timestamp: { type: Date, default: Date.now },
//     isRead: { type: Boolean, default: false },
//   },
//   { timestamps: true },
// );

// const Chat = mongoose.model("Chat", chatSchema);

// // ==================== HELPER FUNCTIONS ====================

// /**
//  * Get user by email to fetch push token
//  */
// async function getUserByEmail(email) {
//   try {
//     const User = mongoose.model("User");
//     const user = await User.findOne({ email: email.toLowerCase().trim() });
//     return user;
//   } catch (err) {
//     console.error("Error fetching user:", err);
//     return null;
//   }
// }

// // ==================== ROUTES ====================

// // Send a chat
// router.post("/send", async (req, res) => {
//   try {
//     const { senderEmail, receiverEmail, message } = req.body;
//     if (!senderEmail || !receiverEmail || !message) {
//       return res.status(400).json({ message: "All fields are required." });
//     }

//     console.log(`\n📨 New chat message received:`);
//     console.log(`   From: ${senderEmail}`);
//     console.log(`   To: ${receiverEmail}`);
//     console.log(
//       `   Message: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
//     );

//     const chat = await Chat.create({ senderEmail, receiverEmail, message });

//     // Get sender's name for notification
//     const sender = await getUserByEmail(senderEmail);
//     const senderName = sender
//       ? `${sender.firstName} ${sender.lastName}`.trim()
//       : senderEmail;

//     // Get receiver's push token
//     const receiver = await getUserByEmail(receiverEmail);
//     const receiverPushToken = receiver?.expoPushToken;

//     console.log(`\n📱 Push token status for ${receiverEmail}:`);
//     console.log(`   Token exists: ${!!receiverPushToken}`);
//     if (receiverPushToken) {
//       console.log(`   Token: ${receiverPushToken.substring(0, 30)}...`);
//     }

//     // Send push notification if receiver has a token
//     let notificationSent = false;
//     if (
//       receiverPushToken &&
//       receiverPushToken !== null &&
//       receiverPushToken !== ""
//     ) {
//       console.log(
//         `\n🔔 Attempting to send push notification to ${receiverEmail}...`,
//       );

//       const notificationTitle = "💬 New Message";
//       const notificationBody = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;

//       const notificationData = {
//         type: "new_chat_message",
//         senderEmail: senderEmail,
//         senderName: senderName,
//         messageId: chat._id.toString(),
//         message: message,
//         timestamp: chat.timestamp.toISOString(),
//         screen: "ChatScreen",
//         chatWith: senderEmail,
//       };

//       try {
//         notificationSent = await notification.sendPushNotification(
//           receiverPushToken,
//           notificationTitle,
//           notificationBody,
//           notificationData,
//         );

//         if (notificationSent) {
//           console.log(
//             `✅ Push notification sent successfully to ${receiverEmail}`,
//           );
//         } else {
//           console.log(
//             `❌ Failed to send push notification to ${receiverEmail}`,
//           );
//         }
//       } catch (pushError) {
//         console.error(`❌ Error sending push notification:`, pushError.message);
//       }
//     } else {
//       console.log(
//         `⚠️ No push token found for ${receiverEmail}. Skipping push notification.`,
//       );
//     }

//     // Send email notification
//     console.log(
//       `\n📧 Attempting to send email notification to ${receiverEmail}...`,
//     );
//     const logoUrl =
//       "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";
//     const emailData = {
//       to: receiverEmail,
//       from: process.env.SENDGRID_VERIFIED_SENDER,
//       subject: `New Message from ${senderName}`,
//       html: `
//         <div style="font-family: 'Segoe UI', sans-serif; background-color: #f5f7fa; padding: 40px 0;">
//           <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

//             <div style="background-color: #0a66c2; padding: 25px 20px; text-align: center;">
//               <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius: 50%; border: 2px solid #ffffff; margin-bottom: 10px;">
//               <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Labour Hub</h1>
//             </div>

//             <div style="padding: 30px 25px; color: #333333;">
//               <h2 style="color: #0a66c2; font-size: 20px;">New Message Received</h2>
//               <p style="font-size: 16px; line-height: 1.6;">
//                 <strong>From:</strong> ${senderName}<br>
//                 <strong>Email:</strong> ${senderEmail}<br>
//                 <strong>Message:</strong>
//               </p>
//               <div style="background-color: #f0f2f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
//                 <p style="margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
//               </div>
//               <div style="text-align: center; margin-top: 30px;">
//                 <a href="https://labourhub.pk/chat?with=${senderEmail}"
//                    style="background-color: #0a66c2; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold;">
//                   Reply Now
//                 </a>
//               </div>
//             </div>

//             <div style="background-color: #f0f2f5; text-align: center; padding: 20px; border-top: 1px solid #e1e4e8;">
//               <p style="color: #777777; font-size: 13px; margin: 0;">
//                 © ${new Date().getFullYear()} Labour Hub. All rights reserved.<br>
//                 Karachi, Pakistan
//               </p>
//             </div>
//           </div>
//         </div>
//       `,
//     };

//     let emailSent = false;
//     try {
//       await sgMail.send(emailData);
//       console.log(`✅ Email sent successfully to ${receiverEmail}`);
//       emailSent = true;
//     } catch (emailErr) {
//       console.error(
//         `❌ Error sending email to ${receiverEmail}:`,
//         emailErr.response ? emailErr.response.body : emailErr.message,
//       );
//     }

//     // Log final summary
//     console.log(`\n📊 Chat Message Summary:`);
//     console.log(`   ✅ Message saved to database (ID: ${chat._id})`);
//     console.log(
//       `   📱 Push notification: ${notificationSent ? "✅ SENT" : "❌ FAILED/SKIPPED"}`,
//     );
//     console.log(
//       `   📧 Email notification: ${emailSent ? "✅ SENT" : "❌ FAILED"}`,
//     );
//     console.log(`   👥 From: ${senderEmail}`);
//     console.log(`   👤 To: ${receiverEmail}\n`);

//     res.status(201).json({
//       success: true,
//       chat,
//       notifications: {
//         push: notificationSent,
//         email: emailSent,
//       },
//     });
//   } catch (err) {
//     console.error("❌ Error in /send route:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get all chats for a user
// router.get("/all/:email", async (req, res) => {
//   try {
//     const email = req.params.email;
//     console.log(`📋 Fetching all chats for user: ${email}`);

//     const chats = await Chat.find({
//       $or: [{ senderEmail: email }, { receiverEmail: email }],
//     }).sort({ timestamp: -1 });

//     const usersMap = {};
//     chats.forEach((chat) => {
//       const other =
//         chat.senderEmail === email ? chat.receiverEmail : chat.senderEmail;
//       if (!usersMap[other]) {
//         usersMap[other] = {
//           email: other,
//           lastMessage: chat.message,
//           timestamp: chat.timestamp,
//           isRead: chat.isRead,
//         };
//       }
//     });

//     console.log(
//       `✅ Found ${Object.values(usersMap).length} chat conversations for ${email}`,
//     );
//     res.json(Object.values(usersMap));
//   } catch (err) {
//     console.error("Error fetching chats:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get all chats between two users
// router.get("/:user1/:user2", async (req, res) => {
//   try {
//     const { user1, user2 } = req.params;
//     console.log(`💬 Fetching chat history between ${user1} and ${user2}`);

//     const chats = await Chat.find({
//       $or: [
//         { senderEmail: user1, receiverEmail: user2 },
//         { senderEmail: user2, receiverEmail: user1 },
//       ],
//     }).sort({ timestamp: 1 });

//     // Mark messages as read
//     await Chat.updateMany(
//       { receiverEmail: user1, senderEmail: user2, isRead: false },
//       { $set: { isRead: true } },
//     );

//     console.log(`✅ Found ${chats.length} messages in conversation`);
//     res.json(chats);
//   } catch (err) {
//     console.error("Error fetching chat history:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Mark messages as read
// router.post("/mark-read", async (req, res) => {
//   try {
//     const { userId, chatWith } = req.body;
//     console.log(
//       `📖 Marking messages as read: ${userId} reading from ${chatWith}`,
//     );

//     const result = await Chat.updateMany(
//       { receiverEmail: userId, senderEmail: chatWith, isRead: false },
//       { $set: { isRead: true } },
//     );

//     console.log(`✅ Marked ${result.modifiedCount} messages as read`);
//     res.json({ success: true, count: result.modifiedCount });
//   } catch (err) {
//     console.error("Error marking messages as read:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get unread message count
// router.get("/unread/:email", async (req, res) => {
//   try {
//     const email = req.params.email;
//     const count = await Chat.countDocuments({
//       receiverEmail: email,
//       isRead: false,
//     });
//     console.log(`🔔 ${email} has ${count} unread messages`);
//     res.json({ unreadCount: count });
//   } catch (err) {
//     console.error("Error getting unread count:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ==================== SOCKET.IO for Real-time Chat ====================

// // Wrap your Express app into an HTTP server
// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });

// // Keep track of connected users
// const users = {};

// io.on("connection", (socket) => {
//   console.log("🟢 New socket connected:", socket.id);

//   // Store user email on connection
//   socket.on("join", (email) => {
//     users[email] = socket.id;
//     console.log(`👤 User ${email} joined with socket ID: ${socket.id}`);
//     console.log(`📊 Currently connected users: ${Object.keys(users).length}`);
//   });

//   // Chat message with real-time delivery
//   socket.on("chat-message", async (data) => {
//     const { senderEmail, receiverEmail, message, messageId } = data;
//     console.log(`\n💬 Real-time chat message:`);
//     console.log(`   From: ${senderEmail}`);
//     console.log(`   To: ${receiverEmail}`);
//     console.log(
//       `   Message: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
//     );

//     // Get sender's name for notification
//     const User = mongoose.model("User");
//     const sender = await User.findOne({ email: senderEmail });
//     const senderName = sender
//       ? `${sender.firstName} ${sender.lastName}`.trim()
//       : senderEmail;

//     // Check if receiver is online
//     const receiverOnline = !!users[receiverEmail];
//     console.log(`   Receiver online: ${receiverOnline ? "✅ YES" : "❌ NO"}`);

//     if (receiverOnline) {
//       // Send real-time message to receiver
//       io.to(users[receiverEmail]).emit("chat-message", {
//         ...data,
//         senderName: senderName,
//         timestamp: new Date().toISOString(),
//       });
//       console.log(`✅ Real-time message sent to ${receiverEmail}`);
//     } else {
//       console.log(
//         `⚠️ Receiver offline, message will be delivered via push notification`,
//       );
//     }

//     // Send push notification regardless (for offline users)
//     const receiver = await User.findOne({ email: receiverEmail });
//     const receiverPushToken = receiver?.expoPushToken;

//     if (receiverPushToken && !receiverOnline) {
//       console.log(
//         `🔔 Sending push notification to offline user: ${receiverEmail}`,
//       );
//       const notificationTitle = "💬 New Message";
//       const notificationBody = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;

//       const notificationData = {
//         type: "new_chat_message",
//         senderEmail: senderEmail,
//         senderName: senderName,
//         messageId: messageId,
//         message: message,
//         timestamp: new Date().toISOString(),
//         screen: "ChatScreen",
//         chatWith: senderEmail,
//       };

//       try {
//         await notification.sendPushNotification(
//           receiverPushToken,
//           notificationTitle,
//           notificationBody,
//           notificationData,
//         );
//         console.log(
//           `✅ Push notification sent to offline user: ${receiverEmail}`,
//         );
//       } catch (pushError) {
//         console.error(
//           `❌ Failed to send push notification:`,
//           pushError.message,
//         );
//       }
//     }
//   });

//   // Voice call signaling
//   socket.on("call-user", ({ from, to, signalData }) => {
//     console.log(`📞 Call initiated from ${from} to ${to}`);
//     if (users[to]) {
//       io.to(users[to]).emit("incoming-call", { from, signalData });
//       console.log(`✅ Call signal sent to ${to}`);
//     } else {
//       console.log(`❌ User ${to} is offline, call cannot be initiated`);
//     }
//   });

//   socket.on("accept-call", ({ from, signalData }) => {
//     console.log(`📞 Call accepted from ${socket.id} to ${from}`);
//     if (users[from]) {
//       io.to(users[from]).emit("call-accepted", { signalData });
//       console.log(`✅ Call acceptance sent to ${from}`);
//     }
//   });

//   socket.on("reject-call", ({ from, to }) => {
//     console.log(`📞 Call rejected from ${to}`);
//     if (users[from]) {
//       io.to(users[from]).emit("call-rejected", { by: to });
//       console.log(`✅ Call rejection sent to ${from}`);
//     }
//   });

//   socket.on("disconnect", () => {
//     for (let email in users) {
//       if (users[email] === socket.id) {
//         delete users[email];
//         console.log(`🔴 User ${email} disconnected`);
//         break;
//       }
//     }
//     console.log(`📊 Currently connected users: ${Object.keys(users).length}`);
//   });
// });

// module.exports = router;

// const express = require("express");
// const mongoose = require("mongoose");
// const router = express.Router();
// const sgMail = require("@sendgrid/mail");
// const http = require("http");
// const socketIO = require("socket.io");
// const nodemailer = require("nodemailer");
// const notification = require("./notification");

// // Initialize SendGrid with your API key
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // Setup SMTP transport using your email credentials
// const smtpTransporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_EMAIL || "fyplabourhiring@gmail.com",
//     pass: process.env.SMTP_PASS || "vckn kmuw nqhh siem", // Use the app password from your env
//   },
// });

// // Test SMTP connection
// smtpTransporter.verify((error, success) => {
//   if (error) {
//     console.error("❌ SMTP connection failed:", error.message);
//   } else {
//     console.log("✅ SMTP server is ready to send emails");
//   }
// });

// // ==================== SCHEMA ====================
// const chatSchema = new mongoose.Schema(
//   {
//     senderEmail: { type: String, required: true },
//     receiverEmail: { type: String, required: true },
//     message: { type: String, required: true },
//     timestamp: { type: Date, default: Date.now },
//     isRead: { type: Boolean, default: false },
//   },
//   { timestamps: true },
// );

// const Chat = mongoose.model("Chat", chatSchema);

// // ==================== HELPER FUNCTIONS ====================

// /**
//  * Get user by email to fetch push token
//  */
// async function getUserByEmail(email) {
//   try {
//     const User = mongoose.model("User");
//     const user = await User.findOne({ email: email.toLowerCase().trim() });
//     return user;
//   } catch (err) {
//     console.error("Error fetching user:", err);
//     return null;
//   }
// }

// /**
//  * Send email using multiple methods
//  */
// async function sendEmailNotification(
//   receiverEmail,
//   senderName,
//   senderEmail,
//   message,
// ) {
//   const logoUrl =
//     "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";

//   const emailHtml = `
//     <div style="font-family: 'Segoe UI', sans-serif; background-color: #f5f7fa; padding: 40px 0;">
//       <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

//         <div style="background-color: #0a66c2; padding: 25px 20px; text-align: center;">
//           <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius: 50%; border: 2px solid #ffffff; margin-bottom: 10px;">
//           <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Labour Hub</h1>
//         </div>

//         <div style="padding: 30px 25px; color: #333333;">
//           <h2 style="color: #0a66c2; font-size: 20px;">New Message Received</h2>
//           <p style="font-size: 16px; line-height: 1.6;">
//             <strong>From:</strong> ${senderName}<br>
//             <strong>Email:</strong> ${senderEmail}<br>
//             <strong>Message:</strong>
//           </p>
//           <div style="background-color: #f0f2f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
//             <p style="margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
//           </div>
//           <div style="text-align: center; margin-top: 30px;">
//             <a href="https://labourhub.pk/chat?with=${senderEmail}"
//                style="background-color: #0a66c2; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold;">
//               Reply Now
//             </a>
//           </div>
//         </div>

//         <div style="background-color: #f0f2f5; text-align: center; padding: 20px; border-top: 1px solid #e1e4e8;">
//           <p style="color: #777777; font-size: 13px; margin: 0;">
//             © ${new Date().getFullYear()} Labour Hub. All rights reserved.<br>
//             Karachi, Pakistan
//           </p>
//         </div>
//       </div>
//     </div>
//   `;

//   // Try SendGrid first
//   try {
//     await sgMail.send({
//       to: receiverEmail,
//       from: process.env.SENDGRID_VERIFIED_SENDER || "fyplabourhiring@gmail.com",
//       subject: `New Message from ${senderName}`,
//       html: emailHtml,
//     });
//     console.log(`✅ Email sent via SendGrid to ${receiverEmail}`);
//     return true;
//   } catch (sendgridErr) {
//     console.error(
//       `❌ SendGrid failed:`,
//       sendgridErr.response?.body || sendgridErr.message,
//     );

//     // Try SMTP as fallback
//     try {
//       await smtpTransporter.sendMail({
//         from: `"Labour Hub" <${process.env.SMTP_EMAIL || "fyplabourhiring@gmail.com"}>`,
//         to: receiverEmail,
//         subject: `New Message from ${senderName}`,
//         html: emailHtml,
//       });
//       console.log(`✅ Email sent via SMTP to ${receiverEmail}`);
//       return true;
//     } catch (smtpErr) {
//       console.error(`❌ SMTP failed:`, smtpErr.message);
//     }
//   }

//   return false;
// }

// // ==================== ROUTES ====================

// // Send a chat
// router.post("/send", async (req, res) => {
//   try {
//     const { senderEmail, receiverEmail, message } = req.body;
//     if (!senderEmail || !receiverEmail || !message) {
//       return res.status(400).json({ message: "All fields are required." });
//     }

//     console.log(`\n📨 New chat message received:`);
//     console.log(`   From: ${senderEmail}`);
//     console.log(`   To: ${receiverEmail}`);
//     console.log(
//       `   Message: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
//     );

//     const chat = await Chat.create({ senderEmail, receiverEmail, message });

//     // Get sender's name for notification
//     const sender = await getUserByEmail(senderEmail);
//     const senderName = sender
//       ? `${sender.firstName} ${sender.lastName}`.trim()
//       : senderEmail;

//     // Get receiver's push token
//     const receiver = await getUserByEmail(receiverEmail);
//     const receiverPushToken = receiver?.expoPushToken;

//     console.log(`\n📱 Push token status for ${receiverEmail}:`);
//     console.log(`   Token exists: ${!!receiverPushToken}`);
//     if (receiverPushToken) {
//       console.log(`   Token: ${receiverPushToken.substring(0, 30)}...`);
//     }

//     // Send push notification if receiver has a token
//     let notificationSent = false;
//     if (
//       receiverPushToken &&
//       receiverPushToken !== null &&
//       receiverPushToken !== ""
//     ) {
//       console.log(
//         `\n🔔 Attempting to send push notification to ${receiverEmail}...`,
//       );

//       const notificationTitle = "💬 New Message";
//       const notificationBody = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;

//       const notificationData = {
//         type: "new_chat_message",
//         senderEmail: senderEmail,
//         senderName: senderName,
//         messageId: chat._id.toString(),
//         message: message,
//         timestamp: chat.timestamp.toISOString(),
//         screen: "ChatScreen",
//         chatWith: senderEmail,
//       };

//       try {
//         notificationSent = await notification.sendPushNotification(
//           receiverPushToken,
//           notificationTitle,
//           notificationBody,
//           notificationData,
//         );

//         if (notificationSent) {
//           console.log(
//             `✅ Push notification sent successfully to ${receiverEmail}`,
//           );
//         } else {
//           console.log(
//             `❌ Failed to send push notification to ${receiverEmail}`,
//           );
//         }
//       } catch (pushError) {
//         console.error(`❌ Error sending push notification:`, pushError.message);
//       }
//     } else {
//       console.log(
//         `⚠️ No push token found for ${receiverEmail}. Skipping push notification.`,
//       );
//     }

//     // Send email notification
//     console.log(
//       `\n📧 Attempting to send email notification to ${receiverEmail}...`,
//     );
//     let emailSent = await sendEmailNotification(
//       receiverEmail,
//       senderName,
//       senderEmail,
//       message,
//     );

//     // Log final summary
//     console.log(`\n📊 Chat Message Summary:`);
//     console.log(`   ✅ Message saved to database (ID: ${chat._id})`);
//     console.log(
//       `   📱 Push notification: ${notificationSent ? "✅ SENT" : "❌ FAILED/SKIPPED"}`,
//     );
//     console.log(
//       `   📧 Email notification: ${emailSent ? "✅ SENT" : "❌ FAILED"}`,
//     );
//     console.log(`   👥 From: ${senderEmail}`);
//     console.log(`   👤 To: ${receiverEmail}\n`);

//     res.status(201).json({
//       success: true,
//       chat,
//       notifications: {
//         push: notificationSent,
//         email: emailSent,
//       },
//     });
//   } catch (err) {
//     console.error("❌ Error in /send route:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get all chats for a user
// router.get("/all/:email", async (req, res) => {
//   try {
//     const email = req.params.email;
//     console.log(`📋 Fetching all chats for user: ${email}`);

//     const chats = await Chat.find({
//       $or: [{ senderEmail: email }, { receiverEmail: email }],
//     }).sort({ timestamp: -1 });

//     const usersMap = {};
//     chats.forEach((chat) => {
//       const other =
//         chat.senderEmail === email ? chat.receiverEmail : chat.senderEmail;
//       if (!usersMap[other]) {
//         usersMap[other] = {
//           email: other,
//           lastMessage: chat.message,
//           timestamp: chat.timestamp,
//           isRead: chat.isRead,
//         };
//       }
//     });

//     console.log(
//       `✅ Found ${Object.values(usersMap).length} chat conversations for ${email}`,
//     );
//     res.json(Object.values(usersMap));
//   } catch (err) {
//     console.error("Error fetching chats:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get all chats between two users
// router.get("/:user1/:user2", async (req, res) => {
//   try {
//     const { user1, user2 } = req.params;
//     console.log(`💬 Fetching chat history between ${user1} and ${user2}`);

//     const chats = await Chat.find({
//       $or: [
//         { senderEmail: user1, receiverEmail: user2 },
//         { senderEmail: user2, receiverEmail: user1 },
//       ],
//     }).sort({ timestamp: 1 });

//     // Mark messages as read
//     await Chat.updateMany(
//       { receiverEmail: user1, senderEmail: user2, isRead: false },
//       { $set: { isRead: true } },
//     );

//     console.log(`✅ Found ${chats.length} messages in conversation`);
//     res.json(chats);
//   } catch (err) {
//     console.error("Error fetching chat history:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Mark messages as read
// router.post("/mark-read", async (req, res) => {
//   try {
//     const { userId, chatWith } = req.body;
//     console.log(
//       `📖 Marking messages as read: ${userId} reading from ${chatWith}`,
//     );

//     const result = await Chat.updateMany(
//       { receiverEmail: userId, senderEmail: chatWith, isRead: false },
//       { $set: { isRead: true } },
//     );

//     console.log(`✅ Marked ${result.modifiedCount} messages as read`);
//     res.json({ success: true, count: result.modifiedCount });
//   } catch (err) {
//     console.error("Error marking messages as read:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get unread message count
// router.get("/unread/:email", async (req, res) => {
//   try {
//     const email = req.params.email;
//     const count = await Chat.countDocuments({
//       receiverEmail: email,
//       isRead: false,
//     });
//     console.log(`🔔 ${email} has ${count} unread messages`);
//     res.json({ unreadCount: count });
//   } catch (err) {
//     console.error("Error getting unread count:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ==================== SOCKET.IO for Real-time Chat ====================

// // Wrap your Express app into an HTTP server
// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });

// // Keep track of connected users
// const users = {};

// io.on("connection", (socket) => {
//   console.log("🟢 New socket connected:", socket.id);

//   // Store user email on connection
//   socket.on("join", (email) => {
//     users[email] = socket.id;
//     console.log(`👤 User ${email} joined with socket ID: ${socket.id}`);
//     console.log(`📊 Currently connected users: ${Object.keys(users).length}`);
//   });

//   // Chat message with real-time delivery
//   socket.on("chat-message", async (data) => {
//     const { senderEmail, receiverEmail, message, messageId } = data;
//     console.log(`\n💬 Real-time chat message:`);
//     console.log(`   From: ${senderEmail}`);
//     console.log(`   To: ${receiverEmail}`);
//     console.log(
//       `   Message: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
//     );

//     // Get sender's name for notification
//     const User = mongoose.model("User");
//     const sender = await User.findOne({ email: senderEmail });
//     const senderName = sender
//       ? `${sender.firstName} ${sender.lastName}`.trim()
//       : senderEmail;

//     // Check if receiver is online
//     const receiverOnline = !!users[receiverEmail];
//     console.log(`   Receiver online: ${receiverOnline ? "✅ YES" : "❌ NO"}`);

//     if (receiverOnline) {
//       // Send real-time message to receiver
//       io.to(users[receiverEmail]).emit("chat-message", {
//         ...data,
//         senderName: senderName,
//         timestamp: new Date().toISOString(),
//       });
//       console.log(`✅ Real-time message sent to ${receiverEmail}`);
//     } else {
//       console.log(
//         `⚠️ Receiver offline, message will be delivered via push notification`,
//       );
//     }

//     // Send push notification regardless (for offline users)
//     const receiver = await User.findOne({ email: receiverEmail });
//     const receiverPushToken = receiver?.expoPushToken;

//     if (receiverPushToken && !receiverOnline) {
//       console.log(
//         `🔔 Sending push notification to offline user: ${receiverEmail}`,
//       );
//       const notificationTitle = "💬 New Message";
//       const notificationBody = `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;

//       const notificationData = {
//         type: "new_chat_message",
//         senderEmail: senderEmail,
//         senderName: senderName,
//         messageId: messageId,
//         message: message,
//         timestamp: new Date().toISOString(),
//         screen: "ChatScreen",
//         chatWith: senderEmail,
//       };

//       try {
//         await notification.sendPushNotification(
//           receiverPushToken,
//           notificationTitle,
//           notificationBody,
//           notificationData,
//         );
//         console.log(
//           `✅ Push notification sent to offline user: ${receiverEmail}`,
//         );
//       } catch (pushError) {
//         console.error(
//           `❌ Failed to send push notification:`,
//           pushError.message,
//         );
//       }
//     }
//   });

//   // Voice call signaling
//   socket.on("call-user", ({ from, to, signalData }) => {
//     console.log(`📞 Call initiated from ${from} to ${to}`);
//     if (users[to]) {
//       io.to(users[to]).emit("incoming-call", { from, signalData });
//       console.log(`✅ Call signal sent to ${to}`);
//     } else {
//       console.log(`❌ User ${to} is offline, call cannot be initiated`);
//     }
//   });

//   socket.on("accept-call", ({ from, signalData }) => {
//     console.log(`📞 Call accepted from ${socket.id} to ${from}`);
//     if (users[from]) {
//       io.to(users[from]).emit("call-accepted", { signalData });
//       console.log(`✅ Call acceptance sent to ${from}`);
//     }
//   });

//   socket.on("reject-call", ({ from, to }) => {
//     console.log(`📞 Call rejected from ${to}`);
//     if (users[from]) {
//       io.to(users[from]).emit("call-rejected", { by: to });
//       console.log(`✅ Call rejection sent to ${from}`);
//     }
//   });

//   socket.on("disconnect", () => {
//     for (let email in users) {
//       if (users[email] === socket.id) {
//         delete users[email];
//         console.log(`🔴 User ${email} disconnected`);
//         break;
//       }
//     }
//     console.log(`📊 Currently connected users: ${Object.keys(users).length}`);
//   });
// });

// module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const nodemailer = require("nodemailer");

// ==================== EMAIL SETUP ====================
// Setup SMTP transporter with your credentials
const smtpTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL || "syncmeet3@gmail.com",
    pass: process.env.SMTP_PASS || "vckn kmuw nqhh siem",
  },
});

// Verify SMTP connection
smtpTransporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// ==================== SCHEMA ====================
const chatSchema = new mongoose.Schema(
  {
    senderEmail: { type: String, required: true },
    receiverEmail: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Chat = mongoose.model("Chat", chatSchema);

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user by email to fetch user details
 */
async function getUserByEmail(email) {
  try {
    const User = mongoose.model("User");
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return user;
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
}

/**
 * Send email notification using SMTP
 */
async function sendEmailNotification(
  receiverEmail,
  senderName,
  senderEmail,
  message,
) {
  const logoUrl =
    "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";

  const emailHtml = `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f5f7fa; padding: 40px 0;">
      <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <div style="background-color: #0a66c2; padding: 25px 20px; text-align: center;">
          <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius: 50%; border: 2px solid #ffffff; margin-bottom: 10px;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Labour Hub</h1>
        </div>

        <div style="padding: 30px 25px; color: #333333;">
          <h2 style="color: #0a66c2; font-size: 20px;">New Message Received</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            <strong>From:</strong> ${senderName}<br>
            <strong>Email:</strong> ${senderEmail}<br>
            <strong>Message:</strong>
          </p>
          <div style="background-color: #f0f2f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://labourhub.pk/chat?with=${senderEmail}" 
               style="background-color: #0a66c2; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold;">
              Reply Now
            </a>
          </div>
        </div>

        <div style="background-color: #f0f2f5; text-align: center; padding: 20px; border-top: 1px solid #e1e4e8;">
          <p style="color: #777777; font-size: 13px; margin: 0;">
            © ${new Date().getFullYear()} Labour Hub. All rights reserved.<br>
            Karachi, Pakistan
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    await smtpTransporter.sendMail({
      from: `"Labour Hub" <${process.env.SMTP_EMAIL || "syncmeet3@gmail.com"}>`,
      to: receiverEmail,
      subject: `New Message from ${senderName}`,
      html: emailHtml,
    });
    console.log(`✅ Email sent successfully to ${receiverEmail}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send email to ${receiverEmail}:`,
      error.message,
    );
    return false;
  }
}

// ==================== ROUTES ====================

// Send a chat
router.post("/send", async (req, res) => {
  try {
    const { senderEmail, receiverEmail, message } = req.body;
    if (!senderEmail || !receiverEmail || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    console.log(`\n📨 New chat message received:`);
    console.log(`   From: ${senderEmail}`);
    console.log(`   To: ${receiverEmail}`);
    console.log(`   Message: ${message}`);

    // Save message to database
    const chat = await Chat.create({ senderEmail, receiverEmail, message });
    console.log(`✅ Message saved to database (ID: ${chat._id})`);

    // Get sender's name for notification
    const sender = await getUserByEmail(senderEmail);
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`.trim()
      : senderEmail;

    // Send email notification
    console.log(
      `\n📧 Attempting to send email notification to ${receiverEmail}...`,
    );
    const emailSent = await sendEmailNotification(
      receiverEmail,
      senderName,
      senderEmail,
      message,
    );

    // Log final summary
    console.log(`\n📊 Chat Message Summary:`);
    console.log(`   ✅ Message saved to database (ID: ${chat._id})`);
    console.log(
      `   📧 Email notification: ${emailSent ? "✅ SENT" : "❌ FAILED"}`,
    );
    console.log(`   👥 From: ${senderEmail}`);
    console.log(`   👤 To: ${receiverEmail}\n`);

    res.status(201).json({
      success: true,
      chat,
      timestamp: chat.timestamp,
      notifications: {
        email: emailSent,
      },
    });
  } catch (err) {
    console.error("❌ Error in /send route:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all chats for a user
router.get("/all/:email", async (req, res) => {
  try {
    const email = req.params.email;
    console.log(`📋 Fetching all chats for user: ${email}`);

    const chats = await Chat.find({
      $or: [{ senderEmail: email }, { receiverEmail: email }],
    }).sort({ timestamp: -1 });

    const usersMap = {};
    chats.forEach((chat) => {
      const other =
        chat.senderEmail === email ? chat.receiverEmail : chat.senderEmail;
      if (!usersMap[other]) {
        usersMap[other] = {
          email: other,
          lastMessage: chat.message,
          timestamp: chat.timestamp,
          isRead: chat.isRead,
        };
      }
    });

    console.log(`✅ Found ${Object.values(usersMap).length} conversations`);
    res.json(Object.values(usersMap));
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all chats between two users
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    console.log(`💬 Fetching chat history between ${user1} and ${user2}`);

    const chats = await Chat.find({
      $or: [
        { senderEmail: user1, receiverEmail: user2 },
        { senderEmail: user2, receiverEmail: user1 },
      ],
    }).sort({ timestamp: 1 });

    // Mark messages as read
    await Chat.updateMany(
      { receiverEmail: user1, senderEmail: user2, isRead: false },
      { $set: { isRead: true } },
    );

    console.log(`✅ Found ${chats.length} messages`);
    res.json(chats);
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark messages as read
router.post("/mark-read", async (req, res) => {
  try {
    const { userId, chatWith } = req.body;
    console.log(
      `📖 Marking messages as read: ${userId} reading from ${chatWith}`,
    );

    const result = await Chat.updateMany(
      { receiverEmail: userId, senderEmail: chatWith, isRead: false },
      { $set: { isRead: true } },
    );

    console.log(`✅ Marked ${result.modifiedCount} messages as read`);
    res.json({ success: true, count: result.modifiedCount });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unread message count
router.get("/unread/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const count = await Chat.countDocuments({
      receiverEmail: email,
      isRead: false,
    });
    console.log(`🔔 ${email} has ${count} unread messages`);
    res.json({ unreadCount: count });
  } catch (err) {
    console.error("Error getting unread count:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
