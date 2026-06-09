ALTER TABLE seminar_materials ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT 'link';

CREATE INDEX IF NOT EXISTS idx_seminar_materials_type ON seminar_materials(material_type, published, created_at DESC);
