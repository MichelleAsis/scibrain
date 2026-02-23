# Deploy SciBrain for Free: Vercel + Turso

Host **SciBrain** on the internet at no cost: **Vercel** runs your app and API, and **Turso** is the free cloud database your app uses from anywhere.

## What You Get

- **App + API** on [Vercel](https://vercel.com) (free tier, same domain)
- **Database** on [Turso](https://turso.tech) (free tier, SQLite-compatible, **online** so everyone using your app shares the same data)
- **Auth, reviewers, quiz attempts** all stored in Turso

---

## 1. Create a Free Online Database (Turso)

Turso is free and cloud-hosted so your app can use it from anywhere. Get your **database URL** and **auth token** in one of two ways:

### Option A: Turso Web Dashboard (no CLI)

1. Go to **[app.turso.tech](https://app.turso.tech)** and sign up or log in.
2. Create a new database (e.g. name `scibrain`, region like `lhr`).
3. In the database page, create an **auth token**.
4. Copy the **URL** and **token**; you'll add them to Vercel in step 2 below.

### Option B: Turso CLI

1. Install the Turso CLI:  
   **Windows:** Turso’s install script is for Linux/macOS. Use **WSL** (Windows Subsystem for Linux), then run the script inside WSL:
   - Install WSL if needed: [Microsoft’s WSL install guide](https://learn.microsoft.com/en-us/windows/wsl/install)
   - Open PowerShell and run `wsl`, then inside WSL:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
   **macOS/Linux:**  
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
   (Use the real URL **get.tur.so** — not get.turso.tech, which is invalid.)

2. Sign up and log in:
   ```bash
   turso auth login
   ```

3. Create a database and get credentials:
   ```bash
   turso db create scibrain --region lhr
   turso db show scibrain --url
   turso db tokens create scibrain
   ```
   Save the **URL** and **token**; you’ll add them to Vercel.

## 2. Deploy to Vercel

### Option A: Vercel website

1. Push your project to **GitHub** (if not already).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
3. **Configure project:** Framework Preset **Other**, leave Root Directory / Build / Output default or empty.
4. **Environment variables** (Project → Settings → Environment Variables): add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Production (and optionally Preview).
5. Click **Deploy**. After deploy, open your Vercel URL (e.g. `https://your-app.vercel.app`).

### Option B: Vercel CLI

1. **Install the Vercel CLI** (one-time):

   ```bash
   npm i -g vercel
   ```

   Or use without installing: `npx vercel`

2. **Log in** (one-time, opens browser):

   ```bash
   vercel login
   ```

3. **From your project root** (where `vercel.json` is), run:

   ```bash
   vercel
   ```

   First time: answer the prompts (link to existing project or create new one, no override for build settings). This creates a **preview** deployment.  
   **Non-interactive (CI/script):** use `vercel --yes --scope YOUR_SCOPE` (e.g. `vercel --yes --scope michelleasis-projects`). Run `vercel` once interactively to see your scope, or run `vercel link --scope YOUR_SCOPE` to link the project.

4. **Add environment variables** for Turso (so the app can use the database):

   ```bash
   vercel env add TURSO_DATABASE_URL
   vercel env add TURSO_AUTH_TOKEN
   ```

   Paste your Turso URL when asked for `TURSO_DATABASE_URL`, and your Turso token for `TURSO_AUTH_TOKEN`. Choose **Production** (and optionally Preview).

5. **Deploy to production:**

   ```bash
   vercel --prod
   ```

6. Open the URL Vercel prints (e.g. `https://your-app.vercel.app`). You should see the home page; sign up and use the app. Data is stored in Turso.

**Tip:** If you already added env vars in the Vercel dashboard, you can skip step 4. Redeploy with `vercel --prod` after any env change.

## 3. Local Development

- **Without Turso:** run the app as before; it uses local SQLite under `backend/database/`.
- **With Turso:** set the same env vars locally and run the backend; it will use Turso when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.

## 4. Notes

- **Reviewer / quiz generation** uses Ollama locally. On Vercel there is no Ollama; those endpoints will fail unless you later point them to a hosted LLM. Auth, dashboard, and saving quiz attempts work with Turso.
- **Execution time:** Vercel serverless has a timeout (e.g. 60s with the current config). Long-running AI calls may need a different backend (e.g. Render) if you add a cloud LLM later.
- **Turso free tier:** enough for personal/small use; see [Turso pricing](https://turso.tech/pricing) for limits.

## 5. Other Free Databases (Instead of Turso)

You can host the app on **Vercel** (or another host) and use a different free database. The codebase currently has adapters for **Turso** and **local SQLite**. For other DBs you'd add a small adapter and set env vars.

| Provider | Type | Free tier | Notes |
|----------|------|-----------|--------|
| **[Neon](https://neon.tech)** | Postgres | Yes | Serverless Postgres, works well with Vercel. Need a `service-neon.js` and Postgres schema. |
| **[Supabase](https://supabase.com)** | Postgres | Yes | Postgres + optional auth. Same idea: new adapter + Postgres schema. |
| **[PlanetScale](https://planetscale.com)** | MySQL | Yes | Serverless MySQL. Need MySQL adapter and schema. |
| **[Railway](https://railway.app)** | Postgres or MySQL | Free tier | Easiest if you want one place for app + DB; can host backend + DB there. |

- **Easiest "no Turso" path:** Use **Neon** or **Supabase** (Postgres). The app's schema is SQLite; converting it to Postgres is straightforward (e.g. `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `datetime('now')` → `NOW()`). A `service-neon.js` (or Supabase) would use the `pg` package and the same method names as `service-turso.js`.
- **Hosting:** You can keep **Vercel** for the frontend + API and only swap the database to Neon/Supabase/PlanetScale, or use **Railway** / **Render** to run the Node backend + DB together (still free tiers).

If you tell me which provider you prefer (e.g. Neon or Supabase), I can outline the exact env vars and the adapter changes.

---

## Troubleshooting

- **“Database not available”**  
  Ensure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Vercel and redeploy.

- **API 404**  
  Check that `vercel.json` and `api/[[...path]].js` are in the repo and that rewrites are applied.

- **CORS**  
  The backend allows the request origin when deployed; using the same Vercel domain for frontend and API avoids CORS issues.
