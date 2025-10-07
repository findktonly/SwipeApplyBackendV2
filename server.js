// server.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const OpenAI = require("openai");

require("dotenv").config(); // Optional if running locally; Render uses process.env directly

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Example route: AI filling additional job questions
app.post("/fill-questions", async (req, res) => {
  try {
    const { questions } = req.body;

    // Create prompt for AI
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

// Example route: Fetch jobs from Indeed API (via RapidAPI)
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

// Root endpoint
app.get("/", (req, res) => {
  res.send("SwipeApply backend is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
