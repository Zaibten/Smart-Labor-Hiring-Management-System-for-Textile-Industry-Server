const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

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


// Send a chat
// POST /api/chat/send
// body: { senderEmail, receiverEmail, message }
router.post("/send", async (req, res) => {
  try {
    const { senderEmail, receiverEmail, message } = req.body;
    if (!senderEmail || !receiverEmail || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const chat = await Chat.create({ senderEmail, receiverEmail, message });
    res.status(201).json(chat);
  } catch (err) {
    console.error(err);
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
