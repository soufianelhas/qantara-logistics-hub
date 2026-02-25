-- Add unique constraint on (user_id, document_type, shipment_id) for upsert conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_documents_upsert 
ON public.shipment_documents (user_id, document_type, shipment_id) 
WHERE shipment_id IS NOT NULL;