const express = require('express');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');

const router = express.Router();

function rowToDirector(row, viewer) {
  const strengths = row.strengths ? JSON.parse(row.strengths) : [];
  const skills = row.skills ? JSON.parse(row.skills) : [];
  const tags = row.tags ? JSON.parse(row.tags) : [];
  const city = row.city || (row.address ? (row.address.split(',')[1]?.trim() || row.address) : 'МО');
  const isAdmin = viewer && viewer.role === 'admin';
  const isOwner = viewer && viewer.id === row.id;
  const ratingVisible = isAdmin || isOwner || !!row.is_public;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    school: row.school_name || 'Школа не указана',
    city,
    useful: row.useful_experience || row.experience || '',
    wantToKnow: row.want_to_know || '',
    isMentor: !!row.is_mentor,
    strengthsDetailed: strengths,
    skillsDetailed: skills,
    uniqueExperience: row.experience || '',
    personalInterests: (row.interests || '').split('\n').map(s => s.trim()).filter(Boolean),
    tags,
    photo: row.photo || null,
    rating: ratingVisible ? { totalScore: row.total_score || 0, public: !!row.is_public } : null
  };
}

const SELECT_SQL = `
  SELECT u.id, u.email, u.name, u.role,
         p.experience, p.interests, p.is_mentor, p.photo, p.strengths, p.skills, p.tags, p.city,
         s.name AS school_name, s.address, s.useful_experience, s.want_to_know,
         r.total_score, r.is_public
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN schools s ON s.user_id = u.id
  LEFT JOIN ratings r ON r.user_id = u.id
  WHERE u.role = 'director'
`;

router.get('/', authRequired, (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase().trim();
  const rows = db.prepare(SELECT_SQL + ' ORDER BY u.name').all();
  let directors = rows.map(r => rowToDirector(r, req.user));
  if (q) {
    directors = directors.filter(d => {
      const hay = [
        d.name, d.school, d.city, d.useful, d.wantToKnow, d.uniqueExperience,
        ...(d.personalInterests || []), ...(d.tags || []),
        ...(d.strengthsDetailed || []).map(s => s.name),
        ...(d.skillsDetailed || []).map(s => s.name)
      ].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  res.json({ directors });
});

router.get('/mentors', authRequired, (req, res) => {
  const rows = db.prepare(SELECT_SQL + ' AND p.is_mentor = 1 ORDER BY u.name').all();
  res.json({ mentors: rows.map(r => rowToDirector(r, req.user)) });
});

router.get('/:id', authRequired, (req, res) => {
  const row = db.prepare(SELECT_SQL + ' AND u.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  res.json({ director: rowToDirector(row, req.user) });
});

module.exports = router;
