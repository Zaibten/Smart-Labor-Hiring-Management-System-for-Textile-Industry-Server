const express = require("express");
const router = express.Router();
const pushNotificationService = require("./pushNotification");

// Save push token for current user
router.post("/save-token", async (req, res) => {
  try {
    const { userId, pushToken, role } = req.body;

    if (!userId || !pushToken || !role) {
      return res.status(400).json({
        message: "Missing required fields: userId, pushToken, role",
      });
    }

    const saved = await pushNotificationService.savePushToken(
      userId,
      pushToken,
      role,
    );

    if (saved) {
      res.status(200).json({ message: "Push token saved successfully" });
    } else {
      res.status(400).json({ message: "Invalid push token" });
    }
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Test endpoint to send notification
router.post("/test-notification", async (req, res) => {
  try {
    const { userId, title, body } = req.body;

    await pushNotificationService.sendNotificationToUser(userId, title, body);
    res.status(200).json({ message: "Test notification sent" });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
