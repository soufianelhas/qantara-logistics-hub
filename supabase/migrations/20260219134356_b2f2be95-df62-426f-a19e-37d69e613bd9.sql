
-- Create shipment_status enum
CREATE TYPE public.shipment_status AS ENUM ('Draft', 'Calculated', 'Filed', 'Port-Transit', 'Delivered');

-- Create shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  product_name TEXT NOT NULL,
  raw_cost_v DECIMAL(15, 2) NOT NULL DEFAULT 0,
  freight DECIMAL(15, 2) NOT NULL DEFAULT 0,
  insurance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  duty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  taxes DECIMAL(15, 2) NOT NULL DEFAULT 0,
  e_factor_multiplier DECIMAL(6, 4) NOT NULL DEFAULT 1.0,
  hs_code_assigned TEXT,
  status public.shipment_status NOT NULL DEFAULT 'Draft',
  port_congestion_level TEXT,
  weather_risk_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Helper function to check ownership
CREATE OR REPLACE FUNCTION public.is_shipment_owner(shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shipments
    WHERE id = shipment_id AND user_id = auth.uid()
  );
$$;

-- RLS Policies
CREATE POLICY "Users can view their own shipments"
  ON public.shipments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own shipments"
  ON public.shipments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own shipments"
  ON public.shipments FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
