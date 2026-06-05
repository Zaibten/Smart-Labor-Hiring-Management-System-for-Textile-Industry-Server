// chat.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const nodemailer = require("nodemailer");

// ==================== EMAIL SETUP ====================
const smtpTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

smtpTransporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
  } else {
    console.log("✅ SMTP server ready");
  }
});

// ==================== SCHEMA ====================
let Chat;
try {
  Chat = mongoose.model("Chat");
} catch {
  const chatSchema = new mongoose.Schema(
    {
      senderEmail: { type: String, required: true },
      receiverEmail: { type: String, required: true },
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
  );
  Chat = mongoose.model("Chat", chatSchema);
}

// ==================== HELPERS ====================
async function getUserByEmail(email) {
  try {
    const User = mongoose.model("User");
    return await User.findOne({ email: email.toLowerCase().trim() });
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
}

async function sendEmailNotification(receiverEmail, senderName, senderEmail, message) {
  const logoUrl =
    "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";

  const emailHtml = `
    <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
      <div style="max-width:600px;background:#fff;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <div style="background:#0a66c2;padding:25px 20px;text-align:center;">
          <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius:50%;border:2px solid #fff;margin-bottom:10px;">
          <h1 style="color:#fff;font-size:24px;margin:0;">Labour Hub</h1>
        </div>
        <div style="padding:30px 25px;color:#333;">
          <h2 style="color:#0a66c2;">New Message Received</h2>
          <p><strong>From:</strong> ${senderName}<br><strong>Email:</strong> ${senderEmail}</p>
          <div style="background:#f0f2f5;padding:15px;border-radius:8px;margin:15px 0;">
            <p style="margin:0;">${message}</p>
          </div>
          <div style="text-align:center;margin-top:30px;">
            <a href="https://labourhub.pk/chat?with=${senderEmail}"
               style="background:#0a66c2;color:#fff;text-decoration:none;padding:12px 25px;border-radius:8px;font-weight:bold;">
              Reply Now
            </a>
          </div>
        </div>
        <div style="background:#f0f2f5;text-align:center;padding:20px;border-top:1px solid #e1e4e8;">
          <p style="color:#777;font-size:13px;margin:0;">
            © ${new Date().getFullYear()} Labour Hub. All rights reserved.<br>Karachi, Pakistan
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    await smtpTransporter.sendMail({
      from: `"Labour Hub" <${process.env.SMTP_EMAIL}>`,
      to: receiverEmail,
      subject: `New Message from ${senderName}`,
      html: emailHtml,
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${receiverEmail}:`, error.message);
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

    const chat = await Chat.create({ senderEmail, receiverEmail, message });

    const sender = await getUserByEmail(senderEmail);
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`.trim()
      : senderEmail;

    const emailSent = await sendEmailNotification(receiverEmail, senderName, senderEmail, message);

    res.status(201).json({
      success: true,
      chat,
      timestamp: chat.timestamp,
      notifications: { email: emailSent },
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
    const chats = await Chat.find({
      $or: [{ senderEmail: email }, { receiverEmail: email }],
    }).sort({ timestamp: -1 });

    const usersMap = {};
    chats.forEach((chat) => {
      const other = chat.senderEmail === email ? chat.receiverEmail : chat.senderEmail;
      if (!usersMap[other]) {
        usersMap[other] = {
          email: other,
          lastMessage: chat.message,
          timestamp: chat.timestamp,
          isRead: chat.isRead,
        };
      }
    });

    res.json(Object.values(usersMap));
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get chat history between two users
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const chats = await Chat.find({
      $or: [
        { senderEmail: user1, receiverEmail: user2 },
        { senderEmail: user2, receiverEmail: user1 },
      ],
    }).sort({ timestamp: 1 });

    await Chat.updateMany(
      { receiverEmail: user1, senderEmail: user2, isRead: false },
      { $set: { isRead: true } }
    );

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
    const result = await Chat.updateMany(
      { receiverEmail: userId, senderEmail: chatWith, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get unread message count
router.get("/unread/:email", async (req, res) => {
  try {
    const count = await Chat.countDocuments({
      receiverEmail: req.params.email,
      isRead: false,
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;