DROP INDEX IF EXISTS idx_seminar_materials_type;

ALTER TABLE seminar_materials DROP COLUMN IF EXISTS material_type;
