-- Define the destination_country column for state handover
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS destination_country TEXT;

-- Create the market_intelligence table
CREATE TABLE public.market_intelligence (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_data JSONB,
    benchmarking JSONB,
    strategic_advice TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_market_intelligence_shipment UNIQUE (shipment_id)
);

-- Row Level Security policies
ALTER TABLE public.market_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own market intelligence"
    ON public.market_intelligence FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own market intelligence"
    ON public.market_intelligence FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own market intelligence"
    ON public.market_intelligence FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own market intelligence"
    ON public.market_intelligence FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_market_intelligence_updated_at
    BEFORE UPDATE ON public.market_intelligence
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
