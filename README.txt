SwipeApply v3 — iPhone-ready with GPT-4 AI
==========================================

Backend (Node.js)
-----------------
1. Copy backend/.env.example → backend/.env
2. Paste your keys:
   - RAPIDAPI_KEY (Indeed via RapidAPI)
   - OPENAI_API_KEY (OpenAI GPT-4)
   - JOOBLE_KEY / ADZUNA_APP_ID / ADZUNA_APP_KEY if available
3. Install dependencies:
   cd backend
   npm install express node-fetch multer form-data openai
4. Run backend:
   node server.js
   Backend will listen on http://localhost:3000

iOS App (SwiftUI)
-----------------
1. Open Xcode, create new SwiftUI App project (iOS 16+)
2. Replace ContentView.swift and App entry with files in ios_app/
3. Update `backendBase` in ContentView.swift if backend is on LAN:
   e.g., http://192.168.1.10:3000
4. Connect iPhone → Build & Run
5. Upload resume (PDF), swipe jobs right to apply. AI fills questions via GPT-4.

Notes
-----
- Indeed jobs are pulled via RapidAPI.
- Jooble + Adzuna jobs are merged if keys provided.
- AI auto-fills job questions using GPT-4 API.
- Keep your API keys secret and local (do NOT commit them to GitHub).