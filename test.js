// sendEmail.js
const sgMail = require("@sendgrid/mail");

// Set your SendGrid API Key
sgMail.setApiKey("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");

// Email details
const msg = {
  to: "mkmuzammil191@gmail.com", // Change to your recipient
  from: "fyplabourhiring@gmail.com",  // Verified sender on SendGrid
  subject: "Hello from Node.js",
  text: "This is a test email using SendGrid and Node.js",
  html: "<strong>This is a test email using SendGrid and Node.js</strong>",
};

// Send Email
sgMail
  .send(msg)
  .then(() => {
    console.log("Email sent successfully!");
  })
  .catch((error) => {
    console.error("Error sending email:", error.response ? error.response.body : error);
  });
