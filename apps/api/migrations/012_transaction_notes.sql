-- Add notes column to transactions (raw הערות text from MAX/CAL imports)
ALTER TABLE transactions ADD COLUMN notes TEXT;
