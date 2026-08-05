# Recall — Offline-First Active Recall & Spaced Repetition

A study app (question bank + active recall + spaced repetition) that works fully
offline on a single device and syncs across devices once you're back online,
backed by Supabase.

## Features

- **CSV import** — bring in a question bank from a CSV file (`/import`); a
  bundled sample (947-question SMLE Internal Medicine bank) is included for
  one-click testing. Categories/subcategories are created automatically, and
  per-option explanations are preserved if the CSV has them.
- **Question bank** organized by category / subcategory
- **Active recall study sessions** — pick a category, a question pool, and how
  many questions to study
- **Spaced repetition (SM-2-derived)**: questions get scheduled for review
  based on whether you got them right
- **Question pool filters**: Smart (due + new), All, Unseen, Wrong, Flagged,
  Highlighted
- **Flag** and **highlight** buttons on any question, plus a free-text **notes**
  box per question
- **Back button** to revisit a previous question mid-session
- Per-question badges during study showing why it's in the pool (New, Due,
  Wrong, Flagged, Highlighted)
- **Session accuracy** and **overall accuracy** index, plus a stats/progress page
- **Night mode**
- **Fully offline** — all data lives locally first (IndexedDB); Supabase sync
  is best-effort and non-blocking
- **Offline-first sync across devices** once you sign in with the same account
  on a second device

## Tech stack

- React + Vite + TypeScript
- Dexie.js (IndexedDB) for local-first storage, `dexie-react-hooks` for
  reactive UI
- Zustand for auth/UI/session state
- Tailwind CSS v4 (class-based dark mode)
- Supabase (Postgres + Auth) as the sync backend
- `vite-plugin-pwa` so the app shell itself (not just data) loads offline

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor (or via the Supabase CLI), run the migrations in
   `supabase/migrations/` **in order**:
   - `0001_schema.sql`
   - `0002_triggers.sql`
   - `0003_rls.sql`

   With the Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key
   (Project Settings → API):

   ```bash
   cp .env.example .env
   ```

   **Never commit `.env`** — it's already git-ignored.

### 3. Run it

```bash
npm run dev
```

Without a configured `.env`, the app still runs fully offline (a "Local
only" badge appears and sign-in is disabled) — useful for trying it out
before wiring up Supabase.

### 4. Build

```bash
npm run build
```

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages automatically
on every push to `claude/quiz-app-sync-gpbbvy`. One-time setup:

1. **Settings → Pages → Source → GitHub Actions** (on this repo).
2. **Settings → Secrets and variables → Actions → New repository secret**,
   add both:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (same values as your local `.env` — Project Settings → API in Supabase).
3. Push, or re-run the workflow from the **Actions** tab.

The site is served at `https://<owner>.github.io/<repo>/`, so the build uses
`BASE_PATH` to prefix all asset/router paths, and `public/404.html` handles
deep-link refreshes (GitHub Pages has no server-side rewrites for a client-side
router — it redirects unresolved paths back through `index.html`, which
restores the original URL before the app mounts).

## Importing questions

Go to **Import** in the app and either upload your own CSV or click "Load
bundled sample" to try it with the included SMLE Internal Medicine question
bank (`public/seed/smle_questions.csv`, 947 questions).

Expected CSV columns:

```
Question, Option_A, Option_B, Option_C, Option_D, Answer, Category, subcategory,
Highlighted, Explanation_A, Explanation_B, Explanation_C, Explanation_D,
High_Yield_Must_Know, One_Line, Accuracy_Review
```

- `Answer` — the correct option's letter (`A`/`B`/`C`/`D`), optionally
  followed by the option text (`"C. Nifedipine"` also works)
- `Highlighted` — `Highlighted` or `Yes` pre-marks the question as
  highlighted on import; anything else leaves it unmarked
- `Explanation_A..D`, `High_Yield_Must_Know`, `One_Line`, `Accuracy_Review`
  are all optional — omit any of them and the app just won't show that part

Re-importing (or importing a second file) reuses existing categories by name
instead of creating duplicates.

## How offline + sync works

- Every write (create/edit a question, answer a question, flag/highlight,
  notes) goes to the local IndexedDB **first** and shows up instantly — no
  network round-trip required.
- Each local write is queued in a `syncQueue` table.
- When online, a sync engine (`src/sync/`) periodically drains that queue up
  to Supabase, and pulls down anything changed on other devices since the
  last sync — triggered on login, on reconnect, when the tab regains focus,
  and every ~45s while online. A manual sync is available by clicking the
  sync status badge in the top bar.
- Conflict resolution is last-write-wins on the server-stamped `updated_at`
  (never the client clock), with an optimistic-concurrency check on push.
- Deletes are soft (`deleted_at`) so sync can detect them — nothing is ever
  hard-deleted in Postgres by the client.
- Signing in on a second device does a full initial pull ("hydration") of
  everything under that account.

## Project structure

```
src/
  auth/            # sign-in/sign-up UI
  components/       # app shell, sync status indicator
  db/               # Dexie schema + shared TS types (mirrors the Postgres schema)
  repositories/      # local read/write layer (categories, questions, SRS state, sessions)
  lib/               # SM-2 spaced-repetition scheduler, id/time helpers
  state/              # zustand stores (auth, theme, sync status, active study session)
  sync/                # push/pull engine talking to Supabase
  features/
    categories/         # category tree UI
    questions/            # question bank management
    study-setup/            # session configuration screen
    study-session/            # session runner + summary
    stats/                     # statistics / progress page
supabase/
  migrations/         # schema, triggers, RLS policies
```
