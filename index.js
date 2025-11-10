const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const FormData = require("form-data");
const fetch = require("node-fetch"); // If you get ESM issue, use v2: npm install node-fetch@2
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

// Predefined questions
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
    id: 23,
    text: "میں کون سے ملز کے ساتھ کام کر چکا ہوں دیکھ سکتا ہوں؟",
    response:
      "اپنے کام کیے گئے ملز دیکھنے کے لیے 'Work History' یا 'Jobs Completed' سیکشن کھولیں۔",
  },
  {
    id: 24,
    text: "کیا میں کسی دوست کو بھی ایپ پر لاؤ سکتا ہوں؟",
    response:
      "جی ہاں، 'Invite Friends' آپشن استعمال کریں اور دوست کو ایپ پر مدعو کریں۔",
  },
  {
    id: 25,
    text: "میں اپنے کام کی تاریخ کیسے دیکھوں؟",
    response:
      "اپنے کام کی تاریخ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن استعمال کریں۔",
  },
  {
    id: 26,
    text: "کیا میں ادائیگی کے طریقے بدل سکتا ہوں؟",
    response:
      "ادائیگی کے طریقے بدلنے کے لیے 'Settings' > 'Payment Methods' میں جائیں اور نیا طریقہ منتخب کریں۔",
  },
  {
    id: 27,
    text: "میں اپنی پروفائل بند کیسے کروں؟",
    response:
      "پروفائل بند کرنے کے لیے 'Profile' > 'Settings' > 'Deactivate Account' استعمال کریں۔",
  },
  {
    id: 28,
    text: "میں نئی جگہ پر کیسے کام تلاش کروں؟",
    response:
      "نئی جگہ پر کام تلاش کرنے کے لیے 'Jobs' سیکشن میں فلٹرز کے ذریعے مقام منتخب کریں۔",
  },
  {
    id: 29,
    text: "میں کام کے اوقات کیسے دیکھ سکتا ہوں؟",
    response:
      "کام کے اوقات دیکھنے کے لیے 'Work Schedule' یا 'Shifts' سیکشن کھولیں۔",
  },
  {
    id: 30,
    text: "میں کس طرح اپنے کام کی درجہ بندی بڑھا سکتا ہوں؟",
    response:
      "کام کی درجہ بندی بڑھانے کے لیے اچھا کام کریں، ریویوز حاصل کریں اور 'Ratings' اپ ڈیٹ کریں۔",
  },
  {
    id: 31,
    text: "ایپ کو کیسے چلائیں؟",
    response:
      "ایپ کو چلانے کے لیے اسے انسٹال کریں، لاگ ان کریں اور مین مینو سے اپنے فیچرز استعمال کریں۔",
  },
  {
    id: 32,
    text: "میں اپنا پاسورڈ کیسے بدل سکتا ہوں؟",
    response: "پاسورڈ بدلنے کے لیے 'Settings' > 'Change Password' میں جائیں۔",
  },
  {
    id: 33,
    text: "میں ایپ میں نوٹیفکیشن کیسے آن کروں؟",
    response:
      "نوٹیفکیشن آن کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور مطلوبہ آپشن آن کریں۔",
  },
  {
    id: 34,
    text: "میں ایپ میں نئی نوکری کیسے دیکھوں؟",
    response:
      "نئی نوکری دیکھنے کے لیے 'Jobs' سیکشن کھولیں اور فلٹرز استعمال کریں۔",
  },
  {
    id: 35,
    text: "میں ایپ میں اپنی پروفائل اپ ڈیٹ کیسے کروں؟",
    response:
      "پروفائل اپ ڈیٹ کرنے کے لیے 'Profile' > 'Edit' میں جائیں اور معلومات بدلیں۔",
  },
  {
    id: 36,
    text: "میں ایپ پر اپنے کام کی رپورٹ کیسے دیکھوں؟",
    response:
      "کام کی رپورٹ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن استعمال کریں۔",
  },
  {
    id: 37,
    text: "میں ایپ میں کسی ٹھیکیدار سے کیسے رابطہ کروں؟",
    response:
      "ٹھیکیدار سے رابطہ کرنے کے لیے 'Contractors' > 'Contact' استعمال کریں۔",
  },
  {
    id: 38,
    text: "میں ایپ پر نوکری چھوڑنے کا طریقہ کیا ہے؟",
    response: "نوکری چھوڑنے کے لیے 'Jobs' میں جائیں اور 'Resign' پر کلک کریں۔",
  },
  {
    id: 39,
    text: "میں ایپ میں اپنی دستیابی کیسے سیٹ کروں؟",
    response:
      "دستیابی سیٹ کرنے کے لیے 'Availability' سیکشن میں جائیں اور تاریخ یا وقت منتخب کریں۔",
  },
  {
    id: 40,
    text: "میں ایپ پر تنخواہ کیسے دیکھوں؟",
    response:
      "تنخواہ دیکھنے کے لیے 'Salary' سیکشن کھولیں اور اپنے شیڈول کے مطابق معلومات دیکھیں۔",
  },
  {
    id: 41,
    text: "میں ایپ میں نئی مہارتیں کیسے سیکھ سکتا ہوں؟",
    response:
      "نئی مہارتیں سیکھنے کے لیے 'Skills' یا 'Learning' سیکشن میں دستیاب کورسز دیکھیں۔",
  },
  {
    id: 42,
    text: "میں ایپ پر کام کے اوقات کیسے دیکھوں؟",
    response:
      "کام کے اوقات دیکھنے کے لیے 'Work Schedule' یا 'Shifts' سیکشن استعمال کریں۔",
  },
  {
    id: 43,
    text: "میں ایپ پر ادائیگی کے طریقے کیسے بدلوں؟",
    response:
      "ادائیگی کے طریقے بدلنے کے لیے 'Settings' > 'Payment Methods' میں جائیں اور نیا طریقہ منتخب کریں۔",
  },
  {
    id: 44,
    text: "میں ایپ میں ریٹنگ کیسے بڑھاؤں؟",
    response:
      "ریٹنگ بڑھانے کے لیے اچھا کام کریں اور کلائنٹس سے مثبت ریویوز حاصل کریں۔",
  },
  {
    id: 45,
    text: "میں ایپ پر شکایت کیسے دوں؟",
    response: "شکایت دینے کے لیے 'Support' > 'Report Issue' استعمال کریں۔",
  },
  {
    id: 46,
    text: "میں ایپ میں کسی دوست کو کیسے مدعو کروں؟",
    response: "دوست کو مدعو کرنے کے لیے 'Invite Friends' آپشن استعمال کریں۔",
  },
  {
    id: 47,
    text: "میں ایپ میں پرانے کام کی ریکارڈ کیسے دیکھوں؟",
    response:
      "پرانے کام دیکھنے کے لیے 'Work History' یا 'Jobs Completed' سیکشن کھولیں۔",
  },
  {
    id: 48,
    text: "میں ایپ میں اپ لوڈ کی گئی تصویریں کیسے دیکھوں؟",
    response: "تصویریں دیکھنے کے لیے 'Profile' > 'Gallery' میں جائیں۔",
  },
  {
    id: 49,
    text: "میں ایپ میں ڈیجیٹل معاہدہ کیسے دیکھوں؟",
    response:
      "ڈیجیٹل معاہدہ دیکھنے کے لیے 'Contracts' سیکشن میں جائیں اور متعلقہ معاہدہ کھولیں۔",
  },
  {
    id: 50,
    text: "میں ایپ میں کس طرح ایمرجنسی مدد لے سکتا ہوں؟",
    response:
      "ایمرجنسی مدد کے لیے 'Support' > 'Emergency' استعمال کریں اور فوری رابطہ کریں۔",
  },
  {
    id: 51,
    text: "میں ایپ میں نوکری کی درخواست کب تک رکھ سکتا ہوں؟",
    response:
      "نوکری کی درخواست 'Jobs' میں جا کر منتخب کریں اور 'Apply' پر کلک کریں۔",
  },
  {
    id: 52,
    text: "میں ایپ میں کیسے سائن آؤٹ کروں؟",
    response: "سائن آؤٹ کرنے کے لیے 'Settings' > 'Logout' پر کلک کریں۔",
  },
  {
    id: 53,
    text: "میں ایپ میں نوٹیفکیشن بند کیسے کروں؟",
    response:
      "نوٹیفکیشن بند کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور آف کریں۔",
  },
  {
    id: 54,
    text: "میں ایپ میں پروفائل فوٹو کیسے بدلوں؟",
    response:
      "پروفائل فوٹو بدلنے کے لیے 'Profile' > 'Edit' > 'Upload Photo' استعمال کریں۔",
  },
  {
    id: 55,
    text: "میں ایپ میں کام کی تفصیلات کیسے دیکھوں؟",
    response:
      "کام کی تفصیلات دیکھنے کے لیے 'Jobs' یا 'Work History' میں جائیں۔",
  },
  {
    id: 56,
    text: "میں ایپ میں دستیاب جابز کیسے فلٹر کروں؟",
    response:
      "جابز فلٹر کرنے کے لیے 'Jobs' میں فلٹرز استعمال کریں جیسے مقام، وقت یا تنخواہ۔",
  },
  {
    id: 57,
    text: "میں ایپ میں اپنا پروفائل کیسے ایکٹیو رکھوں؟",
    response:
      "پروفائل ایکٹیو رکھنے کے لیے تمام معلومات مکمل کریں اور 'Profile Active' آن کریں۔",
  },
  {
    id: 58,
    text: "میں ایپ میں کسی ٹھیکیدار کی ٹیم میں شامل کیسے ہوں؟",
    response:
      "ٹھیکیدار کی ٹیم میں شامل ہونے کے لیے 'Contractors' میں جائیں اور درخواست دیں۔",
  },
  {
    id: 59,
    text: "میں ایپ میں نئی جگہ پر کام کیسے تلاش کروں؟",
    response:
      "نئی جگہ پر کام تلاش کرنے کے لیے 'Jobs' سیکشن میں مقام منتخب کریں۔",
  },
  {
    id: 60,
    text: "میں ایپ میں تربیتی کورس کیسے دیکھوں؟",
    response:
      "تربیتی کورس دیکھنے کے لیے 'Learning' یا 'Skills' سیکشن استعمال کریں۔",
  },
];

const findMatchingQuestion = (text) => {
  const lowerText = text.toLowerCase();
  const match = questionsData.find(
    (q) => q.text.includes(lowerText) || lowerText.includes(q.text)
  );
  if (match) return match;
  const similar = questionsData.find((q) =>
    q.text.split(" ").some((word) => lowerText.includes(word))
  );
  return similar;
};

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Step 1: Translate user input to Urdu
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

    // Step 2: Find exact or partial match
    const matchedQuestion = findMatchingQuestion(messageInUrdu);
    if (matchedQuestion) {
      return res.json({ reply: matchedQuestion.response });
    }

    // Step 3: Generate a context-aware answer in Urdu based on app features
    const context = questionsData
      .map((q) => `سوال: ${q.text} | جواب: ${q.response}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
آپ ایک AI اسسٹنٹ ہیں جو صرف "مزدور اور ٹھیکیدار" موبائل ایپ کے basic flow اور فیچرز کے مطابق جواب دیتا ہے۔  
- ہمیشہ جواب اردو میں دیں۔  
- ہر سوال کا جواب ایپ کے استعمال یا فیچرز کے تناظر میں دیں، جیسے لاگ ان، پروفائل، جاب پوسٹنگ، جاب اپلائی، بڈنگ، یا نوٹیفیکیشنز۔  
- اگر سوال ایپ سے براہ راست متعلق نہ ہو، تب بھی اپنی سمجھ کے مطابق سب سے قریبی جواب ایپ کے basic flow سے دیں۔  
- کبھی بھی غیر متعلقہ یا عام معلومات نہ دیں۔  
- context میں دی گئی معلومات کو جواب میں شامل کریں اگر ضروری ہو۔  

موجودہ معلومات: ${context}
      `,
        },
        { role: "user", content: messageInUrdu },
      ],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "سرور میں خرابی پیش آگئی" });
  }
});

// Transcribe route
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.path)
      return res.status(400).json({ error: "کوئی فائل اپلوڈ نہیں ہوئی" });

    const cloudinaryUrl = req.file.path;

    // Download audio
    const audioResponse = await fetch(cloudinaryUrl);
    const audioBuffer = await audioResponse.buffer();

    const tempInput = path.join("/tmp", `input_${Date.now()}`);
    const tempOutput = path.join("/tmp", `output_${Date.now()}.mp3`);
    fs.writeFileSync(tempInput, audioBuffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .setFfmpegPath(ffmpegPath)
        .output(tempOutput)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    const fileStream = fs.createReadStream(tempOutput);
    const form = new FormData();
    form.append("file", fileStream);
    form.append("model", "whisper-1");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      }
    );

    const data = await whisperResponse.json();

    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

    if (data.error) return res.status(500).json({ error: data.error.message });

    res.json({ text: data.text || "", cloudinaryUrl });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "آڈیو کو ٹیکسٹ میں تبدیل کرنے میں ناکامی" });
  }
});

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
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);


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

/* ---------- API routes ---------- */

/**
 * POST /api/signup
 * body: { firstName, lastName, phone, email, password, role }
 */
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, role } = req.body || {};

    // validate input
    const validationErrors = validateSignupPayload({ firstName, lastName, phone, email, password, role });
    if (validationErrors.length) {
      return res.status(400).json({ errors: validationErrors });
    }

    // normalize email/phone
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();

    // check duplicate email
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ error: "Email already in use." });
    }

    // hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // create user
    const user = new User({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash,
      role,
    });

    await user.save();

    // sign token
    const token = signJwt(user);

    // return user data (excluding passwordHash)
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(201).json({ user: userResponse, token });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/* Optional: small login route for convenience */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required." });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

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
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

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
    if (isSame) return res.status(400).json({ error: "New password must be different from your old password." });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordHash = passwordHash;
    await user.save();

    // ---------------- Send Email ----------------
    try {
      const msg = {
        to: user.email,
        from: process.env.SENDGRID_VERIFIED_SENDER,
        subject: "Labour Hub Application - Password Changed",
        text: "Your Labour Hub Application password has been changed successfully.",
        html: "<p>Your Labour Hub Application password has been changed successfully.</p>",
      };

      await sgMail.send(msg);
      console.log(`Email sent to ${user.email}`);
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
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  workersRequired: { type: Number, required: true },
  skill: { type: String, required: true },
  budget: { type: Number, required: true },
  contact: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: String,
    lastName: String,
    role: String,
    image: String,
    email: String, // NEW FIELD
  },
  applicants: [
    {
      laborId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      appliedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
      chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

const Job = mongoose.model("Job", jobSchema);


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

// Root endpoint
app.get("/", (req, res) => res.send("🚀 Labour Hub APIs areS running!"));

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`✅ Server running at http://localhost:${port}`)
);
