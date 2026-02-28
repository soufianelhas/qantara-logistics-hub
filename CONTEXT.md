Qantara Hub: The Strategic Blueprint
1. Core Vision & Business Identity
Qantara Hub is an elite Export Consultancy & Forwarding Agency Management Platform. It is designed specifically for the Moroccan export ecosystem (hubs: Tanger Med, Casablanca, Agadir).

Unlike a generic logistics tracker, Qantara is a Strategic Advisory Engine. It doesn't just move cargo; it uses AI and real-time environmental data to optimize trade routes and minimize financial risk for premium Moroccan brands.

2. The "Golden Thread" (Architectural Workflow)
The application follows a strictly linear, state-persisted workflow. Every shipment must progress through these intelligence layers:

Identity Layer (Authenticity Studio): Refines product imagery to international premium standards.

Taxonomy Layer (HS Neural Navigator): AI maps product descriptions to Global HS/Tariff Codes.

Logistics Layer (Landed Cost Engine): * Captures Context: Origin, Destination, Weight.

Route Discovery: Simulates/Scrapes Multi-modal rates (Sea, Air, Road).

Calculates Risk: Applies the E-Factor.

Compliance Layer (Documentation Workshop): Generates the "Big 7" export documents (Invoices, Packing Lists, EUR.1).

Management Layer (Dashboard/Archive): Centralized CRM for tracking multi-client lifecycles.

3. The "E-Factor" Logic (Proprietary Intelligence)
The E-Factor (Environmental Factor) is the core differentiator.

Source: Real-time OpenWeather API calls for Moroccan transit hubs.

Trigger: High wind speeds (>25 knots) or low visibility.

Impact: A mathematical multiplier applied to the Landed Cost Formula: Realistic Total = (V + F + I + D + T) * E.

UX Rule: If E > 1.2, the system must proactively recommend Road/Trucking over Maritime routes.

4. Technical Stack & Standards
Frontend: React (Vite) + TypeScript.

Styling: Tailwind CSS + Shadcn UI (Radix).

Palette: "Professional Minimalism" — Navy Blue (#1B263B), Slate Grays, and Background Beige (#F5EBE0).

Backend: Supabase (PostgreSQL + RLS + Edge Functions).

Intelligence: Google Gemini API (Grounding Search for market rates and strategic advice).

Persistence: All form states are anchored to a shipment_id and persisted via use-shipment-recovery.ts to prevent data loss.

5. System Design Principles (The "Antigravity" Guardrails)
State Persistence: No data should ever be "temporary." If a user enters a weight, it is saved to Supabase.

Contextual Awareness: Every module must know the current shipment_id, client_id, and destination.

Atomic Transactions: Document saves must use the unique_shipment_doc_type constraint (Upsert on conflict).

Branding: Every exported PDF or Strategic Report must carry the Qantara Hub visual identity (Navy headers, minimalist layout).

6. Functional Domains (Expansion Areas)
The system is architected to inherently support:

Multi-Client CRM: Every shipment belongs to a client_id in the clients table.

Agency Financials: Support for Agency/Consultancy Fees and Incoterms (EXW, FOB, CIF, DDP) on top of base costs.

Operational Milestones: Tracking shipments from Booking to Customs Clearance to Final Delivery.

Advisory Reports: Using Gemini to provide market-entry strategy (retail pricing, compliance hurdles) based on the HS code and destination.