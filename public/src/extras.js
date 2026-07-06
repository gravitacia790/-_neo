import { API } from './api.js';
import { openRegistrationModal } from './events-actions.js';
import { confirmDialog, getMaterialTypeLabel, getUiErrorMessage, notify } from './utils.js';
import { html as h } from './html.js';
  var calendarState = {
    month: null,
    year: null,
  };

  function getOpenRegistrationModal() {
    return openRegistrationModal;
  }
  function renderCategory(category, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    Promise.all([
      API.getExtras(category),
      API.getMaterials(category),
    ])
      .then(function (results) {
        var resp = results[0];
        var materials = results[1].materials || [];
        var titleMap = {
          gl: 'Гравитация лидерства',
          internship: 'Стажировка',
          calendar: 'Календарь мероприятий',
        };
        var meId = (API.getUser() || {}).id;
        var cards = resp.items.map(function (event) {
          var regs = event.registrations || [];
          var regList = regs.length
            ? h`<div class="registration-list"><strong>Записавшиеся:</strong><ul>${regs.map(function (r) {
                var canCancel = !!r.canCancel || r.registeredBy === meId;
                return h`<li><span>${r.employeeName}</span><small>${r.schoolName}${r.city ? ' • ' + r.city : ''}${r.phone ? ' • ' + r.phone : ''}</small>${
                  canCancel
                    ? h`<button class="ghost-btn cancel-inline-btn" data-action="cancel-extra-reg" data-category="${category}" data-event-id="${event.id}" data-registration-id="${r.id}">Отменить</button>`
                    : ''
                }</li>`;
              })}</ul></div>`
            : '';
          return h`<div class="new-section-card extra-card" data-id="${event.id}"><h3>${event.title}</h3><p>📅 ${event.date}</p><p>${event.description}</p><button class="save-btn extra-reg-btn" data-action="reg" data-id="${event.id}" data-title="${event.title}">📝 Зарегистрироваться</button>${regList}</div>`;
        });
        container.innerHTML = h`<h2 class="tab-title">${titleMap[category]}</h2>${cards}${buildMaterialsHtml(materials)}`;
        bindMaterialFiltersForContainer(container);
        container.querySelectorAll('[data-action="reg"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var eventId = btn.getAttribute('data-id');
            var title = btn.getAttribute('data-title');
            var openModal = getOpenRegistrationModal();
            if (!openModal) {
              notify('Форма регистрации временно недоступна');
              return;
            }
            openModal({
              onSubmit: function (data) {
                return API.registerForExtra(category, eventId, data);
              },
              successMessage: 'Участник зарегистрирован на "' + title + '"',
              onSuccess: function () {
                renderCategory(category, containerId);
              },
            });
          });
        });
        container.querySelectorAll('[data-action="cancel-extra-reg"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            confirmDialog({
              title: 'Отменить регистрацию?',
              message: 'Участник будет удалён из списка.',
              confirmText: 'Отменить',
            }).then(function (confirmed) {
              if (!confirmed) return;
              API.cancelExtraRegistration(btn.getAttribute('data-category'), btn.getAttribute('data-event-id'), btn.getAttribute('data-registration-id'))
                .then(function () {
                  notify('Регистрация отменена');
                  renderCategory(category, containerId);
                })
                .catch(function (err) {
                  notify(getUiErrorMessage(err, 'Не удалось отменить регистрацию.'));
                });
            });
          });
        });
      })
      .catch(function (err) {
        container.innerHTML = h`<div class="inline-error">Ошибка: ${err.message}</div>`;
      });
  }

  function buildMaterialsHtml(materials) {
    if (!materials || !materials.length) return '';
    var types = Array.from(new Set(materials.map(function (m) { return m.materialType || 'link'; })));
    return h`<div class="materials-section"><div class="section-label">Материалы семинаров</div><div class="material-filter-row"><button class="material-filter-btn active" data-material-filter="">Все</button>${types.map(function (type) {
      return h`<button class="material-filter-btn" data-material-filter="${type}">${getMaterialTypeLabel(type)}</button>`;
    })}</div>${materials.map(function (m) {
      return h`<a class="material-card" data-material-type="${m.materialType || 'link'}" href="${m.url}" target="_blank" rel="noopener"><small class="material-type-badge">${getMaterialTypeLabel(
        m.materialType
      )}</small><strong>${m.title}</strong>${m.description ? h`<span>${m.description}</span>` : ''}</a>`;
    })}</div>`;
  }

  export function renderGL() { renderCategory('gl', 'gl'); }
  export function renderInternship() { renderCategory('internship', 'internship'); }
  export function renderCalendar() {
    var container = document.getElementById('calendar');
    if (!container) return;
    var now = new Date();
    if (calendarState.month === null) calendarState.month = now.getMonth();
    if (calendarState.year === null) calendarState.year = now.getFullYear();
    var year = calendarState.year;
    var month = calendarState.month;
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    Promise.all([
      API.getExtras('calendar').then(function (r) { return r.items; }),
      API.getEvents(1, 100).then(function (r) { return r.events; }),
      API.getMaterials('calendar').then(function (r) { return r.materials || []; }),
    ])
      .then(function (results) {
        var catalogItems = results[0];
        var apiEvents = results[1];
        var materials = results[2];
        var russianMonths = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 };
        var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        var dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        var eventsByDay = {};
        function toIsoDate(value) {
          if (!value) return null;
          var str = String(value).trim().toLowerCase();
          var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
          var ru = str.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
          if (ru) {
            var day = parseInt(ru[1], 10);
            var month = russianMonths[ru[2].toLowerCase()];
            var year = parseInt(ru[3], 10);
            if (!Number.isNaN(day) && !Number.isNaN(year) && month !== undefined) {
              return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            }
          }
          return null;
        }
        function addToDay(key, item) {
          if (!eventsByDay[key]) eventsByDay[key] = [];
          eventsByDay[key].push(item);
        }
        catalogItems.forEach(function (item) {
          var dm = item.date.match(/^(\d+)\s*[–-]?\d*\s*([а-яё]+)/i) || item.date.match(/^(\d+)\s+([а-яё]+)/i);
          if (dm) {
            var d = parseInt(dm[1], 10);
            var mn = russianMonths[dm[2].toLowerCase()];
            if (mn !== undefined) {
              var key = year + '-' + String(mn + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
              addToDay(key, {
                source: 'calendar',
                id: item.id,
                title: item.title,
                desc: item.description,
                dateStr: item.date,
                registrations: item.registrations || [],
              });
            }
          }
        });
        apiEvents.forEach(function (ev) {
          var isoKey = toIsoDate(ev.date);
          if (isoKey) {
            addToDay(isoKey, {
              source: 'published',
              id: ev.id,
              title: ev.title,
              desc: ev.description,
              dateStr: ev.date,
              creator: ev.creator,
              creatorSchool: ev.creatorSchool,
              max: ev.max,
              materials: ev.materials || [],
              registrations: ev.registrations || [],
            });
          }
        });
        var fuzzyItems = catalogItems.filter(function (item) { return !item.date.match(/^\d/); });
        var firstDay = new Date(year, month, 1).getDay();
        var startOffset = firstDay === 0 ? 6 : firstDay - 1;
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        // Каркас сетки календаря — без пользовательских данных (числа, ключи дат). Стили в calendar.css.
        var html = '';
        html += '<h2 class="tab-title">Календарь мероприятий</h2>';
        html += '<div class="cal-header">';
        html += '<button class="cal-nav" data-dir="prev">◀</button>';
        html += '<span class="cal-title">' + monthNames[month] + ' ' + year + '</span>';
        html += '<button class="cal-nav" data-dir="next">▶</button>';
        html += '</div>';
        html += '<div class="cal-weekdays">';
        dayNames.forEach(function (d) { html += '<div class="cal-weekday">' + d + '</div>'; });
        html += '</div><div class="cal-grid">';
        for (var i = 0; i < startOffset; i++) html += '<div></div>';
        for (var day = 1; day <= daysInMonth; day++) {
          var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          var dayEvents = eventsByDay[key] || [];
          var isToday = key === todayStr;
          var hasEvents = dayEvents.length > 0;
          var dw = new Date(year, month, day).getDay();
          var isWeekend = dw === 0 || dw === 6;
          html += '<div class="cal-day' + (isToday ? ' cal-today' : '') + (hasEvents ? ' cal-has-events' : '') + (isWeekend ? ' cal-weekend' : '') + '" data-key="' + key + '">';
          html += '<span>' + day + '</span>';
          if (hasEvents) {
            html += '<div class="cal-dots">';
            var dots = Math.min(dayEvents.length, 3);
            for (var idx = 0; idx < dots; idx++) html += '<div class="cal-dot"></div>';
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
        if (fuzzyItems.length) {
          html += '<div class="cal-fuzzy"><div class="section-label">📌 Постоянные / Периодические</div>';
          fuzzyItems.forEach(function (item) {
            html += h`<div class="new-section-card cal-fuzzy-card"><h3>${item.title}</h3><p>📅 ${item.date}</p><p>${item.description}</p></div>`;
          });
          html += '</div>';
        }
        html += buildMaterialsHtml(materials);
        container.innerHTML = html;
        bindMaterialFiltersForContainer(container);
        container.querySelectorAll('.cal-day.cal-has-events').forEach(function (el) {
          el.addEventListener('click', function () {
            var ek = el.getAttribute('data-key');
            var evts = eventsByDay[ek] || [];
            if (!evts.length) return;
            var cards = evts.map(function (ev) {
              var count = (ev.registrations || []).length;
              var capacity = ev.max ? ' / ' + ev.max : '';
              var isFull = ev.max && count >= Number(ev.max);
              var creator = ev.creator
                ? h`<div class="cal-detail-creator">👤 ${ev.creator}${ev.creatorSchool ? ' • ' + ev.creatorSchool : ''}</div>`
                : '';
              var mats = ev.materials && ev.materials.length
                ? h`<div class="event-materials cal-detail-materials"><strong>Материалы:</strong>${ev.materials.map(function (m) {
                    return h`<a href="${m.url}" target="_blank" rel="noopener"><span class="material-type-badge">${getMaterialTypeLabel(
                      m.materialType
                    )}</span>${m.title}${m.description ? h`<small>${m.description}</small>` : ''}</a>`;
                  })}</div>`
                : '';
              return h`<div class="cal-detail-card"><div class="cal-detail-title">${ev.title}</div><div class="cal-detail-date">📅 ${ev.dateStr}</div>${creator}<div class="cal-detail-desc">${ev.desc}</div>${mats}<div class="cal-detail-count">👥 Записалось: ${count}${capacity}</div>${
                isFull
                  ? h`<button class="save-btn cal-detail-btn" disabled>Регистрация закрыта</button>`
                  : h`<button class="save-btn cal-register-btn cal-detail-btn" data-source="${ev.source}" data-id="${ev.id}" data-title="${ev.title}">📝 Зарегистрироваться</button>`
              }</div>`;
            });
            var md = document.createElement('div');
            md.innerHTML = h`<div class="modal-overlay" id="calDetailModal"><div class="modal-content"><button class="close-modal" id="closeCalDetail">✕</button><h2>📅 ${ek}</h2>${cards}</div></div>`;
            document.body.appendChild(md);
            document.getElementById('closeCalDetail').addEventListener('click', function () { md.remove(); });
            md.addEventListener('click', function (e) { if (e.target === md) md.remove(); });
            md.querySelectorAll('.cal-register-btn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var source = btn.getAttribute('data-source');
                var eventId = btn.getAttribute('data-id');
                var title = btn.getAttribute('data-title');
                md.remove();
                var openModal = getOpenRegistrationModal();
                if (!openModal) {
                  notify('Форма регистрации временно недоступна');
                  return;
                }
                openModal({
                  onSubmit: function (data) {
                    if (source === 'published') return API.registerForEvent(eventId, data);
                    return API.registerForExtra('calendar', eventId, data);
                  },
                  successMessage: 'Участник зарегистрирован на "' + title + '"',
                  onSuccess: function () {
                    renderCalendar();
                  },
                });
              });
            });
          });
        });
        container.querySelectorAll('.cal-nav').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (btn.getAttribute('data-dir') === 'prev') {
              calendarState.month--;
              if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
            } else {
              calendarState.month++;
              if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
            }
            renderCalendar();
          });
        });
      })
      .catch(function (err) {
        container.innerHTML = h`<div class="inline-error">Ошибка: ${err.message}</div>`;
      });
  }

  function bindMaterialFiltersForContainer(container) {
    container.querySelectorAll('.material-filter-row').forEach(function (row) {
      row.querySelectorAll('.material-filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var type = btn.getAttribute('data-material-filter') || '';
          row.querySelectorAll('.material-filter-btn').forEach(function (item) {
            item.classList.toggle('active', item === btn);
          });
          var section = row.closest('.materials-section');
          if (!section) return;
          section.querySelectorAll('.material-card').forEach(function (card) {
            card.hidden = !!type && card.getAttribute('data-material-type') !== type;
          });
        });
      });
    });
  }
