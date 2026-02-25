
-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  tax_id TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients
CREATE POLICY "Users can view their own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = user_id);

-- Add new columns to shipments
ALTER TABLE public.shipments
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN agency_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN incoterm TEXT NOT NULL DEFAULT 'EXW';

-- Index for fast client lookups on shipments
CREATE INDEX idx_shipments_client_id ON public.shipments(client_id);
