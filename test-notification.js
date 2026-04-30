// test-my-notification.js
const notification = require("./notification");

async function test() {
  // Your actual token
  const YOUR_TOKEN = "ExponentPushToken[4ck1auHF9vUqdvUGhMvlA5]";

  console.log("📱 Testing notification with your token...");
  console.log("Token:", YOUR_TOKEN);

  // Register your token
  notification.registerPushToken(YOUR_TOKEN, "test-user");

  // Send a test notification
  const result = await notification.sendPushNotification(
    YOUR_TOKEN,
    "🎉 Hello from Server!",
    "Your push notification is working perfectly! 🚀",
    {
      screen: "home",
      userId: "test-123",
      timestamp: new Date().toISOString(),
    },
  );

  if (result) {
    console.log("✅ Notification sent successfully! Check your phone.");
  } else {
    console.log(
      "❌ Failed to send notification. Check your token and internet connection.",
    );
  }
}

// Run the test
test().catch(console.error);
