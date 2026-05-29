var pendingPhotoFile = null;

function clearFormErrors(scope) {
  (scope || document).querySelectorAll('.field-error').forEach(function (el) {
    el.classList.remove('field-error');
  });
  (scope || document).querySelectorAll('.field-error-text').forEach(function (el) {
    el.remove();
  });
  (scope || document).querySelectorAll('.form-status-box').forEach(function (el) {
    el.remove();
  });
}

function markFieldInvalid(el, msg) {
  if (!el) return;
  el.classList.add('field-error');
  var div = document.createElement('div');
  div.className = 'field-error-text';
  div.textContent = msg;
  el.insertAdjacentElement('afterend', div);
}

function showFormStatus(container, message, isError) {
  if (!container) return;
  var box = document.createElement('div');
  box.className = 'form-status-box' + (isError ? ' is-error' : '');
  box.textContent = message;
  container.prepend(box);
}

function setButtonBusy(button, busyText, isBusy) {
  if (!button) return;
  if (isBusy) {
    button.dataset.defaultText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    return;
  }
  button.disabled = false;
  if (button.dataset.defaultText) button.textContent = button.dataset.defaultText;
}

function addStrength(name, val) {
  name = name || '';
  val = val == null ? 5 : val;
  var list = document.getElementById('strengthsList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'strength-item';
  div.innerHTML =
    '<input type="text" class="dynamic-input strength-name" placeholder="Например: Стратегическое планирование..." value="' +
    escapeHtml(name) +
    '">' +
    '<input type="range" class="strength-val" min="1" max="10" value="' +
    escapeHtml(String(val)) +
    '">';
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
  var options = ['Начальный', 'Средний', 'Продвинутый', 'Эксперт']
    .map(function (opt) {
      return '<option value="' + opt + '"' + (opt === level ? ' selected' : '') + '>' + opt + '</option>';
    })
    .join('');
  div.innerHTML =
    '<input type="text" class="dynamic-input skill-name" placeholder="Например: Цифровая трансформация..." value="' +
    escapeHtml(name) +
    '">' +
    '<select class="skill-level" style="margin-top: 10px;">' +
    options +
    '</select>';
  list.appendChild(div);
}
window.addSkill = addSkill;

function initPhotoUpload() {
  var fileInput = document.getElementById('directorPhoto');
  if (!fileInput) return;
  fileInput.addEventListener('change', function (e) {
    clearFormErrors(document.getElementById('profile'));
    var file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Выберите изображение');
      fileInput.value = '';
      return;
    }
    if (file.size > 1024 * 1024) {
      notify('Файл слишком большой. Максимум 1 МБ');
      fileInput.value = '';
      return;
    }
    pendingPhotoFile = file;
    var reader = new FileReader();
    reader.onload = function (ev) {
      document.getElementById('photoPreview').innerHTML = '<img src="' + ev.target.result + '" alt="Фото профиля">';
    };
    reader.readAsDataURL(file);
  });
}

function updateProfileRatingDisplay() {
  var container = document.getElementById('ratingDisplay');
  if (!container) return;
  loadMyRating()
    .then(function (data) {
      container.innerHTML =
        '<div class="info-section"><h4>⭐ Мой рейтинг: ' + data.totalScore + ' баллов</h4>' +
        '<div class="checkbox-label" style="margin-top: 8px;"><input type="checkbox" id="ratingPublicToggle" ' +
        (data.public ? 'checked' : '') +
        '><label for="ratingPublicToggle">Рейтинг доступен для всех директоров</label></div>' +
        '<div style="margin-top: 12px;"><strong>История активности:</strong></div>' +
        '<div id="activitiesList">' +
        (data.activities.length
          ? data.activities.map(function (a) {
              return '<div class="activity-item">+' + a.points + ' баллов: ' + escapeHtml(a.description) + '<br><small>' + escapeHtml(a.date) + '</small></div>';
            }).join('')
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
    })
    .catch(function (err) {
      container.innerHTML = '<div style="color:#ff8;">Не удалось загрузить рейтинг: ' + escapeHtml(err.message) + '</div>';
    });
}
