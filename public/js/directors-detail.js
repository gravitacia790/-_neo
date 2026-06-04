function showDirectorDetail(director) {
  var existingOverlay = document.querySelector('.modal-overlay');
  if (existingOverlay) existingOverlay.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });

  var modal = document.createElement('div');
  modal.className = 'modal-content';
  var strengthsHtml = (director.strengthsDetailed || []).map(function (s) {
    var value = s.val != null ? s.val : s.value;
    return '<div class="strength-row"><span class="strength-name">' + escapeHtml(s.name) + '</span><div class="strength-bar"><div class="strength-fill" style="width: ' + (value / 10) * 100 + '%;"></div></div><span class="strength-value">' + value + '</span></div>';
  }).join('');
  var skillsHtml = (director.skillsDetailed || []).map(function (s) {
    return '<div class="skill-item-compact"><span>' + escapeHtml(s.name) + '</span><span class="skill-level">' + escapeHtml(s.level) + '</span></div>';
  }).join('');
  var interestsHtml = (director.personalInterests || []).map(function (i) {
    return '<span class="interest-badge">' + escapeHtml(i) + '</span>';
  }).join('');
  var tagsHtml = (director.tags || []).map(function (t) {
    return '<span class="detail-tag">' + escapeHtml(t) + '</span>';
  }).join('');

  modal.innerHTML =
    '<button class="close-modal">&times;</button>' +
    '<div style="padding: 0 0 10px 0;">' +
    '<div class="card-header" style="margin-bottom: 20px;">' +
    (director.photo ? '<img src="' + escapeAttr(director.photo) + '" class="avatar-img" style="width:70px;height:70px;" alt="Фото">' : '<div class="avatar-placeholder" style="width:70px;height:70px;font-size:28px;">' + escapeHtml(director.name.charAt(0)) + '</div>') +
    '<div class="card-title"><h2 style="margin-bottom:4px;">' + escapeHtml(director.name) + '</h2><div style="display: flex; flex-wrap: wrap; gap: 12px; font-size:0.85rem;">' +
    '<span>🏫 ' + escapeHtml(director.school) + '</span><span>📍 ' + escapeHtml(director.city) + '</span>' +
    (director.isMentor ? '<span class="badge-mentor">✨ Наставник-эксперт</span>' : '') +
    '</div></div></div>' +
    '<div class="info-section"><h3>🤝 Могу быть полезен</h3><div class="info-text">' + escapeHtml(director.useful || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>💡 Хочу узнать / интересует</h3><div class="info-text">' + escapeHtml(director.wantToKnow || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>⭐ Сильные стороны (оценка 1–10)</h3>' + (strengthsHtml || '<div class="info-text">Не указано</div>') + '</div>' +
    '<div class="info-section"><h3>🧠 Профессиональные навыки</h3>' + (skillsHtml || '<div class="info-text">Не указано</div>') + '</div>' +
    '<div class="info-section"><h3>🏆 Уникальный опыт и достижения</h3><div class="info-text">' + escapeHtml(director.uniqueExperience || 'Не указано').replace(/\n/g, '<br>') + '</div></div>' +
    '<div class="info-section"><h3>🎯 Личные интересы и увлечения</h3><div class="interests-line">' + (interestsHtml || '<div class="info-text">Не указано</div>') + '</div></div>' +
    (tagsHtml ? '<div class="tags" style="margin-top: 12px;">' + tagsHtml + '</div>' : '') +
    '<div class="director-actions"><button class="contact-btn" id="contactBtn">💬 Связаться с директором</button></div>' +
    '<hr style="margin:15px 0; border-color:rgba(255,255,255,0.1);">' +
    '<div style="font-size: 0.7rem; text-align: center; color: rgba(255,255,255,0.45);">Гравитация • Московская область • Карточка участника сообщества</div></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.querySelector('.close-modal').addEventListener('click', function () { overlay.remove(); });
  modal.querySelector('#contactBtn').addEventListener('click', function () { showMessageModal(director.id, director.name); });
  bindSwipeBackToClose(overlay, modal);
}

function bindSwipeBackToClose(overlay, modal) {
  if (!overlay || !modal) return;
  if (!window.matchMedia('(max-width: 767px)').matches) return;

  var tracking = false;
  var startX = 0;
  var startY = 0;
  var startAt = 0;

  modal.addEventListener('touchstart', function (e) {
    if (!e.touches || !e.touches.length) return;
    var touch = e.touches[0];
    tracking = true;
    startX = touch.clientX;
    startY = touch.clientY;
    startAt = Date.now();
  }, { passive: true });

  modal.addEventListener('touchend', function (e) {
    if (!tracking || !e.changedTouches || !e.changedTouches.length) return;
    tracking = false;

    var touch = e.changedTouches[0];
    var deltaX = touch.clientX - startX;
    var deltaY = touch.clientY - startY;
    var elapsed = Date.now() - startAt;
    var horizontalEnough = deltaX > 80 && deltaX > Math.abs(deltaY) * 1.35;
    var verticalSmall = Math.abs(deltaY) < 64;
    var fastEnough = elapsed < 1000;

    if (horizontalEnough && verticalSmall && fastEnough) overlay.remove();
  }, { passive: true });

  modal.addEventListener('touchcancel', function () {
    tracking = false;
  }, { passive: true });
}
