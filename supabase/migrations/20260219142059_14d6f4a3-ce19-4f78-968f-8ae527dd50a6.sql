
-- Create ai_studio_presets table (public reference data, no user_id)
CREATE TABLE public.ai_studio_presets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_name text NOT NULL,
  system_prompt text NOT NULL,
  target_market text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_studio_presets ENABLE ROW LEVEL SECURITY;

-- Public read-only policy (reference data — no auth required)
CREATE POLICY "Anyone can view ai_studio_presets"
  ON public.ai_studio_presets
  FOR SELECT
  USING (true);
