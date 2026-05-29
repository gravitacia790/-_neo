function collectFormData() {
  var strengths = [];
  document.querySelectorAll('.strength-item').forEach(function (item) {
    var n = item.querySelector('.strength-name');
    var v = item.querySelector('.strength-val');
    if (n && v && n.value.trim()) strengths.push({ name: n.value.trim(), val: parseFloat(v.value) || 0 });
  });
  var skills = [];
  document.querySelectorAll('.skill-item').forEach(function (item) {
    var n = item.querySelector('.skill-name');
    var l = item.querySelector('.skill-level');
    if (n && l && n.value.trim()) skills.push({ name: n.value.trim(), level: l.value });
  });
  return {
    phone: document.getElementById('directorPhone').value.trim(),
    experience: document.getElementById('uniqueExperience').value.trim(),
    interests: document.getElementById('personalInterests').value.trim(),
    isMentor: document.getElementById('mentorCheckbox').checked,
    consent: document.getElementById('consentCheckbox').checked,
    strengths: strengths,
    skills: skills,
    city: '',
  };
}

function validateProfileForm() {
  var scope = document.getElementById('profile');
  clearFormErrors(scope);
  var valid = true;
  var phone = document.getElementById('directorPhone');
  if (phone && phone.value.trim() && !/^[\d\s\-+()]{7,20}$/.test(phone.value.trim())) {
    markFieldInvalid(phone, 'Введите корректный номер телефона');
    valid = false;
  }
  var experience = document.getElementById('uniqueExperience');
  if (experience && !experience.value.trim()) {
    markFieldInvalid(experience, 'Опишите ваш профессиональный опыт');
    valid = false;
  }
  var interests = document.getElementById('personalInterests');
  if (interests && !interests.value.trim()) {
    markFieldInvalid(interests, 'Добавьте хотя бы один личный интерес');
    valid = false;
  }
  var strengthNames = document.querySelectorAll('.strength-name');
  var hasStrength = false;
  strengthNames.forEach(function (el) { if (el.value.trim()) hasStrength = true; });
  if (!hasStrength && strengthNames[0]) {
    markFieldInvalid(strengthNames[0], 'Добавьте хотя бы одну сильную сторону');
    valid = false;
  }
  var skillNames = document.querySelectorAll('.skill-name');
  var hasSkill = false;
  skillNames.forEach(function (el) { if (el.value.trim()) hasSkill = true; });
  if (!hasSkill && skillNames[0]) {
    markFieldInvalid(skillNames[0], 'Добавьте хотя бы один профессиональный навык');
    valid = false;
  }
  return valid;
}

function validateSchoolForm() {
  var scope = document.getElementById('school');
  clearFormErrors(scope);
  var valid = true;
  var nameEl = document.getElementById('schoolName');
  if (!nameEl || !nameEl.value.trim()) {
    markFieldInvalid(nameEl, 'Название школы обязательно');
    valid = false;
  }
  var usefulEl = document.getElementById('usefulExperience');
  if (usefulEl && !usefulEl.value.trim()) {
    markFieldInvalid(usefulEl, 'Опишите, чем ваша школа может быть полезна коллегам');
    valid = false;
  }
  var wantEl = document.getElementById('wantToKnow');
  if (wantEl && !wantEl.value.trim()) {
    markFieldInvalid(wantEl, 'Опишите, что вы хотите узнать у коллег');
    valid = false;
  }
  return valid;
}

function saveProfile() {
  if (!validateProfileForm()) return;
  var profileTab = document.getElementById('profile');
  var saveBtn = profileTab ? profileTab.querySelector('button.save-btn') : null;
  var data = collectFormData();
  clearFormErrors(profileTab);
  setButtonBusy(saveBtn, 'Сохранение...', true);
  var doSave = API.saveProfile(data);
  var photoPromise = pendingPhotoFile ? API.uploadPhoto(pendingPhotoFile).then(function () { pendingPhotoFile = null; }) : Promise.resolve();
  Promise.all([doSave, photoPromise])
    .then(function () {
      showFormStatus(profileTab, 'Профиль сохранён. Изменения уже доступны в сообществе.', false);
      return loadUserDataIntoForms();
    })
    .then(function () {
      renderDirectors();
      updateProfileRatingDisplay();
    })
    .catch(function (err) {
      if (err && err.data && Array.isArray(err.data.details)) {
        err.data.details.forEach(function (issue) {
          if (!issue.path || !issue.path[0]) return;
          if (issue.path[0] === 'phone') markFieldInvalid(document.getElementById('directorPhone'), issue.message);
          if (issue.path[0] === 'experience') markFieldInvalid(document.getElementById('uniqueExperience'), issue.message);
          if (issue.path[0] === 'interests') markFieldInvalid(document.getElementById('personalInterests'), issue.message);
        });
      }
      showFormStatus(profileTab, err.message || 'Не удалось сохранить профиль', true);
    })
    .finally(function () { setButtonBusy(saveBtn, '', false); });
}
window.saveProfile = saveProfile;

function saveSchool() {
  if (!validateSchoolForm()) return;
  var schoolTab = document.getElementById('school');
  var saveBtn = document.getElementById('doSaveSchool');
  clearFormErrors(schoolTab);
  setButtonBusy(saveBtn, 'Сохранение...', true);
  var data = {
    name: document.getElementById('schoolName').value.trim(),
    address: document.getElementById('schoolAddress').value.trim(),
    students: parseInt(document.getElementById('studentCount').value, 10) || null,
    teachers: parseInt(document.getElementById('teacherCount').value, 10) || null,
    type: document.getElementById('schoolType').value,
    buildingCount: parseInt(document.getElementById('buildingCount').value, 10) || null,
    usefulExperience: document.getElementById('usefulExperience').value.trim(),
    wantToKnow: document.getElementById('wantToKnow').value.trim(),
  };
  API.saveSchool(data)
    .then(function () {
      showFormStatus(schoolTab, 'Информация о школе сохранена.', false);
      return loadUserDataIntoForms();
    })
    .then(function () {
      renderDirectors();
    })
    .catch(function (err) {
      showFormStatus(schoolTab, err.message || 'Не удалось сохранить информацию о школе', true);
    })
    .finally(function () { setButtonBusy(saveBtn, '', false); });
}
window.saveSchool = saveSchool;
