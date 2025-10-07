// server.js
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer"); // for handling file uploads
const axios = require("axios");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Multer setup for cover letter uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =========================
// Routes
// =========================

// Root
app.get("/", (req, res) => {
  res.send("SwipeApply backend is running!");
});

// Fetch jobs from Indeed API
app.get("/jobs", async (req, res) => {
  try {
    const location = req.query.location || "Remote";
    const title = req.query.title || "";

    const options = {
      method: "GET",
      url: "https://indeed12.p.rapidapi.com/jobs",
      params: { q: title, location },
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "indeed12.p.rapidapi.com"
      }
    };

    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// AI fills additional application questions
app.post("/fill-questions", async (req, res) => {
  try {
    const { questions } = req.body;

    const prompt = `Answer the following job application questions as if you are qualified:\n${questions.join("\n")}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const answers = response.choices[0].message.content;
    res.json({ answers });
  } catch (error) {
    console.error("Error with OpenAI:", error);
    res.status(500).json({ error: "Failed to get AI answers" });
  }
});

// Swipe-to-apply endpoint
app.post("/apply", upload.single("coverLetter"), async (req, res) => {
  try {
    const { jobId, swipeDirection, questions } = req.body;
    let coverLetter = null;

    if (req.file) {
      coverLetter = req.file.buffer.toString("utf-8"); // convert uploaded file to text
    }

    // If swipe left, ignore application
    if (swipeDirection === "left") {
      return res.json({ message: "Job skipped." });
    }

    // If there are questions, fill them with AI
    let aiAnswers = null;
    if (questions && questions.length > 0) {
      const prompt = `Answer the following job application questions as if you are qualified:\n${questions.join("\n")}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      });

      aiAnswers = response.choices[0].message.content;
    }

    // Example: send application to Indeed API (this is pseudo-code; replace with real endpoint if available)
    /*
    await axios.post("https://indeed12.p.rapidapi.com/apply", {
      jobId,
      coverLetter,
      answers: aiAnswers
    }, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "indeed12.p.rapidapi.com"
      }
    });
    */

    res.json({
      message: "Application submitted successfully!",
      aiAnswers,
      coverLetterUploaded: !!coverLetter
    });
  } catch (error) {
    console.error("Error applying to job:", error);
    res.status(500).json({ error: "Failed to apply to job" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
