# Part 1: Multi-Modal Route Discovery + Part 2: Shipment Details Page

This is a large feature set spanning two major additions: a Route Discovery module inside the Landed Cost Engine and a new Shipment Details page. Here is the implementation plan.

---

## Part 1: Multi-Modal Route Discovery

### 1.1 New Edge Function: `fetch-logistics-rates`

Create `supabase/functions/fetch-logistics-rates/index.ts` that:

- Accepts `{ origin_port, destination_market, e_factor }` in the request body
- Returns a structured JSON array of transport options across 4 modes (Sea, Air, Road, Rail) with fields: `mode`, `provider`, `base_cost`, `transit_days`, `reliability_score`, `carbon_footprint`, `currency`
- Uses simulated/seed data for providers (Maersk, CMA CGM for Sea; DHL, Royal Air Maroc for Air; Moroccan trucking for Road; ONCF for Rail)
- Calls the Lovable AI Gateway (Gemini 3 Flash) to generate a "Strategic Advice" summary explaining the best route choice given the current E-Factor and weather conditions
- If `e_factor > 1.2`, the AI prompt will include context about critical maritime risk so the recommendation favors alternatives
- Returns both the `routes` array and a `strategic_advice` string

Register in `supabase/config.toml` with `verify_jwt = false`.

### 1.2 LandedCostEngine.tsx -- Route Discovery UI

Add a collapsible "Route Discovery" section triggered by a "Find Routes" button next to the Freight (F) input field:

- **Card Grid Layout**: Display route options as comparison cards (like flight search results), grouped by mode (Sea / Air / Road / Rail)
- Each card shows: Provider Name, Price (USD), ETA (days), Reliability Score (percentage bar), Carbon Footprint
- **Weather Warning Badge**: If E-Factor data is loaded and `multiplier > 1.2`, Sea cards get a red "Weather Warning" badge; Road/Air cards get a green "Qantara Recommended" badge
- **Strategic Advice Box**: A highlighted card at the top showing the Gemini-generated recommendation text
- **Route Selection**: Clicking a route card auto-fills the Freight (F) input field and triggers a recalculation of the Realistic Total
- New state: `routeDiscoveryOpen`, `logisticsRates`, `routesLoading`, `selectedRoute`, `strategicAdvice`

### 1.3 Data Flow

When user clicks "Find Routes":

1. Call `fetch-logistics-rates` edge function, passing the current E-Factor multiplier and port congestion level
2. Display results in the card grid
3. On card selection, update `freight` state which auto-persists to localStorage
4. If cost was already calculated, re-run `handleCalculate` to refresh the comparison table

---

## Part 2: Shipment Details Page 

### 2.1 New Route and Page

- Create `src/pages/ShipmentDetails.tsx`
- Add route `/shipments/:id` in `App.tsx`, wrapped with `AuthGuard`

### 2.2 Data Fetching

- Extract `id` from URL params using `useParams()`
- Fetch from `shipments` table (single row by ID, scoped to user via RLS)
- Fetch from `shipment_documents` table filtered by `shipment_id`
- Fetch live E-Factor from `weather-efactor` edge function for the real-time weather snapshot

### 2.3 Four-Quadrant Layout

The page uses a 2x2 grid of white cards on the beige background:

**Quadrant 1 -- Core Logistics Identity (top-left)**

- Large Status Badge (color-coded: Draft=gray, Calculated=amber, Filed=green, Port-Transit=blue)
- Product Name, HS Code, Origin Port (derived from weather data or "Casablanca" default), Destination Market
- Created date, last updated

**Quadrant 2 -- Cost & Rate Summary (top-right)**

- Full cost breakdown: V, F, I, D, T with E-Factor applied
- Optimistic vs Realistic totals in a compact comparison
- Selected transport mode info (if stored; otherwise "Not selected")

**Quadrant 3 -- E-Factor & Weather Snapshot (bottom-left)**

- Real-time port weather cards (same style as LCE) for the 3 Moroccan ports
- E-Factor multiplier display with contribution breakdown
- Port congestion and storm risk badges

**Quadrant 4 -- Compliance & Documents (bottom-right)**

- Checklist of documents from `shipment_documents` with status icons (Missing/Draft/Ready/Filed)
- Progress bar showing ready count vs total
- Placeholder for "AI-enhanced product image" from Authenticity Studio

### 2.4 Strategic Alert Banner

If shipment status is "Draft" or "Calculated" and current live E-Factor > 1.2:

- Display a full-width warning banner at the top: "STRATEGIC ALERT: High transit risk detected..."
- Include a "Resume Workflow" button that navigates to the correct step based on status (Draft -> LCE, Calculated -> Documentation Workshop)

### 2.5 Dashboard Integration

- Make shipment rows in `Dashboard.tsx` clickable, navigating to `/shipments/{id}`
- Add cursor-pointer styling and an onClick handler to each shipment row

### 2.6 Styling

- Navy Blue headers (#1B263B), Background Beige (#F5EBE0) -- already in the design system
- White cards with subtle shadows (`shadow-card` class already exists)
- Consistent with the existing `AppLayout` wrapper

---

## Technical Summary


| Change             | File                                                |
| ------------------ | --------------------------------------------------- |
| New edge function  | `supabase/functions/fetch-logistics-rates/index.ts` |
| Register function  | `supabase/config.toml`                              |
| Route Discovery UI | `src/pages/LandedCostEngine.tsx`                    |
| New details page   | `src/pages/ShipmentDetails.tsx`                     |
| New route + import | `src/App.tsx`                                       |
| Clickable rows     | `src/pages/Dashboard.tsx`                           |


No database schema changes are required -- all needed tables and columns already exist.