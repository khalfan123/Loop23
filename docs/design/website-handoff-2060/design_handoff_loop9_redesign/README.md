# Handoff: Loop9 Dashboard UI System

## Overview
This package defines the visual design system and layout for the **Loop9 AI call center** web app, using the Analytics/Dashboard page as the reference implementation. The goal is to **apply this exact look-and-feel consistently across ALL pages** of the app (Dashboard, Live, Phone Numbers, Knowledge Base, Inbound, Automation, Operations, Voices, Billing, Settings, Call History, and any others).

The design is a clean, light, rounded SaaS aesthetic: white surfaces, soft 1px borders, generous rounded corners (16px cards), a blue primary accent, and green/amber/red/purple status colors. It closely matches the existing Loop9 product so it drops into the current app naturally.

## About the Design Files
The file in this bundle (`AURA Command.dc.html`) is a **design reference created in HTML** — a prototype showing the intended look, structure, and states. It is **not production code to copy directly**.

The task is to **recreate this design in Loop9's existing codebase** (React/Next.js based on the `railway.app` deployment and component structure) using its established patterns, component library, routing, and data layer. Wire the real data/state where the prototype shows static sample values (e.g. `13`, `100%`, `0:46`). Where the app already has working pages, **restyle them to match these tokens and layout primitives** rather than replacing their logic.

> Note: the HTML file's top-level element/id is named `AURA Command` for historical reasons — treat it as the **Loop9** dashboard. Ignore that name.

## Fidelity
**High-fidelity (hifi).** Colors, typography scale, spacing, radii, and component states below are final. Recreate the UI pixel-accurately using the codebase's existing libraries (icon set, chart lib, etc.), matching these values.

---

## Global Layout (applies to every page)

Three-region shell that must be consistent app-wide:

1. **Top bar** — fixed height **64px**, full width, `1px solid #EEF0F3` bottom border.
   - Left (width **236px**, matches the nav column): brand lockup — 38×38 rounded (11px) gradient logo `linear-gradient(150deg, #6366F1, #3B82F6)` with a white chat/loop glyph, then "**Loop9**" (18px/700) over "AI call center" (11.5px, `#94A3B8`).
   - Then a **phone-line selector** pill: phone icon + active line number + chevron, `1px solid #E6E9EE`, radius 10px, padding 7px 12px.
   - Center: **search** field, max-width 560px, `#F5F6F8` fill, `1px solid #EDEFF2`, radius 11px, padding 9px 15px, magnifier icon + "Search..." placeholder (`#9AA3B0`) + `⌘K` hint chip.
   - Right: theme-toggle icon button (38×38, hover `#F4F6F9`) and an avatar pill (30px circle initial + chevron, `1px solid #E6E9EE`, radius 20px).

2. **Left nav** — width **236px**, `1px solid #EEF0F3` right border, padding 16px 12px, vertical scroll.
   - Primary items: **Dashboard**, **Live**.
   - Group label "**SETUP**": Phone Numbers, Knowledge Base, Inbound, Automation.
   - Group label "**MANAGE**": Operations, Voices, Billing, Settings.
   - Pinned to bottom: a **Credits** card (border `#EEF0F3`, radius 12px) showing credits total (700 weight) + a blue "Pro" chip; and an **account row** (32px avatar, name 13px/600, email 11.5px `#94A3B8` truncated, chevron).
   - Nav item spec: flex row, gap 11px, padding 9px 12px, radius 9px, 14px text `#475569`, icon `#94A3B8`. **Hover**: bg `#F4F6F9`, text `#0F172A`. **Active**: bg `#EEF4FF`, text + icon `#2563EB`, weight 600.
   - Group labels: 11px/600, letter-spacing 0.08em, `#94A3B8`, padding 16px 12px 6px.

3. **Contextual submenu** — width **208px**, `1px solid #EEF0F3` right border, padding 20px 12px. Per-section second-level nav. On Dashboard it shows a page title (17px/700), a "**VIEWS**" group (Analytics, Call History, Live) using the same item spec as the left nav, and a "**METRICS**" group of label/value rows (label `#475569` 13.5px, value 700; positive values `#16A34A`).
   - **This column is optional per page** — pages without sub-views can omit it and let the main content span the remaining width. Keep it for pages that have sub-views or at-a-glance metrics.

4. **Main content** — fills remaining width, background `#FBFCFD`, padding 26px 30px 34px, vertical scroll.

---

## Screens / Views

### Screen: Analytics (Dashboard → Analytics) — the reference page

**Purpose:** At-a-glance performance metrics for the selected date range.

**Layout (top to bottom in main content):**

1. **Title row** (flex, align-start, gap 16px, margin-bottom 22px):
   - 52×52 rounded (14px) icon tile, bg `#F1F4F9`, bar-chart icon `#334155`.
   - Title "**Analytics**" (27px/700, letter-spacing −0.02em) + subtitle "Comprehensive insights and performance metrics" (14.5px, `#94A3B8`).
   - Right: **date-range** pill ("Last 7 Days" + chevron; white, `1px solid #E6E9EE`, radius 11px, padding 10px 14px) and a primary **Export Report** button (bg `#2563EB`, white, radius 11px, padding 10px 16px, download icon, shadow `0 3px 8px rgba(37,99,235,0.28)`).

2. **Tab bar** — segmented control, inline-flex, bg `#F1F4F8`, radius 12px, padding 4px. Tabs: **Overview** (active), Campaigns, Reports, Calls. Active tab: white fill, radius 9px, shadow `0 1px 2px rgba(15,23,42,0.08)`, text `#0F172A`/600. Inactive: `#64748B`.

3. **Section header "KEY METRICS"** — chevron icon + label (12.5px/700, letter-spacing 0.08em, `#64748B`). Collapsible in the real app.

4. **KPI cards** — 4-up grid, gap 18px. Each is a `.card` (below), padding 20px 22px:
   - Header row: metric label (14px `#64748B`) + 34×34 rounded (10px) tinted icon tile.
   - Big value: 38px/700, letter-spacing −0.03em, margin 14px 0 12px.
   - Footer: up-arrow (green) + delta "0%" (`#16A34A`/600) + " vs previous period" (`#94A3B8`).
   - The four cards & icon tints:
     - **Total Calls** = `13`, phone icon, tile `#EEF4FF` / icon `#2563EB`.
     - **Success Rate** = `100%`, trending-up icon, tile `#EAFAF1` / icon `#16A34A`.
     - **Qualified Leads** = `2`, users icon, tile `#F2EEFE` / icon `#7C3AED`.
     - **Avg Duration** = `0:46` with an inline green sparkline; footer text "minutes per call". clock icon, tile `#EEF4FF` / icon `#2563EB`.

5. **Ring-gauge cards** — 4-up grid, gap 18px. Each `.card`, padding 22px, column-centered: a 112px SVG donut (track `#EEF1F5`, stroke width 9, round caps) + centered value (26px/700) + label (14px/600) + sub-label (12.5px `#94A3B8`).
   - **Success Rate**: full green (`#22C55E`) ring, value `100`, sub "%".
   - **Qualified Rate**: small amber (`#F59E0B`) arc, value `2`, sub "/ 13".
   - **Incoming %**: full green ring, value `13`, sub "/ 13".
   - **Campaign %**: empty ring with a single red (`#EF4444`) dot at top, value `0`, sub "/ 13".

6. **Section header "TRENDS & ACTIVITY"** — same style as KEY METRICS.

7. **Two-up grid** (gap 18px):
   - **Daily Call Volume** `.card`: title 17px/700; a bar chart, y-axis ticks 12/9/6/3, left+bottom axis lines `#EEF1F5`, 7 day bars (Mon–Sun). Low bars `#DBE4F0`; the busy day is a blue gradient bar `linear-gradient(180deg, #3B82F6, #60A5FA)`, radius 5px 5px 0 0.
   - **Call Activity Heatmap** `.card`: title 17px/700; a 7-row × 24-column grid of 3px-radius cells (empty `#F1F4F8`, active `#3B82F6`), day labels Mon–Sun on the left, time axis 00:00→21:00 across the top, and a Less→More legend (`#F1F4F8`, `#CFE0F5`, `#94BDF0`, `#3B82F6`).

---

## Interactions & Behavior
- **Nav & submenu items**: hover tint + active state as specified; clicking routes to the corresponding page/sub-view.
- **Tabs**: switch the main content region; active tab gets the white "pill" treatment.
- **Date-range pill**: opens a dropdown of ranges (Today, Last 7 Days, Last 30 Days, Custom…); selection refetches metrics.
- **Export Report**: triggers report export for the current range/tab.
- **Section headers** (KEY METRICS / TRENDS & ACTIVITY): chevron toggles collapse/expand of that section.
- **Cards**: subtle hover elevation is acceptable but optional; keep it restrained.
- **No decorative/looping animation.** Transitions should be short (120–160ms ease) for hovers, dropdowns, and collapse. Charts may animate in once on mount (≤400ms) but must settle to a static state.
- **Responsive**: below ~1100px, collapse the submenu column first, then the left nav to an icon-only rail (44px). Cards reflow 4→2→1 per row.

## State Management
- `activeNavItem`, `activeSubView`, `activeTab` — current selection in each nav region.
- `dateRange` — selected range; drives all metric queries.
- Metric data: `totalCalls`, `successRate`, `qualifiedLeads`, `avgDuration`, `incomingCount`, `campaignCount`, `qualifiedRate`, plus `dailyVolume[]` (per-day counts) and `heatmap[7][24]` (per day-hour counts).
- `credits`, `plan` for the sidebar card; `user` for the account row.
- Loading & empty states: show skeletons in cards while fetching; the sample data reflects a near-empty week (mostly zeros with one active day) — make sure zero/empty states render cleanly.

## Design Tokens

### Colors
- Page background: `#FBFCFD`
- Surface / card: `#FFFFFF`
- Primary accent (blue): `#2563EB` (hover `#1D4ED8`); tint fill `#EEF4FF`
- Brand gradient: `linear-gradient(150deg, #6366F1, #3B82F6)`
- Success (green): `#16A34A` / ring `#22C55E`; tint `#EAFAF1`
- Warning (amber): `#F59E0B`
- Danger (red): `#EF4444`
- Purple (leads): `#7C3AED`; tint `#F2EEFE`
- Text primary: `#0F172A`; secondary `#475569`; muted `#64748B`; faint `#94A3B8`; placeholder `#9AA3B0`
- Borders: primary `#EEF0F3`; inputs/controls `#E6E9EE` / `#EDEFF2`; chart grid & ring track `#EEF1F5` / `#F1F4F5`
- Neutral fills: `#F4F6F9` (hover), `#F5F6F8` (search), `#F1F4F8` (tab track / heatmap empty), `#F1F4F9` (icon tile)
- Chart low bar: `#DBE4F0`; heatmap ramp: `#F1F4F8` → `#CFE0F5` → `#94BDF0` → `#3B82F6`

### Typography
- Family: system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif`. (If Loop9's codebase uses Inter, use Inter — the design is tuned for a neutral grotesque.)
- Page title: 27px / 700 / −0.02em
- Card/section titles: 17px / 700
- Big KPI value: 38px / 700 / −0.03em
- Ring value: 26px / 700
- Body / nav: 14px; secondary 13–13.5px; labels 11–12.5px
- Group labels: 11–12.5px / 600 / 0.08em uppercase

### Spacing
Base 4px scale. Common: card padding 20–24px; grid gaps 18px; nav item padding 9px 12px; content padding 26px 30px 34px.

### Border radius
- Cards: 16px
- Buttons / pills / inputs: 10–11px
- Icon tiles: 10–14px
- Nav items: 9px
- Avatar pill: 20px; avatars: 50%
- Chart bars: 5px (top corners); heatmap cells: 3px

### Shadows
- Card: `0 1px 2px rgba(15,23,42,0.04)`
- Primary button: `0 3px 8px rgba(37,99,235,0.28)`
- Brand logo: `0 3px 8px rgba(59,130,246,0.28)`
- Active tab: `0 1px 2px rgba(15,23,42,0.08)`

## Assets
- **Icons**: all icons in the prototype are inline SVG drawn in the **Lucide** style (bar-chart, phone, radio/live, book, download, zap, sliders, mic, credit-card, settings-gear, search, sun, chevron, users, trending-up, clock, coins). In the codebase, use the project's existing icon library (Lucide React recommended) rather than the inline SVGs.
- **Logo**: gradient rounded-square chat/loop mark — replace with Loop9's real logo asset if available.
- **Charts**: recreate with the codebase's charting approach (the prototype uses hand-built SVG/DOM). No external chart images.
- No raster/photographic assets are used.

## Files
- `AURA Command.dc.html` — the full reference design (top bar + left nav + submenu + Analytics main page, with all tokens applied inline). Open in a browser to inspect exact values; every color/size above is drawn from this file.

## How to apply across all pages (developer checklist)
1. Extract the tokens above into the app's theme (CSS variables / Tailwind config / theme file).
2. Build shared shell components: `TopBar`, `LeftNav` (with groups + credits/account footer), optional `SubMenu`, and a `PageShell` that composes them.
3. Build primitives: `Card`, `KpiCard`, `RingGauge`, `SegmentedTabs`, `Pill/Dropdown`, `PrimaryButton`, `SectionHeader`, `BarChart`, `Heatmap`.
4. Recreate the Analytics page with real data as the template.
5. Roll the same shell + primitives onto every other route (Dashboard, Live, Phone Numbers, Knowledge Base, Inbound, Automation, Operations, Voices, Billing, Settings, Call History), matching nav active-states per route and swapping the main content per page's function.
6. Verify hover/active/focus states, responsive collapse, and empty/loading states on each page.
