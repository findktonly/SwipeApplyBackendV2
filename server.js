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
  res.send("✅ SwipeApply Backend - iOS Optimized Version (Indeed Live)");
});

// ----------------------
// JOBS ROUTE (CLEAN FORMAT)
// ----------------------
app.get("/jobs", async (req, res) => {
  try {
    const query = req.query.title || "software engineer";
    const location = req.query.location || "Austin, TX";

    console.log(`📡 Fetching jobs for: ${query} in ${location}`);

    const response = await axios.get("https://indeed12.p.rapidapi.com/jobs/search", {
      params: { query, location, page: "1" },
      headers: {
        "x-rapidapi-key": process.env.INDEED_API_KEY || "f2b7d0f577msh6c7796d1e7a2361p1c6bafjsn7270642f761b",
        "x-rapidapi-host": "indeed12.p.rapidapi.com"
      }
    });

    if (!response.data || !response.data.hits) {
      console.log("⚠️ Indeed API returned unexpected data:", response.data);
      return res.status(500).json({ error: "Indeed API returned no job results" });
    }

    // 🧠 Simplified for clean UI card display
    const jobs = response.data.hits.map((job, index) => ({
      id: job.id || `${index}`,
      title: job.title || "Untitled Job",
      company: job.company_name || "Unknown Company",
      location: job.location || "Remote",
      link: job.link ? `https://indeed.com${job.link}` : "",
      posted: job.formatted_relative_time || "Recently posted"
    }));

    console.log(`✅ Returned ${jobs.length} live jobs`);
    res.json(jobs);

  } catch (error) {
    console.error("❌ Error fetching jobs:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      return res.status(error.response.status).json({
        error: "Indeed API error",
        details: error.response.data
      });
    }
    res.status(500).json({ error: "Failed to fetch jobs from Indeed" });
  }
});

// ----------------------
// APPLY ROUTE
// ----------------------
app.post(
  "/apply",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "coverLetter", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { jobId, swipeDirection } = req.body;
      const resumeFile = req.files?.resume?.[0];
      const coverLetterFile = req.files?.coverLetter?.[0];

      console.log(`📨 Applying to job ${jobId} | Swipe: ${swipeDirection}`);
      if (resumeFile) console.log(`📎 Resume uploaded: ${resumeFile.originalname}`);
      if (coverLetterFile) console.log(`📎 Cover Letter uploaded: ${coverLetterFile.originalname}`);

      res.json({
        success: true,
        message: `Application submitted for job ${jobId}`,
        resume: !!resumeFile,
        coverLetter: !!coverLetterFile
      });
    } catch (err) {
      console.error("❌ Error in /apply:", err.message);
      res.status(500).json({ error: "Failed to process application" });
    }
  }
);

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SwipeApply Backend running on port ${PORT}`));
