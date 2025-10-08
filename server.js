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

const upload = multer({ storage: multer.memoryStorage() });

// ----------------------
// ROOT ROUTE
// ----------------------
app.get("/", (req, res) => {
  res.send("✅ SwipeApply Backend (Indeed API with Logging Enabled)");
});


// ----------------------
// JOBS ROUTE (with console logging)
// ----------------------
app.get("/jobs", async (req, res) => {
  try {
    const query = req.query.title || "software engineer";
    const location = req.query.location || "Austin, TX";

    console.log("Fetching jobs for:", query, "in", location);

    const response = await axios.get("https://indeed12.p.rapidapi.com/jobs/search", {
      params: { query, location, page: "1" },
      headers: {
        "x-rapidapi-key": "f2b7d0f577msh6c7796d1e7a2361p1c6bafjsn7270642f761b",
        "x-rapidapi-host": "indeed12.p.rapidapi.com"
      }
    });

    // Print full response for debugging
    console.log("Indeed API raw response:");
    console.log(JSON.stringify(response.data, null, 2));

    let jobs = response.data.jobs?.map((job, index) => ({
      id: job.jobkey || `${index}`,
      title: job.title || "Untitled",
      company: job.company_name || "Unknown Company",
      location: job.location || "Remote",
      description: job.snippet || "No description available."
    }));

    // Fallback mock data if no jobs are found
    if (!jobs || jobs.length === 0) {
      console.log("⚠️ No jobs returned — using fallback mock data.");
      jobs = [
        {
          id: "1",
          title: "Software QA Engineer",
          company: "General Motors",
          location: "Austin, TX",
          description: "Test automation and validation for automotive systems."
        },
        {
          id: "2",
          title: "Full Stack Developer",
          company: "TechNova",
          location: "Remote",
          description: "Develop scalable web and mobile applications."
        },
        {
          id: "3",
          title: "Data Analyst",
          company: "BlueSky Analytics",
          location: "Hybrid - Dallas, TX",
          description: "Work with SQL, Python, and BI tools to deliver insights."
        }
      ];
    }

    res.json(jobs);
  } catch (error) {
    console.error("❌ Error fetching jobs:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
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

    let answers = [];
    if (questions) {
      const parsedQuestions = JSON.parse(questions);
      answers = parsedQuestions.map((q, i) => ({
        question: q,
        answer: "AI-generated answer placeholder"
      }));
    }

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
// HEALTH CHECK ROUTE
// ----------------------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});


// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SwipeApply backend running on port ${PORT}`));
