ALTER TABLE public.pharmacy_documents
  ALTER COLUMN brand_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.pharmacy_documents'::regclass
      AND conname = 'pharmacy_documents_pharmacy_type_key'
  ) THEN
    ALTER TABLE public.pharmacy_documents
      ADD CONSTRAINT pharmacy_documents_pharmacy_type_key
      UNIQUE (pharmacy_id, document_type);
  END IF;
END $$;
