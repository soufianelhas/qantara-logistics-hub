
-- Document status enum
CREATE TYPE public.document_status AS ENUM ('Missing', 'Draft', 'Ready', 'Filed');

-- Shipment documents table
CREATE TABLE public.shipment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  document_type TEXT NOT NULL,
  document_label TEXT NOT NULL,
  target_market TEXT NOT NULL DEFAULT 'EU',
  status public.document_status NOT NULL DEFAULT 'Missing',
  file_path TEXT,
  generated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shipment documents"
  ON public.shipment_documents FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own shipment documents"
  ON public.shipment_documents FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own shipment documents"
  ON public.shipment_documents FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own shipment documents"
  ON public.shipment_documents FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_shipment_documents_updated_at
  BEFORE UPDATE ON public.shipment_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for export documents
INSERT INTO storage.buckets (id, name, public) VALUES ('export-documents', 'export-documents', false);

CREATE POLICY "Authenticated users can upload to export-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'export-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own export documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'export-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own export documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'export-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
