var currentSearchTerm = '';
var __searchTimer = null;

function renderDirectors() {
  var container = document.getElementById('directorsList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:20px;">Загрузка...</div>';
  API.getDirectors(currentSearchTerm).then(function (resp) {
    directorsCache = resp.directors;
    if (!directorsCache.length) { container.innerHTML = '<div>Ничего не найдено</div>'; return; }
    var html = '';
    directorsCache.forEach(function (d) {
      var avatarHtml = d.photo
        ? '<img src="' + escapeHtml(d.photo) + '" class="avatar-img" alt="Фото">'
        : '<div class="avatar-placeholder">' + escapeHtml(d.name.charAt(0)) + '</div>';
      var ratingHtml = d.rating
        ? '<div class="rating-badge">⭐ Рейтинг: ' + d.rating.totalScore + ' баллов</div>'
        : '';
      var allTags = [].concat(
        (d.strengthsDetailed || []).map(function (s) { return s.name; }),
        (d.skillsDetailed || []).map(function (s) { return s.name; })
      ).slice(0, 5);
      html += '<div class="director-card" data-id="' + d.id + '">' +
        '<div class="card-header">' + avatarHtml +
        '<div class="card-title"><h3>' + escapeHtml(d.name) + '</h3>' +
        '<p>🏫 ' + escapeHtml(d.school) + ' • ' + escapeHtml(d.city) +
        (d.isMentor ? ' <span class="badge-mentor">✨ Наставник</span>' : '') + '</p>' + ratingHtml +
        '</div></div>' +
        '<div class="info-section"><h4>🤝 Могу быть полезен</h4><p>' + escapeHtml(d.useful) + '</p></div>' +
        '<div class="info-section"><h4>💡 Хочу узнать</h4><p>' + escapeHtml(d.wantToKnow) + '</p></div>' +
        (allTags.length ? '<div class="tags">' + allTags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
        '<button class="contact-btn" data-action="contact" data-name="' + escapeHtml(d.name) + '">💬 Связаться</button>' +
        '<button class="detail-btn" data-action="detail" data-id="' + d.id + '">📖 Подробнее</button>' +
        '</div>';
    });
    container.innerHTML = html;
    // Делегирование событий
    container.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var d = directorsCache.find(function (x) { return String(x.id) === String(id); });
        if (d) showDirectorDetail(d);
      });
    });
    container.querySelectorAll('[data-action="contact"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        notify('Связаться с ' + btn.getAttribute('data-name') + ' можно через платформу (функция в разработке)');
      });
    });
  }).catch(function (err) {
    container.innerHTML = '<div style="color:#ff8;">Ошибка загрузки: ' + escapeHtml(err.message) + '</div>';
  });
}

function showDirectorDetail(director) {
  var existingOverlay = document.querySelector('.modal-overlay');
  if (existingOverlay) existingOverlay.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

  var modal = document.createElement('div');
  modal.className = 'modal-content';

  var strengthsHtml = (director.strengthsDetailed || []).map(function (s) {
    return '<div class="strength-row"><span class="strength-name">' + escapeHtml(s.name) + '</span><div class="strength-bar"><div class="strength-fill" style="width: ' + ((s.val / 10) * 100) + '%;"></div></div><span class="strength-value">' + s.val + '</span></div>';
  }).join('');

  var skillsHtml = (director.skillsDetailed || []).map(function (s) {
    return '<div class="skill-item-compact"><span>' + escapeHtml(s.name) + '</span><span class="skill-level">' + escapeHtml(s.level) + '</span></div>';
  }).join('');

  var interestsHtml = (director.personalInterests || []).map(function (i) { return '<span class="interest-badge">' + escapeHtml(i) + '</span>'; }).join('');
  var tagsHtml = (director.tags || []).map(function (t) { return '<span class="detail-tag">' + escapeHtml(t) + '</span>'; }).join('');

  modal.innerHTML =
    '<button class="close-modal">&times;</button>' +
    '<div style="padding: 0 0 10px 0;">' +
    '<div class="card-header" style="margin-bottom: 20px;">' +
    (director.photo
      ? '<img src="' + escapeHtml(director.photo) + '" class="avatar-img" style="width:70px;height:70px;" alt="Фото">'
      : '<div class="avatar-placeholder" style="width:70px;height:70px;font-size:28px;">' + escapeHtml(director.name.charAt(0)) + '</div>') +
    '<div class="card-title"><h2 style="margin-bottom:4px;">' + escapeHtml(director.name) + '</h2>' +
    '<div style="display: flex; flex-wrap: wrap; gap: 12px; font-size:0.85rem;">' +
    '<span>🏫 ' + escapeHtml(director.school) + '</span>' +
    '<span>📍 ' + escapeHtml(director.city) + '</span>' +
    (director.isMentor ? '<span class="badge-mentor">✨ Наставник-эксперт</span>' : '') +
    '</div></div></div>' +
    '<div class="info-section"><h3>🤝 Могу быть полезен</h3><div class="info-text">' + escapeHtml(director.useful || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>💡 Хочу узнать / интересует</h3><div class="info-text">' + escapeHtml(director.wantToKnow || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>⭐ Сильные стороны (оценка 1–10)</h3>' + (strengthsHtml || '<div class="info-text">Не указано</div>') + '</div>' +
    '<div class="info-section"><h3>🧠 Профессиональные навыки</h3>' + (skillsHtml || '<div class="info-text">Не указано</div>') + '</div>' +
    '<div class="info-section"><h3>🏆 Уникальный опыт и достижения</h3><div class="info-text">' + escapeHtml(director.uniqueExperience || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>🎯 Личные интересы и увлечения</h3><div class="interests-line">' + (interestsHtml || '<div class="info-text">Не указано</div>') + '</div></div>' +
    (tagsHtml ? '<div class="tags" style="margin-top: 12px;">' + tagsHtml + '</div>' : '') +
    '<button class="contact-btn" id="contactBtn">💬 Связаться с директором</button>' +
    '<hr style="margin:15px 0; border-color:rgba(255,255,255,0.1);">' +
    '<div style="font-size: 0.7rem; text-align: center; color: rgba(255,255,255,0.45);">Гравитация • Московская область • Карточка участника сообщества</div></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.querySelector('.close-modal').addEventListener('click', function () { overlay.remove(); });
  modal.querySelector('#contactBtn').addEventListener('click', function () {
    notify('Связаться с ' + director.name + ' можно через платформу (функция в разработке)');
  });
}

function renderMentors() {
  var container = document.getElementById('mentorsList');
  if (!container) return;
  container.innerHTML = '<div>Загрузка...</div>';
  API.getMentors().then(function (resp) {
    mentorsCache = resp.mentors;
    container.innerHTML = mentorsCache.map(function (m) {
      var ratingHtml = m.rating
        ? '<span class="rating-badge" style="margin-left:8px;">⭐ ' + m.rating.totalScore + '</span>'
        : '';
      return '<div style="background:rgba(255,255,255,0.1); border-radius:15px; padding:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">' +
        '<div><strong>' + escapeHtml(m.name) + '</strong><div>' + escapeHtml(m.school) + '</div><div>' + escapeHtml(m.useful) + '</div></div>' +
        '<div>' + ratingHtml + '<span style="background:#00c6ff; padding:5px 10px; border-radius:20px; margin-left:8px;">Наставник</span></div></div>';
    }).join('') || '<div>Пока нет наставников</div>';
  }).catch(function (err) {
    container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
  });
}

function bindDirectorSearch() {
  var input = document.getElementById('directorSearchInput');
  if (!input) return;
  input.addEventListener('input', function (e) {
    currentSearchTerm = e.target.value;
    if (__searchTimer) clearTimeout(__searchTimer);
    __searchTimer = setTimeout(renderDirectors, 250);
  });
}
