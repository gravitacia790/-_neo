const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { addActivity } = require('../rating');
const { reindexDirector } = require('./directorsService');

function loadProfile(userId) {
  const user = db.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').get(userId);
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  const strengths = db.prepare('SELECT name, value FROM profile_strengths WHERE user_id = ?').all(userId);
  const skills = db.prepare('SELECT name, level FROM profile_skills WHERE user_id = ?').all(userId);
  const tags = db.prepare('SELECT tag FROM profile_tags WHERE user_id = ?').all(userId).map((r) => r.tag);
  return {
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    experience: profile.experience || '',
    interests: profile.interests || '',
    isMentor: !!profile.is_mentor,
    consent: !!profile.consent,
    photo: profile.photo || null,
    strengths,
    skills,
    tags,
    city: profile.city || '',
  };
}

function loadSchool(userId) {
  const school = db.prepare('SELECT * FROM schools WHERE user_id = ?').get(userId);
  if (!school) {
    return {
      name: '',
      address: '',
      students: null,
      teachers: null,
      type: '',
      buildingCount: null,
      usefulExperience: '',
      wantToKnow: '',
    };
  }
  return {
    name: school.name || '',
    address: school.address || '',
    students: school.students,
    teachers: school.teachers,
    type: school.type || '',
    buildingCount: school.building_count,
    usefulExperience: school.useful_experience || '',
    wantToKnow: school.want_to_know || '',
  };
}

function saveProfile(userId, profile) {
  if (profile.phone !== undefined) {
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(profile.phone, userId);
  }

  const exists = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(userId);
  const tx = db.transaction(() => {
    if (exists) {
      db.prepare(
        `UPDATE profiles SET experience=?, interests=?, is_mentor=?, consent=?, city=?, updated_at=datetime('now')
         WHERE user_id = ?`
      ).run(profile.experience, profile.interests, profile.isMentor ? 1 : 0, profile.consent ? 1 : 0, profile.city, userId);
    } else {
      db.prepare(
        `INSERT INTO profiles (user_id, experience, interests, is_mentor, consent, city)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, profile.experience, profile.interests, profile.isMentor ? 1 : 0, profile.consent ? 1 : 0, profile.city);
    }

    db.prepare('DELETE FROM profile_strengths WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM profile_skills WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM profile_tags WHERE user_id = ?').run(userId);

    const insertStrength = db.prepare('INSERT INTO profile_strengths (user_id, name, value) VALUES (?, ?, ?)');
    for (const strength of profile.strengths || []) insertStrength.run(userId, strength.name, strength.val);

    const insertSkill = db.prepare('INSERT INTO profile_skills (user_id, name, level) VALUES (?, ?, ?)');
    for (const skill of profile.skills || []) insertSkill.run(userId, skill.name, skill.level);

    const insertTag = db.prepare('INSERT INTO profile_tags (user_id, tag) VALUES (?, ?)');
    for (const tag of profile.tags || []) insertTag.run(userId, tag);
  });
  tx();

  addActivity(userId, 'profile_update', 'Обновил профиль', 5);
  reindexDirector(userId);
  return loadProfile(userId);
}

function saveSchool(userId, school) {
  const exists = db.prepare('SELECT user_id FROM schools WHERE user_id = ?').get(userId);
  if (exists) {
    db.prepare(
      `UPDATE schools SET name=?, address=?, students=?, teachers=?, type=?, building_count=?, useful_experience=?, want_to_know=?
       WHERE user_id = ?`
    ).run(school.name, school.address, school.students, school.teachers, school.type, school.buildingCount, school.usefulExperience, school.wantToKnow, userId);
  } else {
    db.prepare(
      `INSERT INTO schools (user_id, name, address, students, teachers, type, building_count, useful_experience, want_to_know)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, school.name, school.address, school.students, school.teachers, school.type, school.buildingCount, school.usefulExperience, school.wantToKnow);
  }
  reindexDirector(userId);
  return loadSchool(userId);
}

function savePhoto(userId, fileName, uploadDir) {
  const url = '/uploads/' + fileName;
  const old = db.prepare('SELECT photo FROM profiles WHERE user_id = ?').get(userId);
  const exists = !!old;
  if (exists && old.photo && old.photo.startsWith('/uploads/')) {
    const oldPath = path.join(uploadDir, path.basename(old.photo));
    fs.unlink(oldPath, () => {});
  }
  if (exists) {
    db.prepare('UPDATE profiles SET photo = ? WHERE user_id = ?').run(url, userId);
  } else {
    db.prepare('INSERT INTO profiles (user_id, photo) VALUES (?, ?)').run(userId, url);
  }
  reindexDirector(userId);
  return { photo: url };
}

module.exports = { loadProfile, loadSchool, savePhoto, saveProfile, saveSchool };
