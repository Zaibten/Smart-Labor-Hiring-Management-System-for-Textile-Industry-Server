const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs");
const FormData = require("form-data");
const fetch = require("node-fetch");
const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = 3000;
app.use(express.json());
const upload = multer({ dest: "uploads/" });

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
];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "کوئی فائل اپلوڈ نہیں ہوئی" });

    const originalPath = req.file.path;
    const convertedPath = `${originalPath}.mp3`;

    // Convert audio to mp3
    await new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .toFormat("mp3")
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(convertedPath);
    });

    const audioData = fs.readFileSync(convertedPath);

    // Send to Whisper API
    const formData = new FormData();
    formData.append("file", audioData, "audio.mp3");
    formData.append("model", "whisper-1");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    });

    const transcription = await whisperResponse.json();
    const detectedText = transcription.text || "";

    // Delete files
    fs.unlinkSync(originalPath);
    fs.unlinkSync(convertedPath);

    // Return the **raw transcription**, no translation
    res.json({ text: detectedText });

  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "آڈیو کو ٹیکسٹ میں تبدیل کرنے میں ناکامی" });
  }
});





// Helper to find matching question
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

    // Step 1: Translate user input to Urdu using OpenAI
    const translation = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "آپ کا کام صرف انگریزی یا کسی بھی زبان کو اردو میں ترجمہ کرنا ہے، بغیر جواب دیے۔" },
        { role: "user", content: message }
      ],
    });

    const messageInUrdu = translation.choices[0].message.content.trim();

    // Step 2: Try to find a match in predefined questions
    const matchedQuestion = findMatchingQuestion(messageInUrdu);
    if (matchedQuestion) {
      return res.json({ reply: matchedQuestion.response });
    }

    // Step 3: If no match, generate relevant Urdu answer based on predefined questions
    const context = questionsData.map(q => `سوال: ${q.text} | جواب: ${q.response}`).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `آپ ایک AI اسسٹنٹ ہیں جو صرف دی گئی معلومات پر مبنی سوالات کے جواب دیتا ہے۔ ہمیشہ جواب اردو میں دیں۔ اگر سوال متعلقہ نہ ہو تو جواب نہ دیں۔ معلومات: ${context}`
        },
        { role: "user", content: messageInUrdu }
      ],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
