import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Storage config for uploads (resume, cover letter)
const upload = multer({ storage: multer.memoryStorage() });

// Base test route
app.get("/", (req, res) => {
  res.send("✅ SwipeApply Backend is running.");
});


// ----------------------
// JOBS ROUTE
// ----------------------
app.get("/jobs", async (req, res) => {
  try {
    const query = req.query.title || "software engineer";
    const location = req.query.location || "Austin, TX";

    const response = await axios.get("https://indeed12.p.rapidapi.com/jobs/search", {
      params: { query, location, page: "1" },
      headers: {
        "x-rapidapi-key": process.env.INDEED_API_KEY,
        "x-rapidapi-host": "indeed12.p.rapidapi.com"
      }
    });

    const jobs = response.data.jobs?.map((job, index) => ({
      id: job.jobkey || `${index}`,
      title: job.title || "Untitled",
      company: job.company_name || "Unknown Company",
      location: job.location || "Remote",
      description: job.snippet || "No description available."
    })) || [];

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error.message);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});


// ----------------------
// APPLY ROUTE
// ----------------------
app.post("/apply", upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "coverLetter", maxCount: 1 }
]), async (req, res) => {
  try {
    const { jobId, swipeDirection, questions } = req.body;
    const resumeFile = req.files?.resume?.[0];
    const coverLetterFile = req.files?.coverLetter?.[0];

    console.log("New application received:", jobId, swipeDirection);

    // Optional: simulate AI autofill for job questions
    let answers = [];
    if (questions) {
      const parsedQuestions = JSON.parse(questions);
      answers = parsedQuestions.map((q, i) => ({
        question: q,
        answer: "AI-generated answer placeholder"
      }));
    }

    // Log uploaded files
    if (resumeFile) console.log("Resume uploaded:", resumeFile.originalname);
    if (coverLetterFile) console.log("Cover letter uploaded:", coverLetterFile.originalname);

    res.json({
      success: true,
      message: `Application submitted for job ${jobId}`,
      answers
    });
  } catch (error) {
    console.error("Error processing application:", error.message);
    res.status(500).json({ error: "Failed to process application" });
  }
});


// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
