# Gradi: Copilot Project Instructions

## Role
You are a senior full-stack engineer working in my existing VS Code workspace on **Gradi**, a grade tracking, grade prediction, and GWA calculation web app for Philippine college students (initial preset: MSU-IIT). I am a beginner. After each task, briefly explain what you changed and why, in simple English.

## Current project state
- Stack is set up and working: Vite, vanilla JavaScript (ES modules), Supabase, Chart.js, Vitest.
- Implemented: design system and app shell, hash router, auth screens and session handling, Supabase schema and RLS scripts, API modules, CRUD for semesters, subjects, and assessments, pure calculation services with tests, calculator, predictor, final grade, GWA, history, dashboard, analytics, settings.
- Not yet verified: behavior against a live Supabase project, two-user RLS test, deployment.
- Keep the existing folder names and patterns. Before editing any file, read its current contents. Preserve what works. Never overwrite a file blindly.

## Stack (strict)
- HTML5, CSS3, vanilla JavaScript (ES modules), Vite, npm.
- Supabase (Postgres, Auth, RLS) via `@supabase/supabase-js`.
- Chart.js for charts only. Vitest for tests (dev only).
- Forbidden: React, Vue, Angular, jQuery, Tailwind, Bootstrap, PHP, Laravel, MySQL, TypeScript, any UI kit. Do not add other dependencies without asking me first.

## Architecture rules
1. Hash-based SPA router (`#/dashboard`, `#/subjects/:id`).
2. Strict layering:
   - `src/js/services/`: pure calculation functions. No DOM, no Supabase.
   - `src/js/api/`: all Supabase queries. Pages never call `supabase.from()` directly.
   - `src/js/pages/`: each page exports `render(container, params)` and an optional `destroy()`.
   - `src/js/components/`: reusable UI.
   - `src/js/config/`: constants (routes, grade scales, assessment types).
   - `src/js/utils/`: dom, format, validate, helpers.
   - `src/js/state/session.js`: current user and active semester.
3. Never insert unescaped user data with `innerHTML`. Use `textContent` or the `h()` helper.
4. Auth guard runs before every protected route.
5. Every async action has a loading state, a success toast, a readable error toast, and an empty state when there is no data.
6. No duplicated logic. Shared logic goes in `services/`, `utils/`, or `components/`.
7. Naming: files `camelCase.js`, CSS classes `kebab-case`, DB columns `snake_case`, JS variables `camelCase`.
8. Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only. Never use, print, or commit a `service_role` or secret key. `.env` must stay git-ignored. `.env.example` holds placeholders only.
9. No fake data presented as real. Demo content must be clearly labeled as sample data and must not be in the live data path.

## Design system (src/css/tokens.css)
```
--bg: #0B0B0D;  --surface: #1C1C1F;  --surface-2: #242427;
--text: #FFFFFF;  --text-muted: #A1A1AA;  --accent: #55C99A;
--border: #303035;
--danger: #F87171;  --warning: #FBBF24;  --info: #60A5FA;
```
- Font: Inter with a system-ui fallback.
- 4px spacing scale, 8px radius for inputs and buttons, 14px for cards, 1px borders, no heavy shadows, no glow, no decorative gradients.
- Transitions: 150ms on hover and focus only. Respect `prefers-reduced-motion`.
- Layout: fixed sidebar at 1024px and wider, drawer plus top bar below that. Tables become stacked cards below 640px. Tap targets at least 44px.
- Accessibility: visible focus rings, a label on every input, `aria-live` toasts, modal focus trap and Esc to close, contrast at least 4.5:1, never color alone for status.

## Database model (Supabase Postgres)
Source of truth: `database/schema.sql` (idempotent, safe to run twice).
- UUID primary keys, `created_at` and `updated_at` with a shared trigger.
- Every user-owned table has `user_id uuid not null default auth.uid()` referencing `auth.users(id) on delete cascade`, indexed.
- Child rows cascade on parent delete. Use `numeric`, never `float`, for grades, scores, weights, and units.
- CHECK constraints mirror frontend validation.
- Tables: `profiles`, `semesters`, `grading_profiles`, `grading_rules`, `subjects`, `assessment_categories`, `assessments`, `final_grades`.
- One active semester per user (partial unique index). `UNIQUE(user_id, academic_year, term)`.

Meaning of `assessments.weight`:
- Subject `weighting_mode = 'individual'`: weight is the percent of the whole subject. The total should be 100.
- Subject `weighting_mode = 'category'`: weight is the relative weight inside its category. `assessment_categories.weight` is the percent of the whole subject, and category weights should total 100. If all relative weights in a category are null or 0, treat them as equal.

Row Level Security:
- Enabled on every table, with `select`, `insert`, `update`, and `delete` policies for `authenticated` only.
- Use `(select auth.uid()) = user_id` (`profiles` uses `id`).
- `insert` and `update` use `with check`, including a parent-ownership check so a user cannot attach a row to another user's parent.
- Nothing is granted to `anon`.

## Calculation rules
All formulas live only in `src/js/services/`. Pure functions. Never round intermediate values. Round only for display.

Definitions (weights are percentage points of the whole subject):
- `pct_i = score / total * 100` (raw) or the stored percentage (percent method).
- An assessment is completed only when it has a valid score or percentage.

Individual mode:
- `earned = Σ(pct_i × weight_i / 100)` over completed assessments
- `completedWeight = Σ weight_i` over completed
- `remainingWeight = totalConfiguredWeight − completedWeight`
- `currentAverage = earned / completedWeight × 100` (null if `completedWeight = 0`)

Category mode (category first, then category weight). For category c with relative weights r_j and R_c = Σ r_j over all its assessments:
- `categoryEarned_c = categoryWeight_c × Σ_completed(pct_j × r_j / R_c) / 100`
- `categoryCompletedWeight_c = categoryWeight_c × Σ_completed r_j / R_c`
- Subject `earned` and `completedWeight` are the sums over categories.

Predictor:
- `projectedFinal = earned + Σ(hypotheticalPct_k × weight_k / 100)`. Hypothetical values stay in memory and are never saved.
- `requiredAverageOnRemaining = (target − earned) / remainingWeight × 100`
- Distinct messages for: target already achieved, impossible (required over 100), no remaining weight, weights missing or not 100, invalid target.

GWA:
- `GWA = Σ(grade × units) / Σ(units)` over subjects with a numeric grade and `counts_in_gwa = true`.
- INC, IP, DR, and WDRW are excluded from numerator and denominator, and listed separately. Never treat them as 0.
- Cumulative GWA is recomputed from all applicable subject rows, never by averaging semester GWAs.
- Percentage-to-grade conversion uses only the user's configured grading rules. Never hardcode or invent a universal transmutation table.
- MSU-IIT numeric grades: 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 4.00, 5.00. Descriptive labels stay neutral until verified against the official MSU-IIT grading policy.

Reference test vectors (must keep passing in Vitest):
1. Individual: Q1 90%/w10, Q2 85%/w10, Lab 95%/w20, Midterm 80%/w20, Final pending/w40 → earned 52.5, completedWeight 60, remainingWeight 40, currentAverage 87.5. Target 90 → required 93.75. Hypothetical final 100 → projected 92.5.
2. Category: Quizzes 20% (Q1 r=40 scored 80, Q2 r=60 scored 90) → earned 17.2. Only Q1 done → earned 6.4, completedWeight 8, remaining 12.
3. Target 90, earned 52, remaining 40 → required 95.
4. GWA: (1.25, 3u), (1.50, 3u), (2.00, 2u), (INC, 3u) → 1.53125, displayed 1.53, with 3 units not counted.
5. Edge cases: no assessments, all weights 0, score above total (invalid), negative score (invalid), weights totaling 90 or 110 (warning), target 101 (invalid).

## Validation (frontend and database)
- Score at least 0 and at most total (raw). Total above 0. Percentage 0 to 100. Weight 0 to 100. Units above 0 (decimals allowed). Academic year `YYYY-YYYY` with the second year equal to the first plus 1. Trim required fields.
- Inline field errors, not only toasts. Disable submit while saving.
- Show a live "weights total X% / remaining Y%" meter, with a warning when the total is not 100%.

## Security checklist (apply to every change)
- RLS on and tested. No `service_role` or secret key anywhere in the repo or build output.
- Auth guard on all private routes. Clear session state and cached data on sign-out.
- Escape all user text on render. Validate route params before querying.
- Confirm before deleting semesters, subjects, or assessments, and say what will cascade.
- Do not log tokens or user data in production code.

## Working rules
1. Before coding, give a short plan (files to create or modify), then implement it.
2. Write real, complete code. No placeholder functions, no decorative buttons. Every visible control must work.
3. After changes, run `npm test` and `npm run build` and fix errors. Never claim something works without running it.
4. Make surgical changes. Do not refactor working code unless asked.
5. Git: confirm `git rev-parse --show-toplevel` is the Gradi project folder before staging. Never stage `.env`. Never run `git add .` without checking `git status` first.
6. End each task with: files changed, how I test it manually (numbered steps), known limitations, and a suggested next step.
7. If something must be done by hand (Supabase dashboard, SQL editor, env values), tell me exactly where to click and what to paste.
8. If a requirement is ambiguous or conflicts with these rules, ask one concise question instead of guessing.
