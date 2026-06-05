// api/index.js — Vercel-compatible Express server
const express = require("express");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const OpenAI = require("openai");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");
const chatRoutes = require("./chat");
const notification = require("./notification");
require("dotenv").config();

const app = express();

// ─── CRITICAL FIX 1: Trust proxy MUST come before rate limiter ───────────────
// Vercel runs behind a reverse proxy. Without this, express-rate-limit sees
// ALL requests as coming from the same IP (the proxy), so after 10 requests
// from ANYONE it blocks EVERYONE with 429 Too Many Requests.
app.set("trust proxy", 1);

// ─── Basic middleware ─────────────────────────────────────────────────────────
// FIX 2: helmet() with relaxed CSP so it doesn't block API responses on Vercel
app.use(
  helmet({
    contentSecurityPolicy: false,   // prevents blocking cross-origin API calls
    crossOriginEmbedderPolicy: false,
  })
);

// FIX 3: Explicit CORS config — allow all origins (tighten for production)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10kb" }));



// At the top of your server file, after app.use(express.json())
app.use(cors({
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

// Handle preflight requests
app.options('*', cors());

// ─── Cloudinary ───────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "audio_uploads", resource_type: "auto" },
});
const upload = multer({ storage });

// ─── OpenAI ──────────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── SMTP (Nodemailer) ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error("❌ SMTP Error:", error);
  else console.log("✅ SMTP ready");
});

// ─── SendGrid ────────────────────────────────────────────────────────────────
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// FIX: trust proxy is set above, so now each real user IP is tracked correctly.
// Also raised limit to 60/min to avoid false positives on Vercel cold starts.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                          // raised from 10 → 60 per real IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", authLimiter);

// ─── MongoDB connection (cached for serverless) ───────────────────────────────
let cachedDb = null;

async function connectDB() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    bufferCommands: false,
  });
  cachedDb = conn;
  console.log("✅ MongoDB connected");
  return conn;
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ─── Predefined Q&A ──────────────────────────────────────────────────────────
const questionsData = [
  {
    id: 1,
    text: "میری پروفائل کیسے بناؤں؟",
    response:
      "پروفائل بنانے کے لیے 'پروفائل' سیکشن میں جائیں، تمام معلومات بھریں اور 'سیو' پر کلک کریں۔",
  },
  {
    id: 2,
    text: "میں ملازمت کے لیے کیسے درخواست دوں؟",
    response:
      "ملازمت کے لیے درخواست دینے کے لیے 'Jobs' میں جائیں، مطلوبہ نوکری منتخب کریں اور 'Apply' پر کلک کریں۔",
  },
  {
    id: 3,
    text: "میرے قریب کون سے ملز میں کام ہے؟",
    response:
      "قریبی ملز دیکھنے کے لیے 'Nearby Jobs' سیکشن کھولیں اور دستیاب مواقع دیکھیں۔",
  },
  {
    id: 4,
    text: "میں اپنی مہارتیں کیسے اپ ڈیٹ کروں؟",
    response:
      "مہارتیں اپ ڈیٹ کرنے کے لیے 'Skills' سیکشن میں جائیں، نئی مہارتیں شامل کریں اور 'Save' کریں۔",
  },
  {
    id: 5,
    text: "کیا میں کسی ٹھیکیدار کی ٹیم میں شامل ہو سکتا ہوں؟",
    response:
      "جی ہاں، 'Contractors' میں جائیں اور ٹیم میں شامل ہونے کے لیے درخواست دیں۔",
  },
  {
    id: 6,
    text: "نئی نوکریوں کے بارے میں اطلاع کیسے ملے گی؟",
    response:
      "نئی نوکریوں کی اطلاع کے لیے 'Notifications' آن کریں یا ایپ کی اپ ڈیٹس دیکھیں۔",
  },
  {
    id: 7,
    text: "میں اپنی موجودگی کب تک ظاہر کروں؟",
    response:
      "موجودگی ظاہر کرنے کے لیے 'Attendance' سیکشن میں جائیں اور اپنی موجودگی اپ ڈیٹ کریں۔",
  },
  {
    id: 8,
    text: "میرے کام کی تنخواہ کب ملے گی؟",
    response:
      "تنخواہ کی تاریخ 'Salary' سیکشن میں دیکھیں یا اپنے کمپنی کے شیڈول کے مطابق۔",
  },
  {
    id: 9,
    text: "میں کس طرح ڈیجیٹل معاہدہ دیکھ سکتا ہوں؟",
    response:
      "ڈیجیٹل معاہدہ دیکھنے کے لیے 'Contracts' سیکشن میں جائیں اور متعلقہ معاہدہ کھولیں۔",
  },
  {
    id: 10,
    text: "میں اپنی ریٹنگ کیسے دیکھ سکتا ہوں؟",
    response: "اپنی ریٹنگ دیکھنے کے لیے 'Profile' یا 'Ratings' سیکشن کھولیں۔",
  },
  {
    id: 11,
    text: "کیا میں نوکری چھوڑنا چاہوں تو کیسے کروں؟",
    response:
      "نوکری چھوڑنے کے لیے 'Jobs' سیکشن میں جائیں اور 'Resign' آپشن استعمال کریں۔",
  },
  {
    id: 12,
    text: "میں کس طرح اپنی جگہ کا پتہ درست کر سکتا ہوں؟",
    response:
      "اپنی جگہ درست کرنے کے لیے 'Settings' > 'Location' میں جائیں اور درست پتہ درج کریں۔",
  },
  {
    id: 13,
    text: "میں کس طرح زیادہ قریبی ملازمت تلاش کر سکتا ہوں؟",
    response:
      "قریبی ملازمتیں تلاش کرنے کے لیے 'Nearby Jobs' سیکشن میں فلٹرز استعمال کریں۔",
  },
  {
    id: 14,
    text: "میں اپنی پروفائل میں تصویریں کیسے ڈالوں؟",
    response:
      "پروفائل میں تصاویر شامل کرنے کے لیے 'Profile' > 'Edit' > 'Upload Photo' پر جائیں۔",
  },
  {
    id: 15,
    text: "کیا میں کسی دوسرے مل میں بھی کام کر سکتا ہوں؟",
    response:
      "جی ہاں، 'Jobs' سیکشن میں مختلف ملز کے مواقع دیکھیں اور درخواست دیں۔",
  },
  {
    id: 16,
    text: "میں اپنی دستیابی کب تبدیل کر سکتا ہوں؟",
    response:
      "اپنی دستیابی تبدیل کرنے کے لیے 'Availability' سیکشن میں جائیں اور نئی تاریخ یا وقت سیٹ کریں۔",
  },
  {
    id: 17,
    text: "نوکری کے بارے میں نوٹیفکیشن کیسے آن کریں؟",
    response:
      "نوٹیفکیشن آن کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور متعلقہ آپشن آن کریں۔",
  },
  {
    id: 18,
    text: "میں ٹھیکیدار کے ساتھ کیسے رابطہ کروں؟",
    response:
      "ٹھیکیدار سے رابطہ کرنے کے لیے 'Contractors' میں جائیں اور 'Contact' آپشن استعمال کریں۔",
  },
  {
    id: 19,
    text: "میری کام کی ریکارڈ کیسے دیکھیں؟",
    response:
      "کام کی ریکارڈ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن کھولیں۔",
  },
  {
    id: 20,
    text: "کیا میں اپنی تنخواہ کا حساب خود دیکھ سکتا ہوں؟",
    response:
      "جی ہاں، 'Salary' سیکشن میں جائیں اور 'Salary Calculator' استعمال کریں۔",
  },
  {
    id: 21,
    text: "میں نئی مہارتیں کیسے سیکھ سکتا ہوں؟",
    response:
      "نئی مہارتیں سیکھنے کے لیے 'Learning' یا 'Skills' سیکشن میں دستیاب کورسز دیکھیں۔",
  },
  {
    id: 22,
    text: "میں کسی شکایت یا مسئلے کی اطلاع کیسے دوں؟",
    response:
      "شکایت یا مسئلے کی اطلاع دینے کے لیے 'Support' > 'Report Issue' استعمال کریں۔",
  },
  {
    id: 32,
    text: "میں اپنا پاسورڈ کیسے بدل سکتا ہوں؟",
    response: "پاسورڈ بدلنے کے لیے 'Settings' > 'Change Password' میں جائیں۔",
  },
  {
    id: 52,
    text: "میں ایپ میں کیسے سائن آؤٹ کروں؟",
    response: "سائن آؤٹ کرنے کے لیے 'Settings' > 'Logout' پر کلک کریں۔",
  },
];

const findMatchingQuestion = (text) => {
  const lowerText = text.toLowerCase();
  const match = questionsData.find(
    (q) => q.text.includes(lowerText) || lowerText.includes(q.text),
  );
  if (match) return match;
  return questionsData.find((q) =>
    q.text.split(" ").some((word) => lowerText.includes(word)),
  );
};

// ─── Email helpers ────────────────────────────────────────────────────────────
async function sendSingleEmail(toEmail, subject, htmlContent) {
  try {
    const mailOptions = {
      from: `"Labour Hub" <${process.env.SMTP_EMAIL}>`,
      to: toEmail,
      subject,
      html: htmlContent,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${toEmail} - ID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email error to ${toEmail}:`, err.message);
    return false;
  }
}

async function sendBulkEmails(users, subject, getHtmlContent) {
  let successCount = 0,
    failCount = 0;
  for (const user of users) {
    try {
      const html = getHtmlContent(user);
      await sendSingleEmail(user.email, subject, html);
      successCount++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failCount++;
    }
  }
  return { successCount, failCount };
}

function getNewJobEmailHTML(job, jobPosterName) {
  const logoUrl =
    "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";
  return `
    <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
      <div style="max-width:600px;background:#fff;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <div style="background:#0a66c2;padding:25px 20px;text-align:center;">
          <img src="${logoUrl}" width="70" height="70" style="border-radius:50%;border:2px solid #fff;margin-bottom:10px;">
          <h1 style="color:#fff;margin:0;">Labour Hub</h1>
        </div>
        <div style="padding:30px 25px;color:#333;">
          <h2 style="color:#0a66c2;">🆕 New Job Posted!</h2>
          <div style="background:#f0f2f5;padding:20px;border-radius:8px;margin:20px 0;">
            <h3 style="margin-top:0;color:#0a66c2;">${job.title}</h3>
            <p><strong>Posted by:</strong> ${jobPosterName}</p>
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Budget:</strong> PKR ${job.budget.toLocaleString()}</p>
            <p><strong>Skills:</strong> ${job.skill}</p>
            <p><strong>Workers Needed:</strong> ${job.workersRequired}</p>
            <p><strong>Shift:</strong> ${job.shift}</p>
          </div>
        </div>
        <div style="background:#f0f2f5;text-align:center;padding:20px;">
          <p style="color:#777;font-size:13px;margin:0;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</p>
        </div>
      </div>
    </div>`;
}

function getJobPosterConfirmationHTML(job) {
  const logoUrl =
    "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";
  return `
    <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
      <div style="max-width:600px;background:#fff;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <div style="background:#0a66c2;padding:25px 20px;text-align:center;">
          <img src="${logoUrl}" width="70" height="70" style="border-radius:50%;border:2px solid #fff;margin-bottom:10px;">
          <h1 style="color:#fff;margin:0;">Labour Hub</h1>
        </div>
        <div style="padding:30px 25px;color:#333;">
          <h2 style="color:#0a66c2;">✅ Job Posted Successfully!</h2>
          <p>Your job "<strong>${job.title}</strong>" has been posted successfully.</p>
          <div style="background:#f0f2f5;padding:20px;border-radius:8px;margin:20px 0;">
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Budget:</strong> PKR ${job.budget.toLocaleString()}</p>
            <p><strong>Workers Needed:</strong> ${job.workersRequired}</p>
          </div>
        </div>
        <div style="background:#f0f2f5;text-align:center;padding:20px;">
          <p style="color:#777;font-size:13px;margin:0;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</p>
        </div>
      </div>
    </div>`;
}

function getApplicationStatusEmailHTML(job, status, contractorName) {
  const logoUrl =
    "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";
  const statusColor = status === "accepted" ? "#16a34a" : "#dc2626";
  const statusText = status === "accepted" ? "Accepted ✅" : "Rejected ❌";
  const msg =
    status === "accepted"
      ? "Congratulations! Your application has been accepted."
      : "Unfortunately, your application was not selected this time.";
  return `
    <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
      <div style="max-width:600px;background:#fff;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <div style="background:#0a66c2;padding:25px 20px;text-align:center;">
          <img src="${logoUrl}" width="70" height="70" style="border-radius:50%;border:2px solid #fff;margin-bottom:10px;">
          <h1 style="color:#fff;margin:0;">Labour Hub</h1>
        </div>
        <div style="padding:30px 25px;color:#333;text-align:center;">
          <h2 style="color:${statusColor};">Application ${statusText}</h2>
          <p><strong>Job:</strong> ${job.title}</p>
          <p><strong>Contractor:</strong> ${contractorName}</p>
          <div style="background:#f0f2f5;padding:20px;border-radius:8px;margin:20px 0;">
            <p style="margin:0;">${msg}</p>
          </div>
        </div>
        <div style="background:#f0f2f5;text-align:center;padding:20px;">
          <p style="color:#777;font-size:13px;margin:0;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</p>
        </div>
      </div>
    </div>`;
}

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Labour", "Contractor"], default: "Labour" },
    image: {
      type: String,
      default:
        "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762757911/Pngtree_user_profile_avatar_13369988_qdlgmg.png",
    },
    skills: { type: [String], default: [] },
    expoPushToken: { type: String, default: null },
    reviews: [
      {
        reviewerEmail: { type: String, required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        feedback: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const jobSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    location: String,
    workersRequired: Number,
    skill: String,
    budget: Number,
    contact: String,
    startDate: Date,
    endDate: Date,
    shift: { type: String, default: "Shift A" },
    jobTime: { type: Date, default: Date.now },
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      firstName: String,
      lastName: String,
      role: String,
      email: String,
    },
    applicants: [
      {
        laborId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        appliedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
      },
    ],
    noOfWorkersApplied: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const jobApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  contractorEmail: { type: String, required: true },
  labourEmail: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
});

const industrySchema = new mongoose.Schema(
  {
    industry: { type: String, required: true },
    owner: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    textileType: { type: String, required: true },
    password: { type: String, required: true },
    active: { type: Boolean, default: false },
    expoPushToken: { type: String, default: null },
  },
  { timestamps: true },
);

const borrowSchema = new mongoose.Schema(
  {
    fromIndustryEmail: { type: String, required: true },
    toIndustryEmail: { type: String, required: true },
    labourRequired: Number,
    skills: String,
    description: String,
    date: String,
    time: String,
    location: String,
    status: { type: String, default: "Pending" },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
const JobApplication =
  mongoose.models.JobApplication ||
  mongoose.model("JobApplication", jobApplicationSchema);
const Industry =
  mongoose.models.Industry || mongoose.model("Industry", industrySchema);
const Borrow = mongoose.models.Borrow || mongoose.model("Borrow", borrowSchema);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
function validateSignupPayload(payload) {
  const errors = [];
  if (!payload.firstName || String(payload.firstName).trim().length < 2)
    errors.push("First name is required (min 2 characters).");
  if (!payload.lastName || String(payload.lastName).trim().length < 1)
    errors.push("Last name is required.");
  if (!payload.phone || !/^\+?[0-9]{7,15}$/.test(String(payload.phone).trim()))
    errors.push(
      "Phone is required (digits only, 7-15 chars, optional leading +).",
    );
  if (!payload.email || !validator.isEmail(String(payload.email)))
    errors.push("A valid email is required.");
  if (!payload.password || String(payload.password).length < 6)
    errors.push("Password is required (min 6 characters).");
  if (!payload.role || !["Labour", "Contractor"].includes(payload.role))
    errors.push("Role must be either 'Labour' or 'Contractor'.");
  return errors;
}

function signJwt(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

const DEFAULT_IMAGE =
  "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png";

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("🚀 Labour Hub APIs are running!"));

app.use("/api/chat", chatRoutes);

// ── AI Chatbot
app.post("/api/chatbot", async (req, res) => {
   req.setTimeout(30000); // 30 seconds timeout
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const translation = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "آپ کا کام صرف انگریزی یا کسی بھی زبان کو اردو میں ترجمہ کرنا ہے، بغیر جواب دیے۔",
        },
        { role: "user", content: message },
      ],
    });
    const messageInUrdu = translation.choices[0].message.content.trim();

    const matchedQuestion = findMatchingQuestion(messageInUrdu);
    if (matchedQuestion) return res.json({ reply: matchedQuestion.response });

    const context = questionsData
      .map((q) => `سوال: ${q.text} | جواب: ${q.response}`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `آپ ایک AI اسسٹنٹ ہیں جو صرف "مزدور اور ٹھیکیدار" موبائل ایپ کے basic flow اور فیچرز کے مطابق جواب دیتا ہے۔\nہمیشہ جواب اردو میں دیں۔\ncontext: ${context}`,
        },
        { role: "user", content: messageInUrdu },
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ error: "سرور میں خرابی پیش آگئی" });
  }
});

// ── Transcribe (not supported on Vercel serverless)
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  return res.status(501).json({
    error:
      "Audio transcription is not available in the serverless environment. Please use a dedicated server for this feature.",
  });
});

// ── Profile Image
app.post(
  "/api/update-profile-image",
  upload.single("image"),
  async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });
    try {
      const imageUrl = req.file.path;
      const user = await User.findOneAndUpdate(
        { email },
        { image: imageUrl },
        { new: true },
      );
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.status(200).json({ message: "Profile image updated", user });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ── Add Review
app.post("/api/users/:email/review", async (req, res) => {
  const { email } = req.params;
  const { reviewerEmail, rating, feedback, jobTitle } = req.body;
  if (!reviewerEmail || !rating)
    return res
      .status(400)
      .json({ message: "Reviewer email and rating are required" });
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $push: { reviews: { reviewerEmail, rating, feedback } } },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.expoPushToken) {
      notification
        .notifyUserAboutNewReview(
          user.expoPushToken,
          reviewerEmail,
          rating,
          jobTitle || null,
        )
        .catch((e) => console.error("Review notification error:", e));
    }
    res.status(200).json({ message: "Review added", user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Get Users
app.get("/api/users", async (req, res) => {
  try {
    const { skill, role, q } = req.query;
    let filter = {};
    if (skill) filter.skills = { $regex: skill, $options: "i" };
    if (role) filter.role = role;
    if (q)
      filter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
      ];
    const users = await User.find(filter).select(
      "firstName lastName email phone role image skills",
    );
    const formattedUsers = users.map((user) => ({
      _id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      image: user.image,
      skills: user.skills,
      role: user.role,
      badge: user.role === "Contractor" ? "🟦 Contractor" : "🟩 Labour",
    }));
    res
      .status(200)
      .json({
        success: true,
        count: formattedUsers.length,
        users: formattedUsers,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/user/skills/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res.json({
      success: true,
      email: user.email,
      skills: user.skills || [],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/user/:email/skills", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const { skill } = req.body;
    if (!skill || !skill.trim())
      return res
        .status(400)
        .json({ success: false, message: "Skill is required" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (user.skills.includes(skill.trim()))
      return res.json({ success: true, message: "Skill already exists" });
    user.skills.push(skill.trim());
    await user.save();
    return res.json({
      success: true,
      message: "Skill added successfully",
      skills: user.skills,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/user/:email/skills/:index", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const index = parseInt(req.params.index);
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (index < 0 || index >= user.skills.length)
      return res
        .status(400)
        .json({ success: false, message: "Invalid skill index" });
    user.skills.splice(index, 1);
    await user.save();
    return res.json({
      success: true,
      message: "Skill deleted",
      skills: user.skills,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/user-by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).select(
      "firstName lastName email image role",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, role, expoPushToken } =
      req.body || {};
    const validationErrors = validateSignupPayload({
      firstName,
      lastName,
      phone,
      email,
      password,
      role,
    });
    if (validationErrors.length)
      return res.status(400).json({ errors: validationErrors });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing)
      return res.status(409).json({ error: "Email already in use." });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = new User({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: String(phone).trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      expoPushToken: expoPushToken || null,
    });

    await user.save();
    const token = signJwt(user);

    return res.status(201).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, expoPushToken } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    if (expoPushToken) {
      user.expoPushToken = expoPushToken;
      await user.save();
    }

    const token = signJwt(user);
    return res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing token." });
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).lean();
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
});

// ── Password Reset
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });
    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user)
      return res
        .status(404)
        .json({ error: "No account found with this email." });
    return res
      .status(200)
      .json({ message: "User found. Proceed to reset password." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res
        .status(400)
        .json({ error: "Email and new password are required." });

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user) return res.status(404).json({ error: "User not found." });

    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame)
      return res.status(400).json({ error: "New password must be different." });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    const logoUrl =
      "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";
    await sendSingleEmail(
      user.email,
      "Labour Hub - Password Changed Successfully",
      `<div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
        <div style="max-width:600px;background:#fff;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1);">
          <div style="background:#0a66c2;padding:25px 20px;text-align:center;">
            <img src="${logoUrl}" width="70" height="70" style="border-radius:50%;border:2px solid #fff;margin-bottom:10px;">
            <h1 style="color:#fff;margin:0;">Labour Hub</h1>
          </div>
          <div style="padding:30px 25px;color:#333;">
            <h2 style="color:#0a66c2;">Password Changed Successfully</h2>
            <p>Dear <strong>${user.email}</strong>,<br><br>Your password has been changed successfully.</p>
            <p>If this wasn't you, please contact support immediately.</p>
          </div>
          <div style="background:#f0f2f5;text-align:center;padding:20px;">
            <p style="color:#777;font-size:13px;margin:0;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</p>
          </div>
        </div>
      </div>`,
    ).catch(console.error);

    return res.status(200).json({ message: "Password reset successfully!" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── Jobs
app.post("/api/jobs/apply/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { labourId, labourEmail } = req.body;
  try {
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const alreadyApplied = job.applicants.some(
      (app) => app.laborId && app.laborId.toString() === labourId,
    );
    if (alreadyApplied)
      return res.status(400).json({ message: "Already applied" });

    job.applicants.push({
      laborId: labourId,
      appliedAt: new Date(),
      status: "pending",
    });
    job.noOfWorkersApplied = job.applicants.length;
    await job.save();

    await JobApplication.create({
      jobId: job._id,
      contractorEmail: job.createdBy.email,
      labourEmail,
    });

    try {
      const [labour, contractor] = await Promise.all([
        User.findById(labourId).select("firstName lastName email"),
        User.findOne({ email: job.createdBy.email }).select("expoPushToken"),
      ]);
      if (contractor?.expoPushToken && labour) {
        await notification.notifyContractorAboutApplication(
          contractor.expoPushToken,
          labour,
          job,
        );
      }
    } catch (notifErr) {
      console.error("❌ Apply notification error:", notifErr);
    }

    res.status(200).json({ message: "Applied successfully", job });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      workersRequired,
      skill,
      budget,
      contact,
      startDate,
      endDate,
      createdBy,
      shift,
      jobTime,
    } = req.body;

    if (
      !title ||
      !description ||
      !location ||
      !workersRequired ||
      !skill ||
      !budget ||
      !contact ||
      !startDate ||
      !endDate
    )
      return res.status(400).json({ message: "All fields are required." });

    const job = new Job({
      title,
      description,
      location,
      workersRequired,
      skill,
      budget,
      contact,
      startDate,
      endDate,
      shift: shift || "Shift A",
      jobTime: jobTime || new Date(),
      createdBy: {
        userId: createdBy.userId,
        firstName: createdBy.firstName,
        lastName: createdBy.lastName,
        role: createdBy.role,
        email: createdBy.email,
      },
    });

    await job.save();

    let notificationResult = { successCount: 0, failCount: 0 };
    let emailResult = { successCount: 0, failCount: 0 };

    try {
      const labourUsers = await User.find({ role: "Labour" }).select(
        "expoPushToken firstName lastName email",
      );
      if (labourUsers.length > 0) {
        const usersWithTokens = labourUsers.filter((u) => u.expoPushToken);
        if (usersWithTokens.length > 0) {
          notificationResult = await notification.notifyLabourUsersAboutNewJob(
            usersWithTokens,
            job,
          );
        }
        const jobPosterName =
          `${createdBy.firstName} ${createdBy.lastName}`.trim();
        emailResult = await sendBulkEmails(
          labourUsers,
          `🔔 New Job Alert: ${job.title} - Labour Hub`,
          () => getNewJobEmailHTML(job, jobPosterName),
        );
      }

      const poster = await User.findById(createdBy.userId);
      if (poster?.email) {
        await sendSingleEmail(
          poster.email,
          `✅ Job Posted Successfully: ${job.title}`,
          getJobPosterConfirmationHTML(job),
        );
      }
    } catch (notifError) {
      console.error("❌ Notification error:", notifError);
    }

    return res.status(201).json({
      message: "Job created successfully",
      job,
      pushNotificationsSent: notificationResult.successCount,
      emailsSent: emailResult.successCount,
    });
  } catch (err) {
    console.error("Error creating job:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/jobs/:jobId/applicants/:labourId/status", async (req, res) => {
  const { jobId, labourId } = req.params;
  const { status } = req.body;

  if (!["accepted", "rejected"].includes(status))
    return res
      .status(400)
      .json({ message: "Status must be 'accepted' or 'rejected'" });

  try {
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const applicant = job.applicants.find(
      (a) => a.laborId.toString() === labourId,
    );
    if (!applicant)
      return res.status(404).json({ message: "Applicant not found" });

    applicant.status = status;
    await job.save();

    const labour = await User.findById(labourId).select(
      "expoPushToken firstName lastName email",
    );
    const contractorName = `${job.createdBy.firstName} ${job.createdBy.lastName}`;

    if (labour?.expoPushToken) {
      await notification
        .notifyLabourAboutApplicationStatus(labour.expoPushToken, job, status)
        .catch(console.error);
    }

    if (labour?.email) {
      await sendSingleEmail(
        labour.email,
        `Application ${status === "accepted" ? "Accepted ✅" : "Rejected ❌"}: ${job.title}`,
        getApplicationStatusEmailHTML(job, status, contractorName),
      );
    }

    res.status(200).json({ message: `Applicant ${status} successfully`, job });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/update-push-token", async (req, res) => {
  try {
    const { email, expoPushToken } = req.body;
    if (!email || !expoPushToken)
      return res.status(400).json({ error: "Email and token required" });
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { expoPushToken },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, message: "Token updated" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/alljobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/my-jobs-email/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const jobs = await Job.find({ "createdBy.email": email }).sort({
      createdAt: -1,
    });
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const {
      userEmail,
      location,
      skill,
      startDate,
      endDate,
      minBudget,
      maxBudget,
    } = req.query;
    const query = {};
    if (userEmail) query["createdBy.email"] = { $ne: userEmail };
    if (location) query.location = location;
    if (skill) query.skill = skill;
    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate) };
      query.endDate = { $lte: new Date(endDate) };
    } else if (startDate) query.startDate = { $gte: new Date(startDate) };
    else if (endDate) query.endDate = { $lte: new Date(endDate) };
    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = Number(minBudget);
      if (maxBudget) query.budget.$lte = Number(maxBudget);
    }
    const jobs = await Job.find(query).sort({ createdAt: -1 });
    const cities = await Job.distinct("location");
    const skillsList = await Job.distinct("skill");
    res.status(200).json({ filters: { cities, skills: skillsList }, jobs });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/profile/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select("firstName lastName role email image createdAt reviews")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    user.image = user.image?.trim() || DEFAULT_IMAGE;

    const reviews = user.reviews || [];
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? (
            reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          ).toFixed(1)
        : 0;

    let jobsCreated = [],
      jobsApplied = [],
      totalApplicantsOnJobs = 0;

    if (user.role === "Contractor") {
      jobsCreated = await Job.find({ "createdBy.email": email }).lean();
      totalApplicantsOnJobs = jobsCreated.reduce(
        (acc, job) => acc + (job.applicants?.length || 0),
        0,
      );
    } else {
      const applications = await Job.find({
        "applicants.laborId": user._id,
      }).lean();
      jobsApplied = applications.map((job) => {
        const applicant = job.applicants.find(
          (a) => a.laborId.toString() === user._id.toString(),
        );
        return {
          jobId: job._id,
          title: job.title,
          status: applicant?.status || "pending",
          appliedAt: applicant?.appliedAt || null,
          contractor: job.createdBy,
        };
      });
    }

    res.json({
      user: { ...user, averageRating, totalReviews },
      reviews,
      stats: {
        totalJobsPosted: jobsCreated.length,
        totalJobsApplied: jobsApplied.length,
        totalApplicantsOnJobs,
      },
      jobsCreated,
      jobsApplied,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/jobs/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const jobsCreated = await Job.find({ "createdBy.email": email })
      .sort({ createdAt: -1 })
      .lean();
    const jobApplications = await JobApplication.find({
      labourEmail: email,
    }).lean();

    const jobsApplied = [];
    for (const app of jobApplications) {
      const job = await Job.findById(app.jobId).lean();
      if (!job) continue;
      jobsApplied.push({
        jobId: job._id,
        title: job.title,
        status: "pending",
        appliedAt: app.appliedAt,
        contractor: {
          firstName: job.createdBy.firstName,
          lastName: job.createdBy.lastName,
          email: job.createdBy.email,
          role: job.createdBy.role,
          image: job.createdBy.image || DEFAULT_IMAGE,
        },
      });
    }

    res.status(200).json({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        image: user.image || DEFAULT_IMAGE,
      },
      stats: {
        totalJobsPosted: jobsCreated.length,
        totalJobsApplied: jobsApplied.length,
      },
      jobsCreated,
      jobsApplied,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/responses-by-contractor/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const applications = await JobApplication.find({
      contractorEmail: email,
    }).lean();
    if (!applications || applications.length === 0)
      return res.status(404).json({ message: "No responses found" });

    const results = [];
    for (const app of applications) {
      const job = await Job.findById(app.jobId).lean();
      if (!job) continue;
      const labour = await User.findOne({ email: app.labourEmail }).lean();
      results.push({
        applicationId: app._id,
        jobId: job._id,
        jobTitle: job.title,
        jobDescription: job.description,
        location: job.location,
        workersRequired: job.workersRequired,
        appliedAt: app.appliedAt,
        labour: {
          labourId: labour?._id || null,
          firstName: labour?.firstName || "Unknown",
          lastName: labour?.lastName || "Unknown",
          email: labour?.email || app.labourEmail,
          role: labour?.role || "Labour",
          image: labour?.image || DEFAULT_IMAGE,
        },
      });
    }

    res
      .status(200)
      .json({
        contractorEmail: email,
        totalResponses: results.length,
        responses: results,
      });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/search-jobs", async (req, res) => {
  try {
    const { skill, name } = req.query;
    const query = {};
    if (skill && skill.trim() !== "")
      query.skill = { $regex: new RegExp(skill, "i") };
    if (name && name.trim() !== "")
      query.title = { $regex: new RegExp(name, "i") };
    const jobs = await Job.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/apply/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { labourEmail } = req.body;
    if (!labourEmail)
      return res.status(400).json({ message: "Labour email is required" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const exists = await JobApplication.findOne({ jobId, labourEmail });
    if (exists) return res.status(400).json({ message: "Already applied" });

    const application = new JobApplication({
      jobId,
      contractorEmail: job.createdBy.email,
      labourEmail,
    });
    await application.save();

    job.noOfWorkersApplied = (job.noOfWorkersApplied || 0) + 1;
    await job.save();

    try {
      const [labour, contractor] = await Promise.all([
        User.findOne({ email: labourEmail }).select("firstName lastName email"),
        User.findOne({ email: job.createdBy.email }).select("expoPushToken"),
      ]);
      if (contractor?.expoPushToken && labour) {
        await notification.notifyContractorAboutApplication(
          contractor.expoPushToken,
          labour,
          job,
        );
      }
    } catch (notifErr) {
      console.error("❌ Apply notification error:", notifErr);
    }

    res.status(200).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/get-user-by-email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/check-application/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const userEmail = req.query.email?.trim().toLowerCase();
    if (!userEmail)
      return res.status(400).json({ message: "Email is required" });
    const application = await JobApplication.findOne({
      jobId,
      labourEmail: userEmail,
    });
    res.json({
      applied: !!application,
      message: application ? "User already applied" : "User has not applied",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Industry Routes
app.post("/api/industries", async (req, res) => {
  try {
    const { industry, owner, email, phone, address, textileType, password } =
      req.body;
    if (
      !industry ||
      !owner ||
      !email ||
      !phone ||
      !address ||
      !textileType ||
      !password
    )
      return res.status(400).json({ message: "All fields are required" });
    if (!validator.isEmail(email))
      return res.status(400).json({ message: "Invalid email format" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });

    const existing = await Industry.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newIndustry = await Industry.create({
      industry,
      owner,
      email,
      phone,
      address,
      textileType,
      password: hashedPassword,
    });
    res
      .status(201)
      .json({
        message: "Industry registered successfully",
        industry: newIndustry,
      });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/industries/login", async (req, res) => {
  try {
    const { email, password, expoPushToken } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    if (!validator.isEmail(email))
      return res.status(400).json({ message: "Invalid email format" });

    const industry = await Industry.findOne({ email });
    if (!industry)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, industry.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (expoPushToken) {
      industry.expoPushToken = expoPushToken;
      await industry.save();
    }

    const token = jwt.sign(
      { id: industry._id, email: industry.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );
    res
      .status(200)
      .json({
        message: "Login successful",
        email: industry.email,
        token,
        active: industry.active,
      });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/industries/all", async (req, res) => {
  try {
    const { email, search } = req.query;
    let query = { active: true, email: { $ne: email } };
    if (search) query.industry = { $regex: search, $options: "i" };
    const industries = await Industry.find(query).select(
      "industry email address textileType",
    );
    res.status(200).json(industries);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/industries/profile", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string")
      return res.status(400).json({ message: "Email is required" });
    const industry = await Industry.findOne({ email }).select("-password");
    if (!industry)
      return res.status(404).json({ message: "Industry not found" });
    res.status(200).json(industry);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/industries/update-push-token", async (req, res) => {
  try {
    const { email, expoPushToken } = req.body;
    if (!email || !expoPushToken)
      return res.status(400).json({ error: "Email and token required" });
    const industry = await Industry.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { expoPushToken },
      { new: true },
    );
    if (!industry) return res.status(404).json({ error: "Industry not found" });
    res.json({ success: true, message: "Token updated" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Borrow Routes
app.post("/api/borrow", async (req, res) => {
  try {
    const borrow = await Borrow.create(req.body);
    res.status(201).json({ message: "Borrow request sent", borrow });

    const {
      toIndustryEmail,
      fromIndustryEmail,
      labourRequired,
      skills,
      description,
      fromDate,
      toDate,
      shift,
      shiftTime,
      location,
    } = req.body;

    if (!toIndustryEmail) return;

    try {
      const targetIndustry = await Industry.findOne({ email: toIndustryEmail });
      if (targetIndustry?.expoPushToken) {
        await notification.notifyIndustryAboutBorrowRequest(
          targetIndustry.expoPushToken,
          fromIndustryEmail,
          borrow,
        );
      }
    } catch (notifErr) {
      console.error("❌ Borrow push error:", notifErr);
    }

    const emailHtml = `
      <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
        <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.12)">
          <div style="background:linear-gradient(135deg,#0a66c2,#004182);padding:26px;text-align:center;">
            <h1 style="color:#fff;margin:0;">Labour Hub</h1>
            <p style="color:#dbeafe;margin-top:6px;">New Borrow Request</p>
          </div>
          <div style="padding:30px;color:#1f2937;">
            <p>You have received a <strong>new labour borrow request</strong> from <strong>${fromIndustryEmail}</strong>.</p>
            <div style="background:#f9fafb;padding:20px;border-radius:12px;border:1px solid #e5e7eb;">
              <table width="100%" style="font-size:14px;">
                <tr><td>Labour Required</td><td><strong>${labourRequired}</strong></td></tr>
                <tr><td>Skills</td><td><strong>${skills}</strong></td></tr>
                <tr><td>Duration</td><td>${fromDate} → ${toDate}</td></tr>
                <tr><td>Shift</td><td>${shift} (${shiftTime})</td></tr>
                <tr><td>Location</td><td>${location}</td></tr>
                <tr><td>Description</td><td>${description}</td></tr>
              </table>
            </div>
          </div>
          <div style="background:#f3f4f6;padding:18px;text-align:center;font-size:13px;color:#6b7280;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</div>
        </div>
      </div>`;

    await sendSingleEmail(
      toIndustryEmail,
      "Labour Hub - New Labour Borrow Request",
      emailHtml,
    ).catch(console.error);
  } catch (err) {
    console.error("❌ Borrow API error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/my-borrows/:email", async (req, res) => {
  try {
    const myBorrows = await Borrow.find({
      fromIndustryEmail: req.params.email,
    });
    if (!myBorrows.length)
      return res.status(404).json({ message: "No borrow records found." });
    res.status(200).json(myBorrows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/incoming-borrows/:email", async (req, res) => {
  try {
    const incomingBorrows = await Borrow.find({
      toIndustryEmail: req.params.email,
    });
    if (!incomingBorrows.length)
      return res.status(404).json({ message: "No incoming requests." });
    res.status(200).json(incomingBorrows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/approve-borrow/:id", async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.id);
    if (!borrow)
      return res.status(404).json({ message: "Borrow request not found." });

    borrow.status = "Approved";
    await borrow.save();

    try {
      const requesterIndustry = await Industry.findOne({
        email: borrow.fromIndustryEmail,
      });
      if (requesterIndustry?.expoPushToken) {
        await notification.notifyIndustryAboutBorrowApproval(
          requesterIndustry.expoPushToken,
          borrow,
        );
      }
    } catch (notifErr) {
      console.error("❌ Borrow approval push error:", notifErr);
    }

    const approvalHtml = `
      <div style="font-family:'Segoe UI',sans-serif;background:#f5f7fa;padding:40px 0;">
        <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.12)">
          <div style="background:linear-gradient(135deg,#0a66c2,#004182);padding:26px;text-align:center;">
            <h1 style="color:#fff;margin:0;">Labour Hub</h1>
            <p style="color:#dbeafe;margin-top:6px;">Borrow Request Approved</p>
          </div>
          <div style="padding:30px;color:#1f2937;">
            <p>Your borrow request to <strong>${borrow.toIndustryEmail}</strong> has been <strong>approved</strong>.</p>
          </div>
          <div style="background:#f3f4f6;padding:18px;text-align:center;font-size:13px;color:#6b7280;">© ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan</div>
        </div>
      </div>`;

    await sendSingleEmail(
      borrow.fromIndustryEmail,
      "Labour Hub - Borrow Request Approved",
      approvalHtml,
    ).catch(console.error);

    res.status(200).json({ message: "Borrow request approved", borrow });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Admin Panel
app.post("/api/admin/industry-toggle/:id", async (req, res) => {
  try {
    const industry = await Industry.findById(req.params.id);
    if (!industry) return res.status(404).json({ error: "Industry not found" });
    industry.active = !industry.active;
    await industry.save();
    res.json({ success: true, active: industry.active });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin", async (req, res) => {
  try {
    const users = await User.find().lean();
    const jobs = await Job.find().lean();
    const applications = await JobApplication.find().lean();
    const industries = await Industry.find().lean();
    const borrows = await Borrow.find().lean();

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Labour Hub | Admin Panel</title>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:"Segoe UI",sans-serif;background:#f4f6f9;padding:20px;}
    h1{color:#0a66c2;} h2{margin-top:40px;color:#111827;border-left:6px solid #0a66c2;padding-left:10px;}
    table{width:100%;border-collapse:collapse;margin-top:15px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.06);border-radius:10px;overflow:hidden;}
    th,td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:left;}
    th{background:#0a66c2;color:#fff;font-weight:600;}
    tr:nth-child(even){background:#f9fafb;} tr:hover{background:#eef2ff;}
    .badge{padding:4px 8px;border-radius:6px;font-size:12px;color:white;}
    .green{background:#16a34a;} .red{background:#dc2626;} .blue{background:#2563eb;} .gray{background:#6b7280;}
    button{border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;color:#fff;}
  </style>
</head>
<body>
<h1>📊 Labour Hub – Admin Panel</h1>
<h2>👤 Users (${users.length})</h2>
<table>
<tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Skills</th><th>Push Token</th></tr>
${users.map((u) => `<tr>
  <td>${u.firstName} ${u.lastName}</td><td>${u.email}</td><td>${u.phone}</td>
  <td><span class="badge blue">${u.role}</span></td>
  <td>${u.skills?.join(", ") || "-"}</td>
  <td><span class="badge ${u.expoPushToken ? "green" : "gray"}">${u.expoPushToken ? "✅ Yes" : "❌ No"}</span></td>
</tr>`).join("")}
</table>
<h2>🛠 Jobs (${jobs.length})</h2>
<table>
<tr><th>Title</th><th>Location</th><th>Skill</th><th>Budget</th><th>Workers</th><th>Applicants</th><th>Posted By</th></tr>
${jobs.map((j) => `<tr>
  <td>${j.title}</td><td>${j.location}</td><td>${j.skill}</td>
  <td>${j.budget}</td><td>${j.workersRequired}</td><td>${j.noOfWorkersApplied || 0}</td>
  <td>${j.createdBy?.email || "-"}</td>
</tr>`).join("")}
</table>
<h2>📄 Applications (${applications.length})</h2>
<table>
<tr><th>Job ID</th><th>Contractor</th><th>Labour</th><th>Date</th></tr>
${applications.map((a) => `<tr>
  <td>${a.jobId}</td><td>${a.contractorEmail}</td>
  <td>${a.labourEmail}</td><td>${new Date(a.appliedAt).toLocaleString()}</td>
</tr>`).join("")}
</table>
<h2>🏭 Industries (${industries.length})</h2>
<table>
<tr><th>Industry</th><th>Owner</th><th>Email</th><th>Textile</th><th>Push Token</th><th>Status</th></tr>
${industries.map((i) => `<tr>
  <td>${i.industry}</td><td>${i.owner}</td><td>${i.email}</td><td>${i.textileType}</td>
  <td><span class="badge ${i.expoPushToken ? "green" : "gray"}">${i.expoPushToken ? "✅ Yes" : "❌ No"}</span></td>
  <td><button style="background:${i.active ? "#16a34a" : "#dc2626"}" onclick="toggleIndustry('${i._id}', ${i.active})">${i.active ? "Active" : "Inactive"}</button></td>
</tr>`).join("")}
</table>
<h2>🔄 Borrow Requests (${borrows.length})</h2>
<table>
<tr><th>From</th><th>To</th><th>Labour</th><th>Skills</th><th>Location</th><th>Status</th></tr>
${borrows.map((b) => `<tr>
  <td>${b.fromIndustryEmail}</td><td>${b.toIndustryEmail}</td>
  <td>${b.labourRequired}</td><td>${b.skills}</td><td>${b.location}</td>
  <td><span class="badge ${b.status === "Approved" ? "green" : b.status === "Rejected" ? "red" : "gray"}">${b.status}</span></td>
</tr>`).join("")}
</table>
<footer style="margin-top:40px;text-align:center;color:#6b7280;font-size:13px;">© ${new Date().getFullYear()} Labour Hub · Admin Panel</footer>
<script>
function toggleIndustry(id, currentStatus) {
  if (!confirm((currentStatus ? "Deactivate" : "Activate") + " this industry?")) return;
  fetch("/api/admin/industry-toggle/" + id, { method: "POST" })
    .then(r => r.json()).then(() => location.reload())
    .catch(err => alert("Failed: " + err.message));
}
</script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ── Debug / Utility
app.get("/api/debug-users", async (req, res) => {
  try {
    const allUsers = await User.find({}).select(
      "email role expoPushToken createdAt",
    );
    const labourUsers = allUsers.filter((u) => u.role === "Labour");
    res.json({
      totalUsers: allUsers.length,
      usersWithTokens: allUsers.filter((u) => u.expoPushToken).length,
      labourUsers: labourUsers.length,
      labourWithTokens: labourUsers.filter((u) => u.expoPushToken).length,
      details: allUsers.map((u) => ({
        email: u.email,
        role: u.role,
        hasToken: !!u.expoPushToken,
        tokenPreview: u.expoPushToken
          ? u.expoPushToken.substring(0, 30) + "..."
          : null,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/manual-add-token", async (req, res) => {
  try {
    const { email, expoPushToken } = req.body;
    if (!email || !expoPushToken)
      return res.status(400).json({ error: "Email and token required" });
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim(), role: "Labour" },
      { expoPushToken },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "Labour user not found" });
    res.json({
      success: true,
      message: `Token added for ${email}`,
      user: { email: user.email, role: user.role, hasToken: true },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/test-email", async (req, res) => {
  try {
    const testEmail = req.query.email || process.env.SMTP_EMAIL;
    const result = await sendSingleEmail(
      testEmail,
      "🔔 Labour Hub - SMTP Test Email",
      `<div style="font-family:Arial,sans-serif;padding:20px;">
        <h2 style="color:#0a66c2;">✅ SMTP Test Successful!</h2>
        <p>Your SMTP configuration is working. Time: ${new Date().toLocaleString()}</p>
      </div>`,
    );
    res.json({ success: result, sentTo: testEmail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add this endpoint to your existing API
app.post("/api/send-agreement-email", async (req, res) => {
  try {
    const { fromEmail, toEmail, fromCompany, toCompany, partyType, description, labourSignature, contractorSignature } = req.body;

    if (!fromEmail || !toEmail) {
      return res.status(400).json({ error: "Both emails are required" });
    }

    // Create HTML content for the agreement
    const agreementHTML = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #fff;">
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #1e3a8a, #0a66c2); color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">LABOUR HUB</h1>
          <p style="margin: 5px 0 0;">Official Labour & Contractor Agreement</p>
        </div>
        
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>From Company:</strong> ${fromCompany}</p>
            <p><strong>To Company:</strong> ${toCompany}</p>
            <p><strong>Agreement Type:</strong> ${partyType}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <h3 style="color: #1e3a8a;">1. Scope of Work</h3>
          <p>${description}</p>

          <h3 style="color: #1e3a8a;">2. Responsibilities</h3>
          <p>The service provider shall comply with labour laws, safety policies, and professional conduct requirements.</p>

          <h3 style="color: #1e3a8a;">3. Payment Terms</h3>
          <p>Payments shall be processed as mutually agreed. Labour Hub holds no responsibility for payment disputes.</p>

          <h3 style="color: #1e3a8a;">4. Confidentiality</h3>
          <p>All business and operational information shall remain strictly confidential.</p>

          <h3 style="color: #1e3a8a;">5. Termination</h3>
          <p>Either party may terminate this agreement with written notice upon violation of terms.</p>

          <h3 style="color: #1e3a8a;">6. Governing Law</h3>
          <p>This agreement shall be governed under the laws of Pakistan.</p>

          <h3 style="color: #1e3a8a;">7. Digital Acceptance</h3>
          <p>This document is legally binding upon digital confirmation.</p>

          <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <div style="text-align: center; flex: 1;">
              <h4>Labour Signature</h4>
              ${labourSignature ? `<img src="${labourSignature}" style="max-width: 200px; border: 1px solid #ccc; padding: 10px;" />` : '<p style="color: #999;">Not signed</p>'}
            </div>
            <div style="text-align: center; flex: 1;">
              <h4>Contractor Signature</h4>
              ${contractorSignature ? `<img src="${contractorSignature}" style="max-width: 200px; border: 1px solid #ccc; padding: 10px;" />` : '<p style="color: #999;">Not signed</p>'}
            </div>
          </div>

          <div style="margin-top: 40px; padding-top: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
            <p>Labour Hub - Digital Contract System</p>
            <p>Email: fyplabourhub@gmail.com | Contact: 0334-112212</p>
            <p>This is a digitally generated contract. No physical signature required.</p>
          </div>
        </div>
      </div>
    `;

    // Send email to both parties
    const emailSubject = `Labour Contract Agreement: ${fromCompany} & ${toCompany}`;
    
    const emailPromises = [
      sendSingleEmail(fromEmail, emailSubject, agreementHTML),
      sendSingleEmail(toEmail, emailSubject, agreementHTML)
    ];

    await Promise.all(emailPromises);

    res.status(200).json({ 
      success: true, 
      message: "Agreement sent successfully to both parties",
      sentTo: [fromEmail, toEmail]
    });

  } catch (error) {
    console.error("Error sending agreement email:", error);
    res.status(500).json({ error: "Failed to send agreement email" });
  }
});




// ─── Export for Vercel ────────────────────────────────────────────────────────
module.exports = app;
