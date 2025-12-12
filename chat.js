const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ==================== SCHEMA ====================
const chatSchema = new mongoose.Schema(
  {
    senderEmail: { type: String, required: true },
    receiverEmail: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", chatSchema);

// ==================== ROUTES ====================

// Send a chat
// POST /api/chat/send
// body: { senderEmail, receiverEmail, message }
// Send a chat
router.post("/send", async (req, res) => {
  try {
    const { senderEmail, receiverEmail, message } = req.body;
    if (!senderEmail || !receiverEmail || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Create chat in DB
    const chat = await Chat.create({ senderEmail, receiverEmail, message });

    // Chat email UI
    const logoUrl = "https://yourdomain.com/logo.png"; // Replace with your logo URL
    const emailData = {
      to: receiverEmail,
      from: process.env.SENDGRID_VERIFIED_SENDER,
      subject: `New Message from ${senderEmail}`,
      html: `
      <div style="font-family: 'Segoe UI', sans-serif; background-color: #f5f7fa; padding: 40px 0;">
        <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <div style="background-color: #0a66c2; padding: 25px 20px; text-align: center;">
            <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius: 50%; border: 2px solid #ffffff; margin-bottom: 10px;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Labour Hub</h1>
          </div>

          <div style="padding: 30px 25px; color: #333333;">
            <h2 style="color: #0a66c2; font-size: 20px;">New Message Received</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              You have received a new message from <strong>${senderEmail}</strong>:
            </p>
            <div style="background-color: #f0f2f5; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 16px; color: #111;">
              ${message}
            </div>
            <p style="font-size: 14px; color: #555;">Reply quickly to stay in touch with your contact.</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="https://labourhub.pk/chat" style="background-color: #0a66c2; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold;">
                Open Chat
              </a>
            </div>
          </div>

          <div style="background-color: #f0f2f5; text-align: center; padding: 20px; border-top: 1px solid #e1e4e8;">
            <p style="color: #777777; font-size: 13px; margin: 0;">
              &copy; ${new Date().getFullYear()} Labour Hub. All rights reserved.<br>
              Karachi, Pakistan
            </p>
          </div>
        </div>
      </div>
      `,
    };

    try {
      await sgMail.send(emailData);
      console.log("Email sent to", receiverEmail);
    } catch (emailErr) {
      console.error("Error sending email:", emailErr);
    }

    res.status(201).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/chat/all/:email
router.get("/all/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Get all chats involving this user
    const chats = await Chat.find({
      $or: [{ senderEmail: email }, { receiverEmail: email }],
    }).sort({ timestamp: -1 });

    // Group by unique users
    const usersMap = {};

    chats.forEach((chat) => {
      const other =
        chat.senderEmail === email ? chat.receiverEmail : chat.senderEmail;

      if (!usersMap[other]) {
        usersMap[other] = {
          email: other,
          lastMessage: chat.message,
          timestamp: chat.timestamp,
        };
      }
    });

    res.json(Object.values(usersMap));
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// Get all chats between two users
// GET /api/chat/:user1/:user2
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const chats = await Chat.find({
      $or: [
        { senderEmail: user1, receiverEmail: user2 },
        { senderEmail: user2, receiverEmail: user1 },
      ],
    }).sort({ timestamp: 1 });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
