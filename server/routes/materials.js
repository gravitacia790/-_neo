const express = require('express');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');

const router = express.Router();

router.get(
  '/',
  authRequired,
  safe('materials')(async (req, res) => {
    const category = (req.query.category || '').toString().trim();
    const eventId = (req.query.eventId || '').toString().trim();
    const materialType = (req.query.type || '').toString().trim();
    const params = [];
    let where = 'WHERE published = 1';
    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }
    if (eventId) {
      where += ' AND event_id = ?';
      params.push(eventId);
    }
    if (materialType) {
      where += ' AND material_type = ?';
      params.push(materialType);
    }
    const stmt = db.prepare(
      `SELECT id, title, description, url, category, material_type, event_id, created_at
       FROM seminar_materials
       ${where}
       ORDER BY created_at DESC`
    );
    const rows = await stmt.all.apply(stmt, params);
    res.json({
      materials: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
        url: r.url,
        category: r.category,
        materialType: r.material_type || 'link',
        eventId: r.event_id || '',
        createdAt: r.created_at,
      })),
    });
  })
);

module.exports = router;
