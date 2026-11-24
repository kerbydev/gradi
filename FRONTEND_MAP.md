# Gradi: Complete Frontend Architecture & AI Implementation Guide

> **Target Audience**: AI assistants and developers modifying or redesigning Gradi's frontend.  
> **Core Rule**: Preserve all business logic, services (`src/js/services/`), Supabase queries (`src/js/api/`), auth handling (`src/js/auth/`), and validation (`src/js/utils/validate.js`). **Never edit, read, or commit `.env`.**

---

## 1. Technical Stack & Constraints

- **Stack**: Pure Vanilla JavaScript (ES Modules), HTML5, CSS3, Vite, `@supabase/supabase-js`, Chart.js.
- **Strictly Prohibited**: React, Vue, Angular, jQuery, Tailwind, Bootstrap, Sass, TypeScript, external UI kits.
- **Router**: Client-side hash router (`#/dashboard`, `#/subjects/:id`).
- **DOM Creation**: Built via standard DOM APIs and the helper `h(tag, props, children)` in `src/js/utils/dom.js`.
- **CSS Architecture**: Vanilla CSS using custom properties (tokens), modular files, and BEM/utility-like naming.

---

## 2. Directory Structure & Layer Boundaries

```
Gradi/
├── index.html                   # Mount point: <div id="app"></div>, loads /src/main.js
├── src/
│   ├── main.js                  # Application entry point: initializes shell, router, auth listener
│   ├── css/                     # Global stylesheets (imported in main.js)
│   │   ├── tokens.css           # CSS variables: colors, typography, spacing, radius, transitions
│   │   ├── base.css             # CSS reset, box-sizing, typography clamps, skip-link, focus rings
│   │   ├── layout.css           # Shell layout, fixed sidebar, sticky topbar, responsive breakpoints
│   │   ├── components.css       # Buttons, cards, tables, badges, modals, toasts, progress bars
│   │   └── auth.css             # Centered card layout for login/register/recovery pages
│   ├── js/
│   │   ├── config/
│   │   │   ├── routes.js        # Route table (paths, auth requirements, param validators)
│   │   │   ├── gradeScales.js   # MSU-IIT 1.00–5.00 grading scale presets
│   │   │   └── assessmentTypes.js # Types: Quiz, Exam, Lab, Assignment, Project, etc.
│   │   ├── router.js            # Hash-based routing engine with auth guards & cleanup lifecycle
│   │   ├── supabase.js          # Supabase client instantiation (reads VITE_SUPABASE_* via import.meta.env)
│   │   ├── auth/
│   │   │   └── auth.js          # Session state, login, register, resetPassword, signOut, error mappings
│   │   ├── state/
│   │   │   └── session.js       # In-memory reactive state: user, profile, activeSemester
│   │   ├── components/          # Reusable DOM components
│   │   │   ├── sidebar.js       # Sidebar navigation, mobile drawer with focus trap, topbar
│   │   │   ├── modal.js         # Accessible modal dialog & confirmDialog promise helper
│   │   │   ├── notifications.js # Toast notifications & loading skeletons
│   │   │   ├── statCard.js      # Metric / KPI summary card
│   │   │   ├── subjectGradeTools.js # Grade calculator, predictor, weight breakdown visual bar
│   │   │   └── finalGradePanel.js   # Grading rules table & final grade converter modal
│   │   ├── pages/               # Screen modules (each exports `render(container, params)`)
│   │   │   ├── login.js
│   │   │   ├── register.js
│   │   │   ├── forgotPassword.js
│   │   │   ├── resetPassword.js
│   │   │   ├── dashboard.js
│   │   │   ├── semesters.js
│   │   │   ├── subjects.js
│   │   │   ├── subjectDetail.js
│   │   │   ├── assessments.js
│   │   │   ├── gradeCalculator.js
│   │   │   ├── gradePredictor.js
│   │   │   ├── gwaCalculator.js
│   │   │   ├── history.js
│   │   │   ├── analytics.js
│   │   │   ├── settings.js
│   │   │   ├── demo.js
│   │   │   └── notFound.js
│   │   ├── services/            # PURE FUNCTIONS (NO DOM, NO SUPABASE) - DO NOT MODIFY MATH
│   │   │   ├── gradeCalculator.js   # Subject grade calculation, earned points, remaining weights
│   │   │   ├── gwaCalculator.js     # Unit-weighted GWA & cumulative GWA formulas
│   │   │   ├── gradePredictor.js    # Target requirements & hypothetical projection
│   │   │   ├── gradingRules.js      # Gap/overlap inspection and percent-to-grade mapping
│   │   │   └── assessmentAnalytics.js # Overdue/upcoming/completed classification
│   │   ├── api/                 # ALL SUPABASE QUERIES - DO NOT ALTER SIGNATURES
│   │   │   ├── academicRecordsApi.js
│   │   │   ├── accountDataApi.js
│   │   │   ├── assessmentCategoriesApi.js
│   │   │   ├── assessmentsApi.js
│   │   │   ├── finalGradesApi.js
│   │   │   ├── gradingProfilesApi.js
│   │   │   ├── gradingRulesApi.js
│   │   │   ├── profileApi.js
│   │   │   ├── semestersApi.js
│   │   │   └── subjectsApi.js
│   │   └── utils/
│   │       ├── dom.js           # h(tag, props, children) element factory
│   │       ├── format.js        # formatGrade, formatPercent, formatUnits, formatDate
│   │       ├── validate.js      # validateEmail, validateAcademicYear, validateScore, etc.
│   │       ├── academic.js      # sumSubjectUnits
│   │       └── apiError.js      # User-friendly data error messages
```

---

## 3. CSS Tokens & The Design System (`src/css/tokens.css`)

### Core Color Palette
| Token | Value | Semantic Meaning |
| :--- | :--- | :--- |
| `--bg` | `#0B0B0D` | Deep canvas background |
| `--surface` | `#1C1C1F` | Default card and sidebar background |
| `--surface-2` | `#242427` | Elevated surfaces, secondary buttons, inputs |
| `--surface-hover` | `#2A2A2F` | Hover state for interactive surface elements |
| `--text` | `#FFFFFF` | Primary high-contrast typography |
| `--text-muted` | `#A1A1AA` | Secondary typography, table headers, descriptions |
| `--text-subtle` | `#92929A` | Tertiary helper labels |
| `--accent` | `#55C99A` | Mint green primary brand accent |
| `--accent-hover` | `#70D6AC` | Interactive hover state for accent controls |
| `--accent-soft` | `rgba(85, 201, 154, 0.12)` | Subtle tint for active navigation & badges |
| `--border` | `#303035` | 1px border for cards, inputs, dividers |
| `--border-strong`| `#45454D` | Higher-contrast borders and scrollbars |
| `--danger` | `#F87171` | Error states, overdue badges, delete buttons |
| `--warning` | `#FBBF24` | Incomplete weights, warnings, caution alerts |
| `--info` | `#60A5FA` | Informational status indicators |

### Sizing, Spacing & Breakpoints
- **Font**: Inter / system-ui (`--font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`).
- **Sidebar Width**: `248px` (`--sidebar-width`).
- **Content Max Width**: `1200px` (`--content-width`).
- **Border Radii**:
  - Inputs / Buttons: `8px` (`--radius-input`)
  - Controls: `10px` (`--radius-control`)
  - Cards / Modals: `14px` (`--radius-card`)
- **Responsive Breakpoints**:
  - Desktop: `> 1023px` (Fixed 248px sidebar, wide tables)
  - Tablet: `768px - 1023px` (Drawer navigation, 2-column grids)
  - Mobile: `<= 767px` (Tables convert to stacked cards via `td[data-label]`)
  - Narrow Mobile: `<= 639px` (Single column grids, full-width buttons)

---

## 4. JavaScript to CSS Class Connection Map

This section shows which JavaScript files create or toggle specific CSS classes.

### A. App Shell & Navigation (`main.js`, `sidebar.js` ↔ `layout.css`)
| JS File | Generated Element / Class | CSS Selector in `layout.css` | Purpose |
| :--- | :--- | :--- | :--- |
| `main.js` | `<div class="app-shell">` | `.app-shell` | Root wrapper for authenticated layout |
| `main.js` | `<main class="auth-layout">` | `.auth-layout` | Centered layout for public pages (login, register) |
| `main.js` | `<main class="main-content">` | `.main-content` | Main content area with `margin-left: 248px` |
| `main.js` | `<div class="main-content__inner">` | `.main-content__inner` | Max-width 1200px centered page container |
| `sidebar.js` | `<aside class="sidebar">` | `.sidebar` | Fixed navigation bar |
| `sidebar.js` | `classList.toggle('sidebar--open')` | `.sidebar--open` | Slides in drawer on screens `<= 1023px` |
| `sidebar.js` | `<a class="sidebar__brand">` | `.sidebar__brand` | Logo link at top of sidebar |
| `sidebar.js` | `<nav class="sidebar__nav">` | `.sidebar__nav` | Container for nav links |
| `sidebar.js` | `<a class="sidebar__link">` | `.sidebar__link` | Navigation item link |
| `main.js` | `link.setAttribute('aria-current', 'page')` | `.sidebar__link[aria-current="page"]` | Active route indicator (accent highlight) |
| `sidebar.js` | `<header class="top-bar">` | `.top-bar` | Sticky top header containing semester switcher |
| `sidebar.js` | `<label class="semester-switcher">` | `.semester-switcher` | Active semester dropdown wrapper |
| `sidebar.js` | `<button class="sidebar-backdrop">` | `.sidebar-backdrop` | Dark overlay when mobile drawer is open |

### B. Shared Component Classes (`modal.js`, `notifications.js`, `statCard.js` ↔ `components.css`)
| Component | Class Name | Functionality / Appearance |
| :--- | :--- | :--- |
| `modal.js` | `.modal-backdrop` | Fixed full-screen overlay with dark transparent background (`rgba(0,0,0,.72)`) |
| `modal.js` | `.modal` | Dialog container, max-width 520px, 14px radius, scrollable |
| `modal.js` | `.modal__header` | Title and close button row |
| `modal.js` | `.modal__actions` | Bottom action button row (Cancel / Submit) |
| `notifications.js` | `.toast-region` | Fixed container in bottom-right corner (`aria-live="polite"`) |
| `notifications.js` | `.toast` | Toast card with 4.5s auto-dismissal |
| `notifications.js` | `.toast--error` | Red border alert toast |
| `notifications.js` | `.skeleton` | Loading placeholder block with pulsing opacity animation |
| `statCard.js` | `.stat-card` | Metric tile displaying label, large number, and subtitle |
| `statCard.js` | `.stat-card__label` | Uppercase/muted header text |
| `statCard.js` | `.stat-card__value` | Prominent 2rem value |

### C. Grade & Calculation Tools (`subjectGradeTools.js` ↔ `components.css`)
| Element | Class Name | Visual Role |
| :--- | :--- | :--- |
| Panel Wrapper | `.grade-tool-panel` | Vertical grid layout for calculation panels |
| Values Grid | `.grade-values-grid` | Responsive grid of metric cards (earned, completed, remaining, projected) |
| Breakdown Section | `.weight-breakdown-section` | Header and progress container for weight allocation |
| Multi-Segment Bar | `.weight-breakdown` | Full-width rounded horizontal bar |
| Completed Segment | `.weight-breakdown__completed` | Green bar segment (`--accent`) |
| Remaining Segment | `.weight-breakdown__remaining` | Amber bar segment (`--warning`) |
| Unconfigured Segment| `.weight-breakdown__unconfigured`| Gray bar segment (`--border`) |
| Warning Meter | `.weight-meter--warning` | Amber alert displayed when total configured weights != 100% |
| What-If Row | `.what-if-row` | Input row for simulating hypothetical assessment scores |
| Target Panel | `.target-panel` | Target grade input box and dynamic requirement result message |

### D. Table-to-Card Responsive Pattern (`components.css`)
On mobile devices (`@media (max-width: 767px)`), tables automatically morph into stacked card layouts:
```css
/* How tables become cards on mobile */
.subjects-table thead { display: none; }
.subjects-table tr {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 14px;
  border-radius: var(--radius-card);
  background: var(--surface);
  margin-bottom: 12px;
}
.subjects-table td::before {
  content: attr(data-label);
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}
```
**Important**: When modifying HTML tables in JavaScript (`subjects.js`, `subjectDetail.js`, `gwaCalculator.js`, `history.js`), **always** populate `td.dataset.label = '...'` or `setAttribute('data-label', '...')` so mobile card labels render properly.

---

## 5. Screen Breakdown & Data Flow

### 1. Dashboard (`src/js/pages/dashboard.js`)
- **Data Hook**: Calls `loadAcademicRecords()` from `src/js/api/academicRecordsApi.js`.
- **Calculations Called**:
  - `computeGwa(subjects)`
  - `classifyAssessments(assessments)` (extracts overdue vs. upcoming within 14 days)
  - `sumSubjectUnits(subjects)`
- **UI Sections**:
  - Page Heading (`.page-heading`)
  - 3-Column Stats Grid (`.stats-grid`): Current Semester GWA, Cumulative GWA, Enrolled Units
  - Quick Action Links (`.dashboard-quick-actions__links`): Semesters, Subjects, Assessments, GWA
  - Current Subjects List (`.dashboard-subject-list`): Subject code, name, unit count, and current grade
  - Lower Grid (`.dashboard-lower-grid`): Overdue/Upcoming Assessments and Recent Audit Activity Feed

### 2. Subjects (`src/js/pages/subjects.js`)
- **Data Hook**: Calls `listSubjects(semesterId)`, `createSubject()`, `updateSubject()`, `deleteSubject()`.
- **Calculations Called**: `computeSubjectGrade(subject, categories, assessments)`.
- **Features**:
  - Filtered by the active semester.
  - Table of subjects showing code, name, units, instructor, tracking mode, current grade, and status.
  - Modal form for creating/editing subject (validates code, name, and units > 0).

### 3. Subject Detail (`src/js/pages/subjectDetail.js`)
- **Route**: `#/subjects/:id` (validates UUID in route param).
- **Data Hook**: Calls `getSubject(id)`, category APIs, and assessment APIs.
- **Tabs (`.tabs`, `.tab`, `.tab--active`)**:
  1. **Assessments**: Category manager (`.category-manager`), weight meter alert, assessment items table, score entry modal.
  2. **Grade Calculator**: `createCalculationPanel()` showing earned points and weight distribution.
  3. **Predictor**: `createPredictorPanel()` showing what-if inputs and target required score calculations.
  4. **Final Grade**: `createFinalGradePanel()` for percentage-to-grade conversions and recording manual/computed final marks.

### 4. GWA Calculator (`src/js/pages/gwaCalculator.js`)
- **Data Hook**: Calls `loadAcademicRecords()`, `saveFinalGrade()`, `updateSubject()`.
- **Calculations Called**: `computeGwa()`, `computeCumulativeGwa()`.
- **Key Philippine Academic Rules**:
  - Excludes non-numeric final grades (`INC`, `IP`, `DR`, `WDRW`) from GWA calculations.
  - Excluded subjects are listed in the `.gwa-uncounted` section with the specific reason.
  - Interactive "What-If" mode allows testing hypothetical grades without persisting changes.

### 5. Settings (`src/js/pages/settings.js`)
- **Data Hook**: Calls `getProfile()`, `updateProfile()`, `listGradingProfiles()`, `clearGradiData()`.
- **Features**:
  - Profile preferences (name, GWA decimal precision: 2 or 4).
  - Default semester selector.
  - MSU-IIT Grading Rules Editor (validates non-overlapping ranges covering 0% to 100%).
  - JSON Data Export (`gradi-export-YYYY-MM-DD.json`).
  - Dangerous Data Purge (requires typing `DELETE MY DATA`).

---

## 6. Safe Modification Rules for Another AI

When prompting another AI to edit or redesign the UI, instruct it to adhere to these rules:

### DO:
1. **Focus Edits on CSS**: Enhance visual appeal by editing `src/css/tokens.css`, `src/css/layout.css`, `src/css/components.css`, and `src/css/auth.css`.
2. **Elevate Typography & Surfaces**: Use modern card elevation, refined borders, subtle gradients, and consistent padding.
3. **Keep `h()` Element Generation Clean**: When modifying JS view code (`src/js/pages/*` or `src/js/components/*`), preserve DOM events, accessibility attributes (`aria-*`, `role`), and element IDs.
4. **Preserve `data-label` on Tables**: Every `<td>` element in tables must retain its `data-label` attribute for mobile responsiveness.
5. **Always Run Checks**:
   - `npm test` (must keep all 61 tests passing).
   - `npm run build` (must compile cleanly with zero Vite warnings/errors).

### DO NOT:
1. **NEVER touch math or services**: Do not edit `src/js/services/`. Formulas for GWA, contribution weights, and prediction targets must remain pure functions.
2. **NEVER touch Supabase database calls**: Do not alter query signatures or table models in `src/js/api/` or `src/js/auth/`.
3. **NEVER touch `.env`**: Never read, print, stage, or edit `.env`.
4. **NEVER install frameworks**: Do not introduce React, Vue, Tailwind, Bootstrap, or any UI package. The app must stay vanilla JS and pure CSS.
5. **NEVER bypass validation**: Keep input boundaries (e.g. scores between 0 and total, weights between 0 and 100%, units > 0).

---

## 7. Quick Context Prompt to Feed Another AI

You can copy and paste this prompt when handing this guide to another AI:

> "I am working on Gradi, a vanilla JavaScript SPA grade tracker for Philippine university students. Please read `FRONTEND_MAP.md` in the project root to understand the architecture, CSS classes, DOM structure, and layer boundaries. 
> 
> Your task: Help me redesign/polish the frontend UI.
> Constraints:
> - Keep vanilla JavaScript (no React/Tailwind/Bootstrap).
> - Do not modify math formulas in `src/js/services/`.
> - Do not alter Supabase queries in `src/js/api/` or auth in `src/js/auth/`.
> - Never touch, print, or commit `.env`.
> - Keep all Vitest tests passing (`npm test`)."
