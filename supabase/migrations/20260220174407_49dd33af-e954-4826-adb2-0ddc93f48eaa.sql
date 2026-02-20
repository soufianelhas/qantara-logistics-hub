-- Add unique constraint for document upsert to work correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_documents_unique 
ON public.shipment_documents (user_id, document_type, shipment_id) 
WHERE shipment_id IS NOT NULL;

-- Also add a unique index for documents without shipment_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_documents_unique_no_shipment
ON public.shipment_documents (user_id, document_type)
WHERE shipment_id IS NULL;