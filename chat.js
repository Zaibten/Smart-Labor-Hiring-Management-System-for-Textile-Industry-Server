const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const sgMail = require("@sendgrid/mail");
const http = require("http");
const socketIO = require("socket.io");

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
router.post("/send", async (req, res) => {
  try {
    const { senderEmail, receiverEmail, message } = req.body;
    if (!senderEmail || !receiverEmail || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const chat = await Chat.create({ senderEmail, receiverEmail, message });

    // Send email notification (already existing)
    const logoUrl = "https://yourdomain.com/logo.png";
    const emailData = {
      to: receiverEmail,
      from: process.env.SENDGRID_VERIFIED_SENDER,
      subject: `New Message from ${senderEmail}`,
      html: `<div>New Message: ${message}</div>`, // simplified for brevity
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
        };
      }
    });

    res.json(Object.values(usersMap));
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all chats between two users
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

// ==================== SOCKET.IO for Real-time Chat + Voice ====================

// Wrap your Express app into an HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Keep track of connected users
const users = {};

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  // Store user email on connection
  socket.on("join", (email) => {
    users[email] = socket.id;
    console.log(users);
  });

  // Chat message
  socket.on("chat-message", (data) => {
    const { senderEmail, receiverEmail, message } = data;
    if (users[receiverEmail]) {
      io.to(users[receiverEmail]).emit("chat-message", data);
    }
  });

  // Voice call signaling
  socket.on("call-user", ({ from, to, signalData }) => {
    if (users[to]) {
      io.to(users[to]).emit("incoming-call", { from, signalData });
    }
  });

  socket.on("accept-call", ({ from, signalData }) => {
    if (users[from]) {
      io.to(users[from]).emit("call-accepted", { signalData });
    }
  });

  socket.on("disconnect", () => {
    for (let email in users) {
      if (users[email] === socket.id) {
        delete users[email];
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});

module.exports = router;
