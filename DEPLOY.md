# Deploy SciBrain Online (Vercel + Turso)

Deploy SciBrain for free: **Vercel** hosts the app and API, **Turso** provides the database.

---

## 1. Create a free database (Turso)

1. Go to **[app.turso.tech](https://app.turso.tech)** and sign up or log in.
2. Create a new database (e.g. name: `scibrain`, region: `lhr` or nearest).
3. Open the database → create an **auth token**.
4. Copy the **database URL** and **token** (you’ll add them to Vercel).

---

## 2. Deploy to Vercel

### Option A: Vercel website

1. Push the project to **GitHub** (if it isn’t already).
2. Go to **[vercel.com](https://vercel.com)** → **Add New Project** → import your repo.
3. **Framework:** leave as “Other” or auto. Leave **Root Directory** as repo root.
4. **Environment variables** (Project → Settings → Environment Variables):
   - `TURSO_DATABASE_URL` = your Turso database URL  
   - `TURSO_AUTH_TOKEN` = your Turso auth token  
   Add for **Production** (and **Preview** if you want).
5. Click **Deploy**. Vercel will run `installCommand` (backend deps) and `buildCommand` (copy static files), then deploy.

### Option B: Vercel CLI

1. Install and log in:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Add env vars (use your Turso URL and token):
   ```bash
   vercel env add TURSO_DATABASE_URL
   vercel env add TURSO_AUTH_TOKEN
   ```
   Choose **Production** when asked.
3. Deploy:
   ```bash
   vercel --prod
   ```
   For non-interactive deploy (e.g. in a script), use:
   ```bash
   vercel --yes --scope YOUR_SCOPE
   ```
   (Replace `YOUR_SCOPE` with your team/username, e.g. `michelleasis-projects`.)

---

## 3. After deploy

- Open the URL Vercel gives you (e.g. `https://scibrain.vercel.app`).
- Sign up and use the app; data is stored in Turso.

---

## 4. What runs where

| Part            | Where it runs |
|-----------------|----------------|
| Frontend (HTML/JS/CSS) | Vercel (static) |
| API (`/api/*`)  | Vercel serverless → same backend logic |
| Database        | Turso (cloud SQLite) |

The build step (`npm run build`) copies `pages/*` into the repo root so routes like `/Dashboard/`, `/UploadPage/` work. The `api/[[...path]].js` serverless function forwards `/api/*` to your backend handler.

---

## 5. Notes

- **Ollama / AI:** Reviewer and quiz generation use Ollama locally. On Vercel there is no Ollama; those endpoints will fail unless you later point them to a hosted LLM. Auth, dashboard, and saving quiz attempts work with Turso.
- **Timeouts:** Vercel serverless has a timeout (e.g. 60s). Long-running AI calls may need a different backend (e.g. Render) if you add a cloud LLM.
- **Turso limits:** See [Turso pricing](https://turso.tech/pricing) for free-tier limits.

---

## Troubleshooting

- **“Database not available”**  
  Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel and redeploy.

- **API 404**  
  Ensure `api/[[...path]].js` is in the repo and that `/api/*` is not overridden by another rewrite.

- **Static files 404**  
  Ensure the build ran (`buildCommand`: `npm run build`) and that `scripts/copy-public.js` exists.
