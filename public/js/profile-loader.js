/* global getUiErrorMessage, retryPromise, isRetriableApiError */
function loadUserDataIntoForms() {
  var strengthsDiv = document.getElementById('strengthsList');
  var skillsDiv = document.getElementById('skillsList');
  if (!strengthsDiv || !skillsDiv) return Promise.resolve();

  return retryPromise(function () {
    return API.getProfile();
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      var profile = resp.profile;
      var school = resp.school;
      setMyProfileCache(profile, school);

      var nameEl = document.getElementById('directorName');
      var emailEl = document.getElementById('directorEmail');
      if (nameEl) {
        nameEl.value = profile.name || '';
        nameEl.disabled = true;
        nameEl.title = 'ФИО изменяется только администратором';
      }
      if (emailEl) {
        emailEl.value = profile.email || '';
        emailEl.disabled = true;
        emailEl.title = 'Email изменяется только администратором';
      }
      document.getElementById('directorPhone').value = profile.phone || '';
      document.getElementById('directorMax').value = profile.telegram || '';
      document.getElementById('uniqueExperience').value = profile.experience || '';
      document.getElementById('personalInterests').value = profile.interests || '';
      document.getElementById('mentorCheckbox').checked = !!profile.isMentor;
      document.getElementById('consentCheckbox').checked = !!profile.consent;

      var photoPreview = document.getElementById('photoPreview');
      if (photoPreview) {
        photoPreview.innerHTML = profile.photo ? '<img src="' + escapeAttr(profile.photo) + '" alt="Фото профиля">' : '';
      }
      pendingPhotoFile = null;

      strengthsDiv.innerHTML = '';
      skillsDiv.innerHTML = '';
      if (profile.strengths && profile.strengths.length) {
        profile.strengths.forEach(function (s) {
          addStrength(s.name, s.val != null ? s.val : s.value);
        });
      } else {
        addStrength('Стратегическое планирование', 8);
        addStrength('Управление персоналом', 7);
      }
      if (profile.skills && profile.skills.length) {
        profile.skills.forEach(function (s) {
          addSkill(s.name, s.level);
        });
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

      var sv = document.getElementById('schoolView');
      if (sv && school.name) {
        sv.style.display = 'block';
        sv.innerHTML =
          '<div class="school-card">' +
          '<div class="school-field"><strong>Название:</strong> ' + escapeHtml(school.name) + '</div>' +
          '<div class="school-field"><strong>Адрес:</strong> ' + escapeHtml(school.address || '—') + '</div>' +
          '<div class="school-field"><strong>Учеников:</strong> ' + (school.students || '—') + '</div>' +
          '<div class="school-field"><strong>Педагогов:</strong> ' + (school.teachers || '—') + '</div>' +
          '<div class="school-field"><strong>Тип:</strong> ' + escapeHtml(school.type || '—') + '</div>' +
          '<div class="school-field"><strong>Зданий:</strong> ' + (school.buildingCount || '—') + '</div>' +
          '<button class="save-btn" id="editSchoolBtn" style="margin-top:12px;">Редактировать</button></div>';
        document.getElementById('schoolForm').style.display = 'none';
        document.getElementById('editSchoolBtn').onclick = function () {
          clearFormErrors(document.getElementById('school'));
          sv.style.display = 'none';
          document.getElementById('schoolForm').style.display = 'block';
        };
      } else if (sv) {
        sv.style.display = 'none';
        document.getElementById('schoolForm').style.display = 'block';
      }

      initPhotoUpload();
    })
    .catch(function (err) {
      console.error('loadUserDataIntoForms', err);
      notify(getUiErrorMessage(err, 'Не удалось загрузить профиль.'));
      throw err;
    });
}
