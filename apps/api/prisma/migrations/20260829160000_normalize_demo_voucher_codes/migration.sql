-- Normalize the showcase voucher codes to the canonical 12-character format.
-- The predicates make this migration a no-op in environments without the
-- showcase dataset. Voucher relations remain intact because code_id is stable.
WITH code_mapping(old_code, new_code) AS (
  VALUES
    ('DEMO-001-20260828', 'D00120260828'),
    ('DEMO-002-20260828', 'D00220260828'),
    ('DEMO-003-20260828', 'D00320260828'),
    ('DEMO-004-20260828', 'D00420260828'),
    ('DEMO-005-20260828', 'D00520260828'),
    ('DEMO-006-20260828', 'D00620260828'),
    ('DEMO-007-20260828', 'D00720260828'),
    ('DEMO-008-20260828', 'D00820260828'),
    ('DEMO-009-20260828', 'D00920260828'),
    ('DEMO-010-20260828', 'D01020260828'),
    ('DEMO-011-20260828', 'D01120260828'),
    ('DEMO-012-20260828', 'D01220260828'),
    ('DEMO-013-20260828', 'D01320260828')
)
UPDATE "Voucher_Codes" AS voucher_code
SET "unique_code" = code_mapping.new_code
FROM code_mapping
WHERE voucher_code."unique_code" = code_mapping.old_code;
