

# Fix: Shipment Saving in Documentation Workshop

## Root Cause

The entire data persistence pipeline is broken because **there is no user authentication**. Every Supabase table (`shipments`, `shipment_documents`) has Row-Level Security (RLS) policies that require `auth.uid()` to match `user_id`. Without a logged-in user:

- The HS Navigator cannot create a Draft shipment
- The Landed Cost Engine cannot save/update costs (the insert silently fails, so no `shipment_id` is generated)
- The Documentation Workshop never receives a `shipment_id`, so the Finalize button stays permanently disabled
- Shipment recovery also fails because `getUser()` returns null

## Solution

Add a minimal authentication system (signup + login pages) and protect the workflow routes behind it.

### Step 1: Create Auth Pages

- Create `src/pages/Auth.tsx` with email/password **Sign Up** and **Sign In** tabs
- Use `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`
- On successful login, redirect to the Dashboard

### Step 2: Add an Auth Guard

- Create `src/components/AuthGuard.tsx` that checks `supabase.auth.getSession()`
- If no session, redirect to `/auth`
- Wrap the main app routes with this guard

### Step 3: Add Auth Route

- Register `/auth` in `App.tsx` routing
- Add a "Sign Out" button to the sidebar

### Step 4: Harden Error Handling

- In `LandedCostEngine.tsx`, when the Supabase insert/update fails, show a clear error toast instead of silently navigating without a `shipment_id`
- In `DocumentationWorkshop.tsx`, if recovery fails due to no auth, show a message directing the user to log in

### Why This Fixes Everything

Once authenticated:
- HS Navigator creates a Draft shipment with `user_id = auth.uid()` (passes RLS)
- LCE updates/creates the shipment and passes `shipment_id` in the URL
- Documentation Workshop receives the ID, auto-saves documents, and the Finalize button activates
- Dashboard KPIs and "Resume Recent" load real data

### Technical Details

- No database changes needed -- tables and RLS policies are already correctly configured
- Email confirmation will NOT be auto-enabled (users verify email before signing in, per Supabase defaults)
- Auth state persists via `localStorage` (already configured in the Supabase client)

