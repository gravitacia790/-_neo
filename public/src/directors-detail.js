import { html, nl2br, setHtml } from './html.js';
import { notify } from './utils.js';
import { API } from './api.js';
export function normalizeMaxLink(rawValue) {
  if (!rawValue) return null;
  var value = String(rawValue).trim();
  if (!value) return null;
  if (/^https?:\/\/max\.ru\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
  if (/^max\.ru\//i.test(value)) return 'https://' + value;
  if (value.charAt(0) === '@') value = value.slice(1);
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(value)) return null;
  return 'https://max.ru/' + value;
}

export function showDirectorDetail(director) {
  var existingOverlay = document.querySelector('.modal-overlay');
  if (existingOverlay) existingOverlay.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });

  var modal = document.createElement('div');
  modal.className = 'modal-content';
  var phoneValue = director.phone ? String(director.phone).trim() : '';
  var phoneHref = phoneValue ? 'tel:' + phoneValue.replace(/[^\d+]/g, '') : '';
  var maxHref = normalizeMaxLink(director.telegram);
  var contacts = [];
  if (phoneHref) {
    contacts.push(html`<button class="contact-btn contact-link" type="button" data-action="call-director" data-phone="${phoneValue}">📞 Позвонить</button>`);
  }
  if (maxHref) {
    contacts.push(html`<a class="detail-btn contact-link" target="_blank" rel="noopener" href="${maxHref}">MAX</a>`);
  }
  if (!phoneValue) {
    contacts.push(
      director.phoneRequestStatus === 'pending'
        ? html`<button class="contact-btn contact-link" type="button" disabled>Запрос отправлен</button>`
        : html`<button class="contact-btn contact-link" type="button" data-action="request-phone-detail">Запросить номер телефона</button>`
    );
  }
  var contactsHtml = contacts.length ? contacts : html`<div class="info-text">Контакты пока не указаны</div>`;

  var notSpecified = html`<div class="info-text">Не указано</div>`;
  var strengths = (director.strengthsDetailed || []).map(function (s) {
    var value = s.val != null ? s.val : s.value;
    return html`<div class="strength-row"><span class="strength-name">${s.name}</span><div class="strength-bar"><div class="strength-fill" style="width: ${(value / 10) * 100}%;"></div></div><span class="strength-value">${value}</span></div>`;
  });
  var skills = (director.skillsDetailed || []).map(function (s) {
    return html`<div class="skill-item-compact"><span>${s.name}</span><span class="skill-level">${s.level}</span></div>`;
  });
  var interests = (director.personalInterests || []).map(function (i) {
    return html`<span class="interest-badge">${i}</span>`;
  });
  var tags = (director.tags || []).map(function (t) {
    return html`<span class="detail-tag">${t}</span>`;
  });

  var avatar = director.photo
    ? html`<img src="${director.photo}" class="avatar-img avatar-img--lg" alt="Фото">`
    : html`<div class="avatar-placeholder avatar-placeholder--lg">${director.name.charAt(0)}</div>`;

  setHtml(
    modal,
    html`<button class="close-modal">&times;</button>
    <div class="director-detail">
      <div class="card-header director-detail__header">${avatar}<div class="card-title"><h2 class="director-detail__name">${director.name}</h2><div class="director-detail__meta"><span>🏫 ${director.school}</span><span>📍 ${director.city}</span>${
        director.isMentor ? html`<span class="badge-mentor">✨ Наставник-эксперт</span>` : ''
      }</div></div></div>
      <div class="info-section"><h3>🤝 Могу быть полезен</h3><div class="info-text">${nl2br(director.useful || 'Не указано')}</div></div>
      <div class="info-section"><h3>💡 Хочу узнать / интересует</h3><div class="info-text">${nl2br(director.wantToKnow || 'Не указано')}</div></div>
      <div class="info-section"><h3>⭐ Сильные стороны (оценка 1–10)</h3>${strengths.length ? strengths : notSpecified}</div>
      <div class="info-section"><h3>🧠 Профессиональные навыки</h3>${skills.length ? skills : notSpecified}</div>
      <div class="info-section"><h3>🏆 Уникальный опыт и достижения</h3><div class="info-text">${nl2br(director.uniqueExperience || 'Не указано')}</div></div>
      <div class="info-section"><h3>🎯 Личные интересы и увлечения</h3><div class="interests-line">${interests.length ? interests : notSpecified}</div></div>
      ${tags.length ? html`<div class="tags director-detail__tags">${tags}</div>` : ''}
      <div class="director-actions">${contactsHtml}</div>
      <hr class="director-detail__divider">
      <div class="director-detail__footer">Гравитация • Московская область • Карточка участника сообщества</div>
    </div>`
  );

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.querySelector('.close-modal').addEventListener('click', function () { overlay.remove(); });
  var callBtn = modal.querySelector('[data-action="call-director"]');
  if (callBtn) {
    callBtn.addEventListener('click', function () {
      var dialValue = phoneValue.replace(/[^\d+]/g, '');
      if (!dialValue) return;

      window.location.href = 'tel:' + dialValue;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phoneValue).then(function () {
          notify('Номер скопирован: ' + phoneValue);
        }).catch(function () {
          notify('Номер: ' + phoneValue);
        });
      } else {
        notify('Номер: ' + phoneValue);
      }
    });
  }
  var requestPhoneBtn = modal.querySelector('[data-action="request-phone-detail"]');
  if (requestPhoneBtn) {
    requestPhoneBtn.addEventListener('click', function () {
      requestPhoneBtn.disabled = true;
      API.requestPhoneNumber(director.id)
        .then(function (result) {
          if (result.status === 'approved') {
            notify('Номер уже доступен. Обновите список директоров.');
          } else {
            notify('Запрос отправлен. Директор получит уведомление.');
          }
        })
        .catch(function (err) {
          requestPhoneBtn.disabled = false;
          notify(err.message || 'Не удалось отправить запрос на номер');
        });
    });
  }
  bindSwipeBackToClose(overlay, modal);
}

export function bindSwipeBackToClose(overlay, modal) {
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
