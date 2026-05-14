ALTER TABLE transactions ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_book_source_ref
  ON transactions(book_id, source, source_ref)
  WHERE source_ref IS NOT NULL;
