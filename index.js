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
    { "id": 1, "text": "میری پروفائل کیسے بناؤں؟", "response": "پروفائل بنانے کے لیے 'پروفائل' سیکشن میں جائیں، تمام معلومات بھریں اور 'سیو' پر کلک کریں۔" },
    { "id": 2, "text": "میں ملازمت کے لیے کیسے درخواست دوں؟", "response": "ملازمت کے لیے درخواست دینے کے لیے 'Jobs' میں جائیں، مطلوبہ نوکری منتخب کریں اور 'Apply' پر کلک کریں۔" },
    { "id": 3, "text": "میرے قریب کون سے ملز میں کام ہے؟", "response": "قریبی ملز دیکھنے کے لیے 'Nearby Jobs' سیکشن کھولیں اور دستیاب مواقع دیکھیں۔" },
    { "id": 4, "text": "میں اپنی مہارتیں کیسے اپ ڈیٹ کروں؟", "response": "مہارتیں اپ ڈیٹ کرنے کے لیے 'Skills' سیکشن میں جائیں، نئی مہارتیں شامل کریں اور 'Save' کریں۔" },
    { "id": 5, "text": "کیا میں کسی ٹھیکیدار کی ٹیم میں شامل ہو سکتا ہوں؟", "response": "جی ہاں، 'Contractors' میں جائیں اور ٹیم میں شامل ہونے کے لیے درخواست دیں۔" },
    { "id": 6, "text": "نئی نوکریوں کے بارے میں اطلاع کیسے ملے گی؟", "response": "نئی نوکریوں کی اطلاع کے لیے 'Notifications' آن کریں یا ایپ کی اپ ڈیٹس دیکھیں۔" },
    { "id": 7, "text": "میں اپنی موجودگی کب تک ظاہر کروں؟", "response": "موجودگی ظاہر کرنے کے لیے 'Attendance' سیکشن میں جائیں اور اپنی موجودگی اپ ڈیٹ کریں۔" },
    { "id": 8, "text": "میرے کام کی تنخواہ کب ملے گی؟", "response": "تنخواہ کی تاریخ 'Salary' سیکشن میں دیکھیں یا اپنے کمپنی کے شیڈول کے مطابق۔" },
    { "id": 9, "text": "میں کس طرح ڈیجیٹل معاہدہ دیکھ سکتا ہوں؟", "response": "ڈیجیٹل معاہدہ دیکھنے کے لیے 'Contracts' سیکشن میں جائیں اور متعلقہ معاہدہ کھولیں۔" },
    { "id": 10, "text": "میں اپنی ریٹنگ کیسے دیکھ سکتا ہوں؟", "response": "اپنی ریٹنگ دیکھنے کے لیے 'Profile' یا 'Ratings' سیکشن کھولیں۔" },
    { "id": 11, "text": "کیا میں نوکری چھوڑنا چاہوں تو کیسے کروں؟", "response": "نوکری چھوڑنے کے لیے 'Jobs' سیکشن میں جائیں اور 'Resign' آپشن استعمال کریں۔" },
    { "id": 12, "text": "میں کس طرح اپنی جگہ کا پتہ درست کر سکتا ہوں؟", "response": "اپنی جگہ درست کرنے کے لیے 'Settings' > 'Location' میں جائیں اور درست پتہ درج کریں۔" },
    { "id": 13, "text": "میں کس طرح زیادہ قریبی ملازمت تلاش کر سکتا ہوں؟", "response": "قریبی ملازمتیں تلاش کرنے کے لیے 'Nearby Jobs' سیکشن میں فلٹرز استعمال کریں۔" },
    { "id": 14, "text": "میں اپنی پروفائل میں تصویریں کیسے ڈالوں؟", "response": "پروفائل میں تصاویر شامل کرنے کے لیے 'Profile' > 'Edit' > 'Upload Photo' پر جائیں۔" },
    { "id": 15, "text": "کیا میں کسی دوسرے مل میں بھی کام کر سکتا ہوں؟", "response": "جی ہاں، 'Jobs' سیکشن میں مختلف ملز کے مواقع دیکھیں اور درخواست دیں۔" },
    { "id": 16, "text": "میں اپنی دستیابی کب تبدیل کر سکتا ہوں؟", "response": "اپنی دستیابی تبدیل کرنے کے لیے 'Availability' سیکشن میں جائیں اور نئی تاریخ یا وقت سیٹ کریں۔" },
    { "id": 17, "text": "نوکری کے بارے میں نوٹیفکیشن کیسے آن کریں؟", "response": "نوٹیفکیشن آن کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور متعلقہ آپشن آن کریں۔" },
    { "id": 18, "text": "میں ٹھیکیدار کے ساتھ کیسے رابطہ کروں؟", "response": "ٹھیکیدار سے رابطہ کرنے کے لیے 'Contractors' میں جائیں اور 'Contact' آپشن استعمال کریں۔" },
    { "id": 19, "text": "میری کام کی ریکارڈ کیسے دیکھیں؟", "response": "کام کی ریکارڈ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن کھولیں۔" },
    { "id": 20, "text": "کیا میں اپنی تنخواہ کا حساب خود دیکھ سکتا ہوں؟", "response": "جی ہاں، 'Salary' سیکشن میں جائیں اور 'Salary Calculator' استعمال کریں۔" },
    { "id": 21, "text": "میں نئی مہارتیں کیسے سیکھ سکتا ہوں؟", "response": "نئی مہارتیں سیکھنے کے لیے 'Learning' یا 'Skills' سیکشن میں دستیاب کورسز دیکھیں۔" },
    { "id": 22, "text": "میں کسی شکایت یا مسئلے کی اطلاع کیسے دوں؟", "response": "شکایت یا مسئلے کی اطلاع دینے کے لیے 'Support' > 'Report Issue' استعمال کریں۔" },
    { "id": 23, "text": "میں کون سے ملز کے ساتھ کام کر چکا ہوں دیکھ سکتا ہوں؟", "response": "اپنے کام کیے گئے ملز دیکھنے کے لیے 'Work History' یا 'Jobs Completed' سیکشن کھولیں۔" },
    { "id": 24, "text": "کیا میں کسی دوست کو بھی ایپ پر لاؤ سکتا ہوں؟", "response": "جی ہاں، 'Invite Friends' آپشن استعمال کریں اور دوست کو ایپ پر مدعو کریں۔" },
    { "id": 25, "text": "میں اپنے کام کی تاریخ کیسے دیکھوں؟", "response": "اپنے کام کی تاریخ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن استعمال کریں۔" },
    { "id": 26, "text": "کیا میں ادائیگی کے طریقے بدل سکتا ہوں؟", "response": "ادائیگی کے طریقے بدلنے کے لیے 'Settings' > 'Payment Methods' میں جائیں اور نیا طریقہ منتخب کریں۔" },
    { "id": 27, "text": "میں اپنی پروفائل بند کیسے کروں؟", "response": "پروفائل بند کرنے کے لیے 'Profile' > 'Settings' > 'Deactivate Account' استعمال کریں۔" },
    { "id": 28, "text": "میں نئی جگہ پر کیسے کام تلاش کروں؟", "response": "نئی جگہ پر کام تلاش کرنے کے لیے 'Jobs' سیکشن میں فلٹرز کے ذریعے مقام منتخب کریں۔" },
    { "id": 29, "text": "میں کام کے اوقات کیسے دیکھ سکتا ہوں؟", "response": "کام کے اوقات دیکھنے کے لیے 'Work Schedule' یا 'Shifts' سیکشن کھولیں۔" },
    { "id": 30, "text": "میں کس طرح اپنے کام کی درجہ بندی بڑھا سکتا ہوں؟", "response": "کام کی درجہ بندی بڑھانے کے لیے اچھا کام کریں، ریویوز حاصل کریں اور 'Ratings' اپ ڈیٹ کریں۔" }
,
  { "id": 31, "text": "ایپ کو کیسے چلائیں؟", "response": "ایپ کو چلانے کے لیے اسے انسٹال کریں، لاگ ان کریں اور مین مینو سے اپنے فیچرز استعمال کریں۔" },
  { "id": 32, "text": "میں اپنا پاسورڈ کیسے بدل سکتا ہوں؟", "response": "پاسورڈ بدلنے کے لیے 'Settings' > 'Change Password' میں جائیں۔" },
  { "id": 33, "text": "میں ایپ میں نوٹیفکیشن کیسے آن کروں؟", "response": "نوٹیفکیشن آن کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور مطلوبہ آپشن آن کریں۔" },
  { "id": 34, "text": "میں ایپ میں نئی نوکری کیسے دیکھوں؟", "response": "نئی نوکری دیکھنے کے لیے 'Jobs' سیکشن کھولیں اور فلٹرز استعمال کریں۔" },
  { "id": 35, "text": "میں ایپ میں اپنی پروفائل اپ ڈیٹ کیسے کروں؟", "response": "پروفائل اپ ڈیٹ کرنے کے لیے 'Profile' > 'Edit' میں جائیں اور معلومات بدلیں۔" },
  { "id": 36, "text": "میں ایپ پر اپنے کام کی رپورٹ کیسے دیکھوں؟", "response": "کام کی رپورٹ دیکھنے کے لیے 'Work History' یا 'Attendance' سیکشن استعمال کریں۔" },
  { "id": 37, "text": "میں ایپ میں کسی ٹھیکیدار سے کیسے رابطہ کروں؟", "response": "ٹھیکیدار سے رابطہ کرنے کے لیے 'Contractors' > 'Contact' استعمال کریں۔" },
  { "id": 38, "text": "میں ایپ پر نوکری چھوڑنے کا طریقہ کیا ہے؟", "response": "نوکری چھوڑنے کے لیے 'Jobs' میں جائیں اور 'Resign' پر کلک کریں۔" },
  { "id": 39, "text": "میں ایپ میں اپنی دستیابی کیسے سیٹ کروں؟", "response": "دستیابی سیٹ کرنے کے لیے 'Availability' سیکشن میں جائیں اور تاریخ یا وقت منتخب کریں۔" },
  { "id": 40, "text": "میں ایپ پر تنخواہ کیسے دیکھوں؟", "response": "تنخواہ دیکھنے کے لیے 'Salary' سیکشن کھولیں اور اپنے شیڈول کے مطابق معلومات دیکھیں۔" },
  { "id": 41, "text": "میں ایپ میں نئی مہارتیں کیسے سیکھ سکتا ہوں؟", "response": "نئی مہارتیں سیکھنے کے لیے 'Skills' یا 'Learning' سیکشن میں دستیاب کورسز دیکھیں۔" },
  { "id": 42, "text": "میں ایپ پر کام کے اوقات کیسے دیکھوں؟", "response": "کام کے اوقات دیکھنے کے لیے 'Work Schedule' یا 'Shifts' سیکشن استعمال کریں۔" },
  { "id": 43, "text": "میں ایپ پر ادائیگی کے طریقے کیسے بدلوں؟", "response": "ادائیگی کے طریقے بدلنے کے لیے 'Settings' > 'Payment Methods' میں جائیں اور نیا طریقہ منتخب کریں۔" },
  { "id": 44, "text": "میں ایپ میں ریٹنگ کیسے بڑھاؤں؟", "response": "ریٹنگ بڑھانے کے لیے اچھا کام کریں اور کلائنٹس سے مثبت ریویوز حاصل کریں۔" },
  { "id": 45, "text": "میں ایپ پر شکایت کیسے دوں؟", "response": "شکایت دینے کے لیے 'Support' > 'Report Issue' استعمال کریں۔" },
  { "id": 46, "text": "میں ایپ میں کسی دوست کو کیسے مدعو کروں؟", "response": "دوست کو مدعو کرنے کے لیے 'Invite Friends' آپشن استعمال کریں۔" },
  { "id": 47, "text": "میں ایپ میں پرانے کام کی ریکارڈ کیسے دیکھوں؟", "response": "پرانے کام دیکھنے کے لیے 'Work History' یا 'Jobs Completed' سیکشن کھولیں۔" },
  { "id": 48, "text": "میں ایپ میں اپ لوڈ کی گئی تصویریں کیسے دیکھوں؟", "response": "تصویریں دیکھنے کے لیے 'Profile' > 'Gallery' میں جائیں۔" },
  { "id": 49, "text": "میں ایپ میں ڈیجیٹل معاہدہ کیسے دیکھوں؟", "response": "ڈیجیٹل معاہدہ دیکھنے کے لیے 'Contracts' سیکشن میں جائیں اور متعلقہ معاہدہ کھولیں۔" },
  { "id": 50, "text": "میں ایپ میں کس طرح ایمرجنسی مدد لے سکتا ہوں؟", "response": "ایمرجنسی مدد کے لیے 'Support' > 'Emergency' استعمال کریں اور فوری رابطہ کریں۔" },
  { "id": 51, "text": "میں ایپ میں نوکری کی درخواست کب تک رکھ سکتا ہوں؟", "response": "نوکری کی درخواست 'Jobs' میں جا کر منتخب کریں اور 'Apply' پر کلک کریں۔" },
  { "id": 52, "text": "میں ایپ میں کیسے سائن آؤٹ کروں؟", "response": "سائن آؤٹ کرنے کے لیے 'Settings' > 'Logout' پر کلک کریں۔" },
  { "id": 53, "text": "میں ایپ میں نوٹیفکیشن بند کیسے کروں؟", "response": "نوٹیفکیشن بند کرنے کے لیے 'Settings' > 'Notifications' میں جائیں اور آف کریں۔" },
  { "id": 54, "text": "میں ایپ میں پروفائل فوٹو کیسے بدلوں؟", "response": "پروفائل فوٹو بدلنے کے لیے 'Profile' > 'Edit' > 'Upload Photo' استعمال کریں۔" },
  { "id": 55, "text": "میں ایپ میں کام کی تفصیلات کیسے دیکھوں؟", "response": "کام کی تفصیلات دیکھنے کے لیے 'Jobs' یا 'Work History' میں جائیں۔" },
  { "id": 56, "text": "میں ایپ میں دستیاب جابز کیسے فلٹر کروں؟", "response": "جابز فلٹر کرنے کے لیے 'Jobs' میں فلٹرز استعمال کریں جیسے مقام، وقت یا تنخواہ۔" },
  { "id": 57, "text": "میں ایپ میں اپنا پروفائل کیسے ایکٹیو رکھوں؟", "response": "پروفائل ایکٹیو رکھنے کے لیے تمام معلومات مکمل کریں اور 'Profile Active' آن کریں۔" },
  { "id": 58, "text": "میں ایپ میں کسی ٹھیکیدار کی ٹیم میں شامل کیسے ہوں؟", "response": "ٹھیکیدار کی ٹیم میں شامل ہونے کے لیے 'Contractors' میں جائیں اور درخواست دیں۔" },
  { "id": 59, "text": "میں ایپ میں نئی جگہ پر کام کیسے تلاش کروں؟", "response": "نئی جگہ پر کام تلاش کرنے کے لیے 'Jobs' سیکشن میں مقام منتخب کریں۔" },
  { "id": 60, "text": "میں ایپ میں تربیتی کورس کیسے دیکھوں؟", "response": "تربیتی کورس دیکھنے کے لیے 'Learning' یا 'Skills' سیکشن استعمال کریں۔" }
];




const findMatchingQuestion = (text) => {
  const lowerText = text.toLowerCase();
  const match = questionsData.find(q => q.text.includes(lowerText) || lowerText.includes(q.text));
  if (match) return match;
  const similar = questionsData.find(q => q.text.split(" ").some(word => lowerText.includes(word)));
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
        { role: "system", content: "آپ کا کام صرف انگریزی یا کسی بھی زبان کو اردو میں ترجمہ کرنا ہے، بغیر جواب دیے۔" },
        { role: "user", content: message }
      ],
    });

    const messageInUrdu = translation.choices[0].message.content.trim();

    // Step 2: Find exact or partial match
    const matchedQuestion = findMatchingQuestion(messageInUrdu);
    if (matchedQuestion) {
      return res.json({ reply: matchedQuestion.response });
    }

    // Step 3: Generate a context-aware answer in Urdu based on app features
    const context = questionsData.map(q => `سوال: ${q.text} | جواب: ${q.response}`).join("\n");

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
      `
    },
    { role: "user", content: messageInUrdu }
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
    if (!req.file || !req.file.path) return res.status(400).json({ error: "کوئی فائل اپلوڈ نہیں ہوئی" });

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

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
      body: form,
    });

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

// Root endpoint
app.get("/", (req, res) => res.send("🚀 Transcription API is running!"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));

