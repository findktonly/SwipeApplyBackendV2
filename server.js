import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get("/", (req, res) => {
  res.send("✅ SwipeApply Multi-Source Backend running successfully");
});

// -------------------------------
// JOB AGGREGATOR ROUTE
// -------------------------------
app.get("/jobs", async (req, res) => {
  const query = req.query.title || "software engineer";
  const location = req.query.location || "Austin, TX";
  let results = [];

  const sources = [];

  // ---- Indeed (via RapidAPI)
  if (process.env.INDEED_API_KEY) {
    sources.push(
      axios
        .get("https://indeed12.p.rapidapi.com/jobs/search", {
          params: { query, location, page: "1" },
          headers: {
            "x-rapidapi-key": process.env.INDEED_API_KEY,
            "x-rapidapi-host": "indeed12.p.rapidapi.com",
          },
          timeout: 8000,
        })
        .then((r) =>
          (r.data.jobs || []).map((job, i) => ({
            id: job.jobkey || `indeed-${i}`,
            title: job.title,
            company: job.company_name || "Unknown",
            location: job.location || location,
            description: job.snippet || "No description available",
            source: "Indeed",
          }))
        )
        .catch((e) => {
          console.warn("Indeed API failed:", e.message);
          return [];
        })
    );
  }

  // ---- Arbeitnow (Free API)
  sources.push(
    axios
      .get("https://api.arbeitnow.com/api/job-board-api")
      .then((r) =>
        (r.data.data || []).map((job, i) => ({
          id: `arbeitnow-${i}`,
          title: job.title,
          company: job.company_name || "Unknown",
          location: job.location || "Remote",
          description: job.description || "No description",
          source: "Arbeitnow",
        }))
      )
      .catch((e) => {
        console.warn("Arbeitnow API failed:", e.message);
        return [];
      })
  );

  // ---- TheirStack
  if (process.env.THEIRSTACK_KEY) {
    sources.push(
      axios
        .get("https://api.theirstack.com/jobs", {
          params: { query, location },
          headers: { Authorization: `Bearer ${process.env.THEIRSTACK_KEY}` },
          timeout: 8000,
        })
        .then((r) =>
          (r.data.jobs || []).map((job, i) => ({
            id: job.id || `theirstack-${i}`,
            title: job.title,
            company: job.company || "Unknown",
            location: job.location || location,
            description: job.description || "No description available",
            source: "TheirStack",
          }))
        )
        .catch((e) => {
          console.warn("TheirStack API failed:", e.message);
          return [];
        })
    );
  }

  // ---- SerpApi (Google Jobs)
  if (process.env.SERPAPI_KEY) {
    sources.push(
      axios
        .get("https://serpapi.com/search.json", {
          params: {
            engine: "google_jobs",
            q: `${query} ${location}`,
            api_key: process.env.SERPAPI_KEY,
          },
          timeout: 8000,
        })
        .then((r) =>
          (r.data.jobs_results || []).map((job, i) => ({
            id: job.job_id || `serpapi-${i}`,
            title: job.title,
            company: job.company_name || "Unknown",
            location: job.location || location,
            description: job.description || "No description available",
            source: "Google Jobs",
          }))
        )
        .catch((e) => {
          console.warn("SerpApi failed:", e.message);
          return [];
        })
    );
  }

  // ---- Fetch all concurrently
  const responses = await Promise.allSettled(sources);
  for (const r of responses) {
    if (r.status === "fulfilled") results = results.concat(r.value);
  }

  // ---- Remove duplicates by title + company
  const uniqueJobs = [];
  const seen = new Set();
  for (const job of results) {
    const key = (job.title + job.company).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJobs.push(job);
    }
  }

  res.json(uniqueJobs.slice(0, 100)); // limit to 100 results
});

// -------------------------------
// APPLY ROUTE
// -------------------------------
app.post("/apply", upload.fields([{ name: "resume" }, { name: "coverLetter" }]), (req, res) => {
  const { jobId, swipeDirection } = req.body;
  console.log("Application received:", jobId, swipeDirection);

  const resume = req.files?.resume?.[0];
  const coverLetter = req.files?.coverLetter?.[0];

  if (resume) console.log("Resume uploaded:", resume.originalname);
  if (coverLetter) console.log("Cover letter uploaded:", coverLetter.originalname);

  res.json({
    success: true,
    message: `Application submitted for job ${jobId}`,
  });
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SwipeApply backend running on port ${PORT}`));
