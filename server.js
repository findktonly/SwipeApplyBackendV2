/**
 * SwipeApply v3 Backend:
 * - /api/jobs -> merges Jooble + Adzuna + Indeed via RapidAPI
 * - /api/parseResume -> placeholder for resume text extraction
 * - /api/ai/fill -> calls OpenAI GPT-4 API to fill job questions
 * - /api/apply -> mock save of applications
 */

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const multer = require('multer');
const FormData = require('form-data');
const { Configuration, OpenAIApi } = require('openai');

const upload = multer();
const app = express();
app.use(express.json());

const CONFIG = {
  JOOBLE_KEY: process.env.JOOBLE_KEY || '',
  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID || '',
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY || '',
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',
  OPENAI_KEY: process.env.OPENAI_API_KEY || ''
};

const openai = new OpenAIApi(new Configuration({ apiKey: CONFIG.OPENAI_KEY }));

app.get('/api/jobs', async (req, res) => {
  const { location, keyword, remote, experience } = req.query;
  let jobs = [];

  // === Jooble ===
  try {
    if (CONFIG.JOOBLE_KEY) {
      const payload = { keywords: keyword || '', location: location || '', page: 1 };
      const r = await fetch('https://jooble.org/api/1.0/search?api_key=' + CONFIG.JOOBLE_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j && j.jobs) {
        jobs = jobs.concat(j.jobs.map((it, idx) => ({
          id: 'jooble-' + idx,
          title: it.title || '',
          company: it.company?.name || '',
          location: it.location || '',
          remoteType: it.type || 'onsite',
          experienceLevel: it.experience || 'any',
          description: it.description || '',
          applyUrl: it.link || it.url || '',
          additionalQuestions: it.additional_questions || []
        })));
      }
    }
  } catch (e) { console.error('Jooble error', e); }

  // === Adzuna ===
  try {
    if (CONFIG.ADZUNA_APP_ID && CONFIG.ADZUNA_APP_KEY) {
      const country = 'us';
      const q = encodeURIComponent(keyword || '');
      const loc = encodeURIComponent(location || '');
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${CONFIG.ADZUNA_APP_ID}&app_key=${CONFIG.ADZUNA_APP_KEY}&results_per_page=10&what=${q}&where=${loc}`;
      const r2 = await fetch(url);
      const j2 = await r2.json();
      if (j2 && j2.results) {
        jobs = jobs.concat(j2.results.map((it, idx) => ({
          id: 'adzuna-' + idx,
          title: it.title || '',
          company: it.company?.display_name || '',
          location: it.location?.display_name || '',
          remoteType: it.contract_time || 'onsite',
          experienceLevel: 'any',
          description: it.description || '',
          applyUrl: it.redirect_url || '',
          additionalQuestions: []
        })));
      }
    }
  } catch (e) { console.error('Adzuna error', e); }

  // === Indeed via RapidAPI ===
  try {
    if (CONFIG.RAPIDAPI_KEY) {
      const rapidUrl = 'https://indeed12.p.rapidapi.com/jobs/search?query=' + encodeURIComponent(keyword || '') + '&location=' + encodeURIComponent(location || '');
      const r3 = await fetch(rapidUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'indeed12.p.rapidapi.com'
        }
      });
      const j3 = await r3.json();
      if (j3 && j3.data) {
        jobs = jobs.concat(j3.data.map((it, idx) => ({
          id: 'indeed-' + idx,
          title: it.job_title || '',
          company: it.company_name || '',
          location: it.job_location || '',
          remoteType: it.remote || 'onsite',
          experienceLevel: it.experience_level || 'any',
          description: it.job_description || '',
          applyUrl: it.job_apply_link || '',
          additionalQuestions: it.additional_questions || []
        })));
      }
    }
  } catch (e) { console.error('Indeed error', e); }

  res.json(jobs.slice(0, 50));
});

// === Resume parse placeholder ===
app.post('/api/parseResume', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('no file');
  const base64 = req.file.buffer.toString('base64');
  res.send('BASE64:' + base64.slice(0, 800));
});

// === AI fill ===
app.post('/api/ai/fill', async (req, res) => {
  const { resume, jobDescription, questions } = req.body;
  try {
    const answers = {};
    for (const q of questions || []) {
      const prompt = `You are an assistant that writes concise, honest answers to hiring questions.\nResume: ${resume}\nJob: ${jobDescription}\nQuestion: ${q}\nProvide a 1-3 sentence answer suitable for a job application.`;
      const completion = await openai.createCompletion({
        model: 'gpt-4o',
        prompt,
        max_tokens: 180
      });
      answers[q] = completion.data.choices[0].text.trim();
    }
    res.json(answers);
  } catch (e) {
    console.error('AI error', e);
    res.status(500).send({ error: 'AI error' });
  }
});

// === Submit application ===
app.post('/api/apply', async (req, res) => {
  console.log('Application received:', req.body.jobId);
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on port', port));