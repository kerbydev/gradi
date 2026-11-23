# Gradi

Gradi is a client-side academic grade tracker built with Vite, vanilla JavaScript, and Supabase. User data is protected with Supabase Row Level Security (RLS).

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A Supabase project

## Local setup

From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

Set the following values in `.env` using **Supabase Dashboard → Project Settings → API**:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (client) key |

Only the publishable key belongs in this browser app. Never use a Supabase secret or service-role key in `.env`, source code, or a frontend deployment.

Before using the app, open **Supabase Dashboard → SQL Editor**, run the complete `database/schema.sql`, and use `database/rls_tests.sql` to manually check isolation with two accounts. Configure **Authentication → URL Configuration** with your local app URL (`http://localhost:5173`) and the applicable recovery redirect URL. Email confirmation behavior is configured under **Authentication → Providers → Email**.

Start the development server:

```powershell
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run the Vitest suite once |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Preview the production bundle locally |

## Deployment

For Vercel or Netlify, use `npm run build` as the build command and `dist` as the output directory. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment, then add the live domain and the app's recovery redirect URL under **Supabase Dashboard → Authentication → URL Configuration**.

## Project map

```text
database/
  schema.sql                 Supabase tables, triggers, RLS, and functions
  rls_tests.sql              Manual two-account RLS test procedure
public/                       Static public assets
src/
  css/                        Design tokens and application styles
  js/
    api/                      Supabase data-access modules
    auth/                     Supabase authentication flows
    components/                Shared UI components
    config/                    Routes and app configuration
    pages/                     Route-level views
    services/                  Pure grade, prediction, GWA, and analytics logic
    state/                     Client session state
    utils/                     DOM, formatting, validation, and error helpers
  main.js                     App shell and page/router wiring
index.html                     Vite HTML entry point
```

The `.env` file is ignored by Git; `.env.example` contains placeholders only.
