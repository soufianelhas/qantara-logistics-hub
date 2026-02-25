DROP INDEX IF EXISTS idx_shipment_documents_upsert;
DROP INDEX IF EXISTS idx_shipment_documents_unique;
CREATE UNIQUE INDEX idx_shipment_documents_upsert 
  ON public.shipment_documents (user_id, document_type, shipment_id);