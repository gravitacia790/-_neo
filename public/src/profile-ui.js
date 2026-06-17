import { renderDirectors } from './directors.js';
import { loadMyRating, setRatingPublic } from './rating.js';
import { notify } from './utils.js';
import { html, setHtml } from './html.js';
let pendingPhotoFile = null;
export function getPendingPhotoFile() {
  return pendingPhotoFile;
}
export function setPendingPhotoFile(file) {
  pendingPhotoFile = file || null;
}

export function requestDirectorsRefresh() {
  renderDirectors();
}

export function clearFormErrors(scope) {
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

export function markFieldInvalid(el, msg) {
  if (!el) return;
  el.classList.add('field-error');
  var div = document.createElement('div');
  div.className = 'field-error-text';
  div.textContent = msg;
  el.insertAdjacentElement('afterend', div);
}

export function showFormStatus(container, message, isError) {
  if (!container) return;
  var box = document.createElement('div');
  box.className = 'form-status-box' + (isError ? ' is-error' : '');
  box.textContent = message;
  container.prepend(box);
}

export function setButtonBusy(button, busyText, isBusy) {
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

export function addStrength(name, val) {
  name = name || '';
  val = val == null ? 5 : val;
  var list = document.getElementById('strengthsList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'strength-item';
  var scale = [];
  for (var i = 1; i <= 10; i++) {
    scale.push(html`<span>${i}</span>`);
  }
  setHtml(
    div,
    html`<input type="text" class="dynamic-input strength-name" placeholder="Например: Стратегическое планирование..." value="${name}"><div class="strength-slider-head"><span>Оценка</span><strong class="strength-current-value">${String(val)}</strong></div><input type="range" class="strength-val" min="1" max="10" step="0.5" value="${String(val)}"><div class="strength-scale" aria-hidden="true">${scale}</div>`
  );
  list.appendChild(div);
  var input = div.querySelector('.strength-val');
  var value = div.querySelector('.strength-current-value');
  if (input && value) {
    input.addEventListener('input', function () {
      value.textContent = input.value;
    });
  }
}

export function addSkill(name, level) {
  name = name || '';
  level = level || 'Средний';
  var list = document.getElementById('skillsList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'skill-item';
  var options = ['Начальный', 'Средний', 'Продвинутый', 'Эксперт'].map(function (opt) {
    return html`<option value="${opt}"${opt === level ? ' selected' : ''}>${opt}</option>`;
  });
  setHtml(
    div,
    html`<input type="text" class="dynamic-input skill-name" placeholder="Например: Цифровая трансформация..." value="${name}"><select class="skill-level" style="margin-top: 10px;">${options}</select>`
  );
  list.appendChild(div);
}

export function initPhotoUpload() {
  var fileInput = document.getElementById('directorPhoto');
  if (!fileInput) return;
  if (fileInput.dataset.bound === 'true') return;
  fileInput.dataset.bound = 'true';
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
      setHtml(document.getElementById('photoPreview'), html`<img src="${ev.target.result}" alt="Фото профиля">`);
    };
    reader.readAsDataURL(file);
  });
}

export function updateProfileRatingDisplay() {
  var container = document.getElementById('ratingDisplay');
  if (!container) return;
  loadMyRating()
    .then(function (data) {
      var acts = data.activities.length
        ? data.activities.map(function (a) {
            return html`<div class="activity-item">+${a.points} баллов: ${a.description}<br><small>${a.date}</small></div>`;
          })
        : html`<div>Нет активностей</div>`;
      setHtml(
        container,
        html`<div class="info-section"><h4>⭐ Мой рейтинг: ${data.totalScore} баллов</h4><div class="checkbox-label" style="margin-top: 8px;"><input type="checkbox" id="ratingPublicToggle"${data.public ? ' checked' : ''}><label for="ratingPublicToggle">Рейтинг доступен для всех директоров</label></div><div style="margin-top: 12px;"><strong>История активности:</strong></div><div id="activitiesList">${acts}</div></div>`
      );
      var toggle = document.getElementById('ratingPublicToggle');
      if (toggle) {
        if (toggle.dataset.bound === 'true') return;
        toggle.dataset.bound = 'true';
        toggle.addEventListener('change', function (e) {
          setRatingPublic(e.target.checked).then(function () {
            updateProfileRatingDisplay();
            requestDirectorsRefresh();
          });
        });
      }
    })
    .catch(function (err) {
      setHtml(container, html`<div style="color:#ff8;">Не удалось загрузить рейтинг: ${err.message}</div>`);
    });
}
