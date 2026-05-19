var pendingPhotoFile = null;

function updateProfileRatingDisplay() {
  var container = document.getElementById('ratingDisplay');
  if (!container) return;
  loadMyRating().then(function (data) {
    container.innerHTML =
      '<div class="info-section"><h4>⭐ Мой рейтинг: ' + data.totalScore + ' баллов</h4>' +
      '<div class="checkbox-label" style="margin-top: 8px;"><input type="checkbox" id="ratingPublicToggle" ' + (data.public ? 'checked' : '') + '><label for="ratingPublicToggle">Рейтинг доступен для всех директоров</label></div>' +
      '<div style="margin-top: 12px;"><strong>История активности:</strong></div>' +
      '<div id="activitiesList">' +
      (data.activities.length
        ? data.activities.map(function (a) { return '<div class="activity-item">+' + a.points + ' баллов: ' + escapeHtml(a.description) + '<br><small>' + escapeHtml(a.date) + '</small></div>'; }).join('')
        : '<div>Нет активностей</div>') +
      '</div></div>';
    var toggle = document.getElementById('ratingPublicToggle');
    if (toggle) {
      toggle.addEventListener('change', function (e) {
        setRatingPublic(e.target.checked).then(function () {
          updateProfileRatingDisplay();
          renderDirectors();
          renderMentors();
        });
      });
    }
  }).catch(function (err) {
    container.innerHTML = '<div style="color:#ff8;">Не удалось загрузить рейтинг: ' + escapeHtml(err.message) + '</div>';
  });
}

function addStrength(name, val) {
  name = name || '';
  val = val == null ? 5 : val;
  var list = document.getElementById('strengthsList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'strength-item';
  div.innerHTML = '<input type="text" class="dynamic-input strength-name" placeholder="Например: Стратегическое планирование..." value="' + escapeHtml(name) + '">' +
    '<input type="range" class="strength-val" min="1" max="10" value="' + escapeHtml(String(val)) + '">';
  list.appendChild(div);
}
window.addStrength = addStrength;

function addSkill(name, level) {
  name = name || '';
  level = level || 'Средний';
  var list = document.getElementById('skillsList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'skill-item';
  var options = ['Начальный', 'Средний', 'Продвинутый', 'Эксперт'].map(function (opt) {
    return '<option value="' + opt + '"' + (opt === level ? ' selected' : '') + '>' + opt + '</option>';
  }).join('');
  div.innerHTML = '<input type="text" class="dynamic-input skill-name" placeholder="Например: Цифровая трансформация..." value="' + escapeHtml(name) + '">' +
    '<select class="skill-level" style="margin-top: 10px;">' + options + '</select>';
  list.appendChild(div);
}
window.addSkill = addSkill;

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
    phone: document.getElementById('directorPhone').value,
    experience: document.getElementById('uniqueExperience').value,
    interests: document.getElementById('personalInterests').value,
    isMentor: document.getElementById('mentorCheckbox').checked,
    consent: document.getElementById('consentCheckbox').checked,
    strengths: strengths,
    skills: skills,
    city: ''
  };
}

function saveProfile() {
  var data = collectFormData();
  var doSave = API.saveProfile(data);
  var photoPromise = pendingPhotoFile
    ? API.uploadPhoto(pendingPhotoFile).then(function () { pendingPhotoFile = null; })
    : Promise.resolve();
  Promise.all([doSave, photoPromise]).then(function () {
    notify('Профиль сохранён!');
    return loadUserDataIntoForms();
  }).then(function () {
    renderDirectors();
    updateProfileRatingDisplay();
  }).catch(function (err) {
    notify(err.message || 'Ошибка сохранения');
  });
}
window.saveProfile = saveProfile;

function saveSchool() {
  var data = {
    name: document.getElementById('schoolName').value,
    address: document.getElementById('schoolAddress').value,
    students: parseInt(document.getElementById('studentCount').value, 10) || null,
    teachers: parseInt(document.getElementById('teacherCount').value, 10) || null,
    type: document.getElementById('schoolType').value,
    buildingCount: parseInt(document.getElementById('buildingCount').value, 10) || null,
    usefulExperience: document.getElementById('usefulExperience').value,
    wantToKnow: document.getElementById('wantToKnow').value
  };
  API.saveSchool(data).then(function () {
    notify('Информация о школе сохранена!');
    return loadUserDataIntoForms();
  }).then(function () {
    renderDirectors();
  }).catch(function (err) {
    notify(err.message || 'Ошибка');
  });
}
window.saveSchool = saveSchool;

function initPhotoUpload() {
  var fileInput = document.getElementById('directorPhoto');
  if (!fileInput) return;
  fileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Выберите изображение'); fileInput.value = ''; return; }
    if (file.size > 1024 * 1024) { notify('Файл слишком большой. Максимум 1 МБ'); fileInput.value = ''; return; }
    pendingPhotoFile = file;
    var reader = new FileReader();
    reader.onload = function (ev) {
      document.getElementById('photoPreview').innerHTML = '<img src="' + ev.target.result + '" alt="Фото профиля">';
    };
    reader.readAsDataURL(file);
  });
}

function loadUserDataIntoForms() {
  var strengthsDiv = document.getElementById('strengthsList');
  var skillsDiv = document.getElementById('skillsList');
  if (!strengthsDiv || !skillsDiv) return Promise.resolve();

  return API.getProfile().then(function (resp) {
    var profile = resp.profile;
    var school = resp.school;
    setMyProfileCache(profile, school);

    var nameEl = document.getElementById('directorName');
    var emailEl = document.getElementById('directorEmail');
    if (nameEl) { nameEl.value = profile.name || ''; nameEl.disabled = true; }
    if (emailEl) { emailEl.value = profile.email || ''; emailEl.disabled = true; }
    document.getElementById('directorPhone').value = profile.phone || '';
    document.getElementById('uniqueExperience').value = profile.experience || '';
    document.getElementById('personalInterests').value = profile.interests || '';
    document.getElementById('mentorCheckbox').checked = !!profile.isMentor;
    document.getElementById('consentCheckbox').checked = !!profile.consent;
    var photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
      photoPreview.innerHTML = profile.photo ? '<img src="' + escapeHtml(profile.photo) + '" alt="Фото профиля">' : '';
    }
    pendingPhotoFile = null;

    strengthsDiv.innerHTML = '';
    skillsDiv.innerHTML = '';
    if (profile.strengths && profile.strengths.length) {
      profile.strengths.forEach(function (s) { addStrength(s.name, s.val); });
    } else {
      addStrength('Стратегическое планирование', 8);
      addStrength('Управление персоналом', 7);
    }
    if (profile.skills && profile.skills.length) {
      profile.skills.forEach(function (s) { addSkill(s.name, s.level); });
    } else {
      addSkill('Цифровая трансформация', 'Средний');
    }

    document.getElementById('schoolName').value = school.name || '';
    document.getElementById('schoolAddress').value = school.address || '';
    document.getElementById('studentCount').value = school.students || '';
    document.getElementById('teacherCount').value = school.teachers || '';
    document.getElementById('schoolType').value = school.type || 'Средняя общеобразовательная';
    document.getElementById('buildingCount').value = school.buildingCount || '';
    document.getElementById('usefulExperience').value = school.usefulExperience || '';
    document.getElementById('wantToKnow').value = school.wantToKnow || '';

    initPhotoUpload();
  }).catch(function (err) {
    console.error('loadUserDataIntoForms', err);
  });
}
