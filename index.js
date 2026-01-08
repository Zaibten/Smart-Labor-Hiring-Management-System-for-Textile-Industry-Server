const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const OpenAI = require("openai");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const twilio = require("twilio");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();


const app = express();
app.use(express.json());

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "audio_uploads", resource_type: "auto" },
});
const upload = multer({ storage });

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


/* ---------- Basic middlewares ---------- */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

// small rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", authLimiter);

/* ---------- Mongoose user schema ---------- */
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Labour", "Contractor"], default: "Labour" },
    image: { 
      type: String, 
      default: "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762757911/Pngtree_user_profile_avatar_13369988_qdlgmg.png" 
    },
    skills: { type: [String], default: [] },
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
  { timestamps: true }
);


const User = mongoose.model("User", userSchema);

app.post("/api/update-profile-image", upload.single("image"), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  if (!req.file) return res.status(400).json({ message: "No image uploaded" });

  try {
    // Save only Cloudinary URL
    const imageUrl = req.file.path; // <-- keep this as is
    const user = await User.findOneAndUpdate({ email }, { image: imageUrl }, { new: true });

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "Profile image updated", user });
  } catch (err) {
    console.log("Server error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/api/users/:email/review", async (req, res) => {
  const { email } = req.params;
  const { reviewerEmail, rating, feedback } = req.body;

  if (!reviewerEmail || !rating) {
    return res.status(400).json({ message: "Reviewer email and rating are required" });
  }

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $push: { reviews: { reviewerEmail, rating, feedback } } },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Review added", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




app.get("/api/users", async (req, res) => {
  try {
    const { skill, role, q } = req.query;

    let filter = {};

    // 🔎 Search by skill (case-insensitive)
    if (skill) {
      filter.skills = { $regex: skill, $options: "i" };
    }

    // 🔎 Filter by role
    if (role) {
      filter.role = role;
    }

    // 🔎 Search by name
    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
      ];
    }

    const users = await User.find(filter).select(
      "firstName lastName email phone role image skills"
    );

    // 🏷 Add badge dynamically
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      image: user.image,
      skills: user.skills,
      role: user.role,
      badge: user.role === "Contractor" ? "🟦 Contractor" : "🟩 Labour",
    }));

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers,
    });

  } catch (error) {
    console.error("User Fetch Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ---------- Get Current User ----------
app.get("/api/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------- Get Skills by Email ----------
app.get("/api/user/skills/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      email: user.email,
      skills: user.skills || []
    });

  } catch (err) {
    console.error("Error fetching skills:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching skills",
    });
  }
});



// Get user by email
app.get("/api/user-by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).select("firstName lastName email image role");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ---------- Helpers ---------- */

function validateSignupPayload(payload) {
  const errors = [];

  if (!payload.firstName || String(payload.firstName).trim().length < 2) {
    errors.push("First name is required (min 2 characters).");
  }
  if (!payload.lastName || String(payload.lastName).trim().length < 1) {
    errors.push("Last name is required.");
  }
  if (!payload.phone || !/^\+?[0-9]{7,15}$/.test(String(payload.phone).trim())) {
    errors.push("Phone is required (digits only, 7-15 chars, optional leading +).");
  }
  if (!payload.email || !validator.isEmail(String(payload.email))) {
    errors.push("A valid email is required.");
  }
  if (!payload.password || String(payload.password).length < 6) {
    errors.push("Password is required (min 6 characters).");
  }
  if (!payload.role || !["Labour", "Contractor"].includes(payload.role)) {
    errors.push("Role must be either 'Labour' or 'Contractor'.");
  }

  return errors;
}

function signJwt(user) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    secret,
    { expiresIn }
  );
}



/* Protected test endpoint example */
app.get("/api/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token." });
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    const userId = decoded.sub;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found." });

    return res.json({ user: { id: user._id, email: user.email, firstName: user.firstName, role: user.role } });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
});

// ===================== FORGOT PASSWORD =====================
// Check if user exists by email
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: "No account found with this email." });

    // You can send a reset email here if you want.
    return res.status(200).json({ message: "User found. Proceed to reset password." });
  } catch (err) {
    console.error("Forgot Password error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ---------------- SendGrid Setup ----------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ error: "Email and new password are required." });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found." });

    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame)
      return res
        .status(400)
        .json({ error: "New password must be different from your old password." });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordHash = passwordHash;
    await user.save();

    // ---------------- Read and Encode Logo ----------------
   const logoUrl = "https://res.cloudinary.com/dh7kv5dzy/image/upload/v1762834364/logo_je7mnb.png";


    // ---------------- Send Email ----------------
    try {
const msg = {
  to: user.email,
  from: process.env.SENDGRID_VERIFIED_SENDER,
  subject: "Labour Hub - Password Changed Successfully",
  html: `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f5f7fa; padding: 40px 0;">
      <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <div style="background-color: #0a66c2; padding: 25px 20px; text-align: center;">
          <img src="${logoUrl}" alt="Labour Hub Logo" width="70" height="70" style="border-radius: 50%; border: 2px solid #ffffff; margin-bottom: 10px;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Labour Hub</h1>
        </div>

        <div style="padding: 30px 25px; color: #333333;">
          <h2 style="color: #0a66c2; font-size: 20px;">Password Changed Successfully</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Dear <strong>${user.email}</strong>,<br><br>
            Your <strong>Labour Hub</strong> account password has been changed successfully.
          </p>
          <p>If this wasn't you, please contact our support team immediately.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://labourhub.pk/login" style="background-color: #0a66c2; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold;">
              Go to Login
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
await sgMail.send(msg);


      await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${user.email}`);
    } catch (err) {
      console.error("Email send failed:", err.response ? err.response.body : err);
    }

    return res.status(200).json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("Reset Password error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});



const DEFAULT_IMAGE = "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png";

// API to get user by ID
app.get("/api/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("firstName lastName role email image");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || "",
      email: user.email || "",
      image: user.image && user.image.trim() !== "" ? user.image : DEFAULT_IMAGE,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// ==================== SCHEMA ====================
const jobSchema = new mongoose.Schema({
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
      status: { type: String, enum: ["pending","accepted","rejected"], default: "pending" },
      chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    }
  ],
  noOfWorkersApplied: { type: Number, default: 0 }, // NEW
}, { timestamps: true });

const Job = mongoose.model("Job", jobSchema);


const jobApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  contractorEmail: { type: String, required: true },
  labourEmail: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
});



const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
module.exports = JobApplication;


app.post("/api/jobs/apply/:jobId", async (req, res) => {
  const { jobId } = req.params;
const { labourId, labourEmail } = req.body;


  try {
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Check if labour already applied
const alreadyApplied = job.applicants.some(
  app => app.laborId && app.laborId.toString() === labourId
);

    if (alreadyApplied) return res.status(400).json({ message: "Already applied" });

    // Add labour to job
job.applicants.push({ laborId: labourId, appliedAt: new Date(), status: "pending" });
job.noOfWorkersApplied = job.applicants.length;
await job.save();


    // Save in JobApplications collection
    await JobApplication.create({
      jobId: job._id,
      contractorEmail: job.createdBy.email,
      labourEmail,
    });

    res.status(200).json({ message: "Applied successfully", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==================== ROUTE ====================
// Create a new job
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
    } = req.body;

    if (!title || !description || !location || !workersRequired || !skill || !budget || !contact || !startDate || !endDate) {
      return res.status(400).json({ message: "All fields are required." });
    }

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
      createdBy: {
        ...createdBy,
        email: createdBy.email, // store email here
      },
    });

    await job.save();
    return res.status(201).json({ message: "Job created successfully", job });
  } catch (err) {
    console.error("Error creating job:", err);
    return res.status(500).json({ message: "Server error" });
  }
});




// ==================== 1. Get all jobs ====================
app.get("/api/alljobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }); // latest jobs first
    res.status(200).json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==================== 2. Get jobs created by a specific contractor by email ====================
app.get("/api/my-jobs-email/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const jobs = await Job.find({ "createdBy.email": email }).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (err) {
    console.error(`Error fetching jobs for ${email}:`, err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const {
      userEmail, // current logged-in user to exclude their jobs
      location,
      skill,
      startDate,
      endDate,
      minBudget,
      maxBudget,
    } = req.query;

    // Build dynamic query
    const query = {};

    // Exclude current user's jobs
    if (userEmail) {
      query["createdBy.email"] = { $ne: userEmail };
    }

    if (location) query.location = location;
    if (skill) query.skill = skill;

    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate) };
      query.endDate = { $lte: new Date(endDate) };
    } else if (startDate) {
      query.startDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.endDate = { $lte: new Date(endDate) };
    }

    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = Number(minBudget);
      if (maxBudget) query.budget.$lte = Number(maxBudget);
    }

    // Fetch filtered jobs
    const jobs = await Job.find(query).sort({ createdAt: -1 });

    // Fetch dropdown options dynamically
    const cities = await Job.distinct("location");
    const skillsList = await Job.distinct("skill");

    res.status(200).json({
      filters: { cities, skills: skillsList },
      jobs,
    });
  } catch (err) {
    console.error("Filter Jobs Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==================== PROFILE API ====================
app.get("/api/profile/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select("firstName lastName role email image createdAt reviews")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const DEFAULT_IMAGE =
      "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png";
    user.image = user.image?.trim() || DEFAULT_IMAGE;

    // ⭐ Reviews logic
    const reviews = user.reviews || [];
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? (
            reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          ).toFixed(1)
        : 0;

    let jobsCreated = [];
    let jobsApplied = [];
    let totalApplicantsOnJobs = 0;

    if (user.role === "Contractor") {
      jobsCreated = await Job.find({ "createdBy.email": email }).lean();
      totalApplicantsOnJobs = jobsCreated.reduce(
        (acc, job) => acc + (job.applicants?.length || 0),
        0
      );
    } else {
      const applications = await Job.find({ "applicants.laborId": user._id }).lean();
      jobsApplied = applications.map(job => {
        const applicant = job.applicants.find(
          a => a.laborId.toString() === user._id.toString()
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
      user: {
        ...user,
        averageRating,
        totalReviews,
      },
      reviews, // ⭐ FULL REVIEWS ARRAY
      stats: {
        totalJobsPosted: jobsCreated.length,
        totalJobsApplied: jobsApplied.length,
        totalApplicantsOnJobs,
      },
      jobsCreated,
      jobsApplied,
    });
  } catch (err) {
    console.error("Profile API error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ==================== Get jobs a user applied to ====================
app.get("/api/jobs/user/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Find user
    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Jobs the user created (if Contractor)
    const jobsCreated = await Job.find({ "createdBy.email": email }).sort({ createdAt: -1 }).lean();

    // Jobs the user applied to (from JobApplication collection)
    const jobApplications = await JobApplication.find({ labourEmail: email }).lean();

    const jobsApplied = [];
    for (const app of jobApplications) {
      const job = await Job.findById(app.jobId).lean();
      if (!job) continue;

      jobsApplied.push({
        jobId: job._id,
        title: job.title,
        status: "pending", // default or you can extend to fetch from Job.applicants
        appliedAt: app.appliedAt,
        contractor: {
          firstName: job.createdBy.firstName,
          lastName: job.createdBy.lastName,
          email: job.createdBy.email,
          role: job.createdBy.role,
          image: job.createdBy.image || "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png",
        },
      });
    }

    res.status(200).json({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        image: user.image || "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png",
      },
      stats: {
        totalJobsPosted: jobsCreated.length,
        totalJobsApplied: jobsApplied.length,
      },
      jobsCreated,
      jobsApplied,
    });
  } catch (err) {
    console.error("Error fetching user jobs:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==================== Get all responses for jobs posted by a contractor ====================
app.get("/api/responses-by-contractor/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Step 1: Find all job applications for this contractor
    const applications = await JobApplication.find({ contractorEmail: email }).lean();
    if (!applications || applications.length === 0) {
      return res.status(404).json({ message: "No responses found for this contractor" });
    }

    // Step 2: For each application, fetch job info and labour info
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
          image: labour?.image || "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png",
        },
      });
    }

    res.status(200).json({
      contractorEmail: email,
      totalResponses: results.length,
      responses: results,
    });
  } catch (err) {
    console.error("Error fetching contractor responses:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==================== SEARCH JOBS (by skill + name) ====================
app.get("/api/search-jobs", async (req, res) => {
  try {
    const { skill, name } = req.query;

    // Build query object dynamically
    const query = {};

    if (skill && skill.trim() !== "") {
      query.skill = { $regex: new RegExp(skill, "i") };  // case-insensitive match
    }

    if (name && name.trim() !== "") {
      query.title = { $regex: new RegExp(name, "i") };
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: jobs.length,
      jobs,
    });

  } catch (err) {
    console.error("Search Jobs Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while searching jobs",
    });
  }
});


app.post("/api/apply/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { labourEmail } = req.body; // get email from frontend

    if (!labourEmail) {
      return res.status(400).json({ message: "Labour email is required" });
    }

    // Fetch job
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Check if already applied
    const exists = await JobApplication.findOne({ jobId, labourEmail });
    if (exists) return res.status(400).json({ message: "Already applied" });

    const application = new JobApplication({
      jobId,
      contractorEmail: job.createdBy.email,
      labourEmail,
    });

    await application.save();

    // Update job's applicant count
    job.noOfWorkersApplied = (job.noOfWorkersApplied || 0) + 1;
    await job.save();

    res.status(200).json({ success: true, application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// Get user by email
app.get("/api/get-user-by-email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id });
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= Check Application Status (Using Logged-in User) =================
app.get("/api/check-application/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const userEmail = req.query.email?.trim().toLowerCase();

    if (!userEmail) {
      return res.status(400).json({ message: "Email is required for testing" });
    }

    const application = await JobApplication.findOne({
      jobId,
      labourEmail: userEmail
    });

    res.json({
      applied: !!application,
      message: application
        ? "User already applied"
        : "User has not applied"
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// Industry Mongoose Schema
const industrySchema = new mongoose.Schema({
  industry: { type: String, required: true },
  owner: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  textileType: { type: String, required: true },
  password: { type: String, required: true }, // hashed

  // ✅ NEW FIELD
  active: { type: Boolean, default: false },

}, { timestamps: true })

const Industry = mongoose.model('Industry', industrySchema)


// Create Industry API
app.post('/api/industries', async (req, res) => {
  try {
    const { industry, owner, email, phone, address, textileType, password } = req.body

    // Validate required fields
    if (!industry || !owner || !email || !phone || !address || !textileType || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    // Check if email already exists
    const existing = await Industry.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Email already registered' })

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Save to DB (active will default to false)
    const newIndustry = await Industry.create({
      industry,
      owner,
      email,
      phone,
      address,
      textileType,
      password: hashedPassword
    })

    res.status(201).json({
      message: 'Industry registered successfully',
      industry: newIndustry
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})


// Get all active industries except current logged-in one
app.get('/api/industries/all', async (req, res) => {
  try {
    const { email, search } = req.query

    let query = {
      active: true,
      email: { $ne: email }, // exclude logged-in industry
    }

    if (search) {
      query.industry = { $regex: search, $options: 'i' }
    }

    const industries = await Industry.find(query).select(
      'industry email address textileType'
    )

    res.status(200).json(industries)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

const borrowSchema = new mongoose.Schema({
  fromIndustryEmail: { type: String, required: true },
  toIndustryEmail: { type: String, required: true },

  labourRequired: Number,
  skills: String,
  description: String,
  date: String,
  time: String,
  location: String,

  status: { type: String, default: 'Pending' },
}, { timestamps: true })

const Borrow = mongoose.model('Borrow', borrowSchema)

app.post("/api/borrow", async (req, res) => {
  try {
    // 1️⃣ Save borrow request
    const borrow = await Borrow.create(req.body);

    res.status(201).json({
      message: "Borrow request sent",
      borrow,
    });

    // 2️⃣ EMAIL LOGIC (AFTER RESPONSE)
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

    if (!toIndustryEmail) {
      console.error("❌ toIndustryEmail missing");
      return;
    }

    const msg = {
      to: toIndustryEmail, // ✅ FIXED
      from: process.env.SENDGRID_VERIFIED_SENDER,
      subject: "Labour Hub - New Labour Borrow Request",
      html: `
      <div style="font-family: 'Segoe UI', sans-serif; background:#f5f7fa; padding:40px 0;">
        <div style="max-width:620px; margin:auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,.12)">
          
          <!-- HEADER -->
          <div style="background:linear-gradient(135deg,#0a66c2,#004182); padding:26px; text-align:center;">
            <h1 style="color:#fff; margin:0;">Labour Hub</h1>
            <p style="color:#dbeafe; margin-top:6px;">New Borrow Request</p>
          </div>

          <!-- BODY -->
          <div style="padding:30px; color:#1f2937;">
            <p>
              You have received a <strong>new labour borrow request</strong>
              from <strong>${fromIndustryEmail}</strong>.
            </p>

            <div style="margin-top:20px; background:#f9fafb; padding:20px; border-radius:12px; border:1px solid #e5e7eb;">
              <table width="100%" style="font-size:14px;">
                <tr><td>Labour Required</td><td><strong>${labourRequired}</strong></td></tr>
                <tr><td>Skills</td><td><strong>${skills}</strong></td></tr>
                <tr><td>Duration</td><td>${fromDate} → ${toDate}</td></tr>
                <tr><td>Shift</td><td>${shift} (${shiftTime})</td></tr>
                <tr><td>Location</td><td>${location}</td></tr>
                <tr><td>Description</td><td>${description}</td></tr>
              </table>
            </div>

            <div style="text-align:center; margin-top:30px;">
              <a href="https://labourhub.pk/dashboard"
                 style="background:#0a66c2; color:#fff; padding:12px 28px;
                 border-radius:10px; text-decoration:none; font-weight:600;">
                View Request
              </a>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="background:#f3f4f6; padding:18px; text-align:center; font-size:13px; color:#6b7280;">
            © ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan
          </div>
        </div>
      </div>
      `,
    };

    await sgMail.send(msg);
    console.log("✅ Borrow request email sent to", toIndustryEmail);

  } catch (err) {
    console.error("❌ Borrow API error:", err);
  }
});




// ==================== API to Get Borrow Records for Logged-in User ====================
app.get("/api/my-borrows/:email", async (req, res) => {
  try {
    const userEmail = req.params.email; // Logged-in user's email

    // Find all borrows where this user applied (as fromIndustryEmail)
    const myBorrows = await Borrow.find({ fromIndustryEmail: userEmail });

    if (!myBorrows.length) {
      return res.status(404).json({ message: "No borrow records found." });
    }

    res.status(200).json(myBorrows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Get borrow requests sent TO the logged-in user
app.get("/api/incoming-borrows/:email", async (req, res) => {
  try {
    const userEmail = req.params.email;

    const incomingBorrows = await Borrow.find({ toIndustryEmail: userEmail });

    if (!incomingBorrows.length) {
      return res.status(404).json({ message: "No incoming requests." });
    }

    res.status(200).json(incomingBorrows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==================== Approve Borrow API ====================
app.post("/api/approve-borrow/:id", async (req, res) => {
  try {
    const borrowId = req.params.id;

    // Find the borrow request
    const borrow = await Borrow.findById(borrowId);
    if (!borrow) {
      return res.status(404).json({ message: "Borrow request not found." });
    }

    // Update status to Approved
    borrow.status = "Approved";
    await borrow.save();

    // ✅ Attempt to send email, but don't crash if it fails
    if (borrow.fromIndustryEmail && process.env.SENDGRID_VERIFIED_SENDER) {
      const msg = {
        to: borrow.fromIndustryEmail,
        from: process.env.SENDGRID_VERIFIED_SENDER,
        subject: "Labour Hub - Borrow Request Approved",
        html: `
        <div style="font-family: 'Segoe UI', sans-serif; background:#f5f7fa; padding:40px 0;">
          <div style="max-width:620px; margin:auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,.12)">
            <div style="background:linear-gradient(135deg,#0a66c2,#004182); padding:26px; text-align:center;">
              <h1 style="color:#fff; margin:0;">Labour Hub</h1>
              <p style="color:#dbeafe; margin-top:6px;">Borrow Request Approved</p>
            </div>
            <div style="padding:30px; color:#1f2937;">
              <p>Your borrow request to <strong>${borrow.toIndustryEmail}</strong> has been <strong>approved</strong>.</p>
              <div style="margin-top:20px; background:#f9fafb; padding:20px; border-radius:12px; border:1px solid #e5e7eb;">
                <table width="100%" style="font-size:14px;">
                  <tr><td>Labour Required</td><td><strong>${borrow.labourRequired}</strong></td></tr>
                  <tr><td>Skills</td><td><strong>${borrow.skills}</strong></td></tr>
                  <tr><td>Date</td><td>${borrow.date}</td></tr>
                  <tr><td>Time</td><td>${borrow.time}</td></tr>
                  <tr><td>Location</td><td>${borrow.location}</td></tr>
                  <tr><td>Description</td><td>${borrow.description}</td></tr>
                </table>
              </div>
            </div>
            <div style="background:#f3f4f6; padding:18px; text-align:center; font-size:13px; color:#6b7280;">
              © ${new Date().getFullYear()} Labour Hub · Karachi, Pakistan
            </div>
          </div>
        </div>
        `,
      };

      try {
        await sgMail.send(msg);
        console.log("✅ Approval email sent to", borrow.fromIndustryEmail);
      } catch (emailErr) {
        console.error("⚠️ Email failed to send:", emailErr.message);
      }
    } else {
      console.log("⚠️ No email configured or sender missing. Skipping email.");
    }

    res.status(200).json({ message: "Borrow request approved", borrow });
  } catch (err) {
    console.error("❌ Approve borrow error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// app.post("/api/borrow", async (req, res) => {
//   try {
//     const borrow = await Borrow.create(req.body);

//     const {
//       toIndustryEmail,
//       fromIndustryEmail,
//       labourRequired,
//       skills,
//       description,
//       fromDate,
//       toDate,
//       shift,
//       shiftTime,
//       location,
//     } = req.body;

//     if (!toIndustryEmail) {
//       return res.status(400).json({ error: "toIndustryEmail missing" });
//     }

//     const msg = {
//       to: toIndustryEmail,
//       from: process.env.SENDGRID_VERIFIED_SENDER, // MUST be verified
//       subject: "Labour Hub - New Labour Borrow Request",
//       html: `...your same html...`,
//     };

//     await sgMail.send(msg);

//     console.log("✅ Borrow email sent to", toIndustryEmail);

//     return res.status(201).json({
//       message: "Borrow request sent successfully",
//       borrow,
//     });

//   } catch (err) {
//     console.error("❌ Borrow API error:", err.response?.body || err);
//     return res.status(500).json({ error: "Borrow request failed" });
//   }
// });


app.post('/api/industries/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    const industry = await Industry.findOne({ email })
    if (!industry) return res.status(400).json({ message: 'Invalid credentials' })

    const isMatch = await bcrypt.compare(password, industry.password)
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' })

    // ✅ Send active status
    const token = jwt.sign(
      { id: industry._id, email: industry.email },
      'YOUR_SECRET_KEY',
      { expiresIn: '7d' }
    )

    res.status(200).json({
      message: 'Login successful',
      email: industry.email,
      token,
      active: industry.active, // 🔥 IMPORTANT
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})


// API to get industry profile by email
app.get('/api/industries/profile', async (req, res) => {
  try {
    const { email } = req.query

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' })
    }

    const industry = await Industry.findOne({ email }).select('-password') // exclude password
    if (!industry) {
      return res.status(404).json({ message: 'Industry not found' })
    }

    res.status(200).json(industry)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})





app.post("/api/admin/industry-toggle/:id", async (req, res) => {
  try {
    const industry = await Industry.findById(req.params.id);
    if (!industry) return res.status(404).json({ error: "Industry not found" });

    industry.active = !industry.active;
    await industry.save();

    // redirect back to admin panel
    res.redirect("/api/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});



app.get("/api/admin", async (req, res) => {
  try {
    const users = await User.find().lean();
    const jobs = await Job.find().lean();
    const applications = await JobApplication.find().lean();
    const industries = await Industry.find().lean();
    const borrows = await Borrow.find().lean();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Labour Hub | Admin Panel</title>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: "Segoe UI", sans-serif;
      background: #f4f6f9;
      padding: 20px;
    }
    h1 {
      color: #0a66c2;
      margin-bottom: 10px;
    }
    h2 {
      margin-top: 40px;
      color: #111827;
      border-left: 6px solid #0a66c2;
      padding-left: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      background: #ffffff;
      box-shadow: 0 6px 18px rgba(0,0,0,.06);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      text-align: left;
    }
    th {
      background: #0a66c2;
      color: #ffffff;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    tr:hover {
      background: #eef2ff;
    }
      .toggle-btn {
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
}

.toggle-btn.green { background: #16a34a; }
.toggle-btn.red { background: #dc2626; }

.toggle-btn:hover {
  opacity: 0.9;
}

    .badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: white;
    }
    .green { background: #16a34a; }
    .red { background: #dc2626; }
    .blue { background: #2563eb; }
    .gray { background: #6b7280; }
    footer {
      margin-top: 40px;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
    }
  </style>
</head>

<body>

<h1>📊 Labour Hub – Admin Panel</h1>

<!-- USERS -->
<h2>👤 Users</h2>
<table>
<tr>
  <th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Skills</th><th>Created</th>
</tr>
${users.map(u => `
<tr>
  <td>${u.firstName} ${u.lastName}</td>
  <td>${u.email}</td>
  <td>${u.phone}</td>
  <td><span class="badge blue">${u.role}</span></td>
  <td>${u.skills?.join(", ") || "-"}</td>
  <td>${new Date(u.createdAt).toLocaleString()}</td>
</tr>`).join("")}
</table>

<!-- JOBS -->
<h2>🛠 Jobs</h2>
<table>
<tr>
  <th>Title</th><th>Location</th><th>Skill</th><th>Budget</th>
  <th>Workers</th><th>Applicants</th><th>Posted By</th>
</tr>
${jobs.map(j => `
<tr>
  <td>${j.title}</td>
  <td>${j.location}</td>
  <td>${j.skill}</td>
  <td>${j.budget}</td>
  <td>${j.workersRequired}</td>
  <td>${j.noOfWorkersApplied || 0}</td>
  <td>${j.createdBy?.email || "-"}</td>
</tr>`).join("")}
</table>

<!-- JOB APPLICATIONS -->
<h2>📄 Job Applications</h2>
<table>
<tr>
  <th>Job ID</th><th>Contractor</th><th>Labour</th><th>Date</th>
</tr>
${applications.map(a => `
<tr>
  <td>${a.jobId}</td>
  <td>${a.contractorEmail}</td>
  <td>${a.labourEmail}</td>
  <td>${new Date(a.appliedAt).toLocaleString()}</td>
</tr>`).join("")}
</table>
<!-- INDUSTRIES -->
<h2>🏭 Industries</h2>
<table>
<tr>
  <th>Industry</th>
  <th>Owner</th>
  <th>Email</th>
  <th>Phone</th>
  <th>Textile</th>
  <th>Status (Click)</th>
</tr>

${industries.map(i => `
<tr>
  <td>${i.industry}</td>
  <td>${i.owner}</td>
  <td>${i.email}</td>
  <td>${i.phone}</td>
  <td>${i.textileType}</td>
  <td>
<td>
  <form
    method="POST"
    action="/api/admin/industry-toggle/${i._id}"
    onsubmit="return confirm('${i.active
      ? "Are you sure you want to DEACTIVATE this industry?"
      : "Are you sure you want to ACTIVATE this industry?"}'
    );"
  >
    <button
      type="submit"
      class="toggle-btn ${i.active ? "green" : "red"}"
    >
      ${i.active ? "Active" : "Inactive"}
    </button>
  </form>
</td>

</tr>
`).join("")}

</table>

<!-- BORROW REQUESTS -->
<h2>🔄 Borrow Requests</h2>
<table>
<tr>
  <th>From</th><th>To</th><th>Labour</th><th>Skills</th>
  <th>Location</th><th>Status</th>
</tr>
${borrows.map(b => `
<tr>
  <td>${b.fromIndustryEmail}</td>
  <td>${b.toIndustryEmail}</td>
  <td>${b.labourRequired}</td>
  <td>${b.skills}</td>
  <td>${b.location}</td>
  <td>
    <span class="badge ${
      b.status === "Approved" ? "green" :
      b.status === "Rejected" ? "red" : "gray"
    }">${b.status}</span>
  </td>
</tr>`).join("")}
</table>

<footer>
  © ${new Date().getFullYear()} Labour Hub · Admin Panel
</footer>
<script>
  function toggleIndustry(id, currentStatus) {
    const action = currentStatus ? "deactivate" : "activate";

    if (!confirm("Are you sure you want to " + action + " this industry?")) {
      return;
    }

    fetch(window.location.origin + "/api/admin/industry-toggle/" + id, {
      method: "POST"
    })
    .then(res => {
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    })
    .then(data => {
      alert("Industry is now " + (data.active ? "Active" : "Inactive"));
      location.reload();
    })
    .catch(err => {
      console.error(err);
      alert("Failed to update industry status");
    });
  }
</script>

</body>
</html>
`;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* ---------- DB connect & server start ---------- */
async function start() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
   
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

start();
app.get("/", (req, res) => {
  res.send("🚀 Labour Hub APIs are running!");
});

// ❌ REMOVE app.listen()
// app.listen(port)

// ✅ EXPORT app for Vercel
export default app;
