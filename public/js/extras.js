/* global SHELLDOM, OVERLAY */
(function () {
  function renderCategory(category, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    API.getExtras(category)
      .then(function (resp) {
        var titleMap = {
          gl: 'Гравитация лидерства',
          internship: 'Стажировка',
          calendar: 'Календарь мероприятий',
        };
        var html = '<h2 class="tab-title">' + titleMap[category] + '</h2>';
        resp.items.forEach(function (event) {
          var regs = event.registrations || [];
          html +=
            '<div class="new-section-card extra-card" data-id="' + escapeHtml(event.id) + '">' +
            '<h3>' + escapeHtml(event.title) + '</h3>' +
            '<p>📅 ' + escapeHtml(event.date) + '</p>' +
            '<p>' + escapeHtml(event.description) + '</p>' +
            '<button class="save-btn" style="margin-top:10px; padding:8px;" data-action="reg" data-id="' + escapeHtml(event.id) + '" data-title="' + escapeHtml(event.title) + '">📝 Зарегистрироваться</button>' +
            (regs.length ? '<div style="margin-top:12px;"><strong>Записавшиеся:</strong><ul>' + regs.map(function (r) {
              return '<li>' + escapeHtml(r.employeeName) + ' (' + escapeHtml(r.position) + ') — ' + escapeHtml(r.schoolName) + '</li>';
            }).join('') + '</ul></div>' : '') +
            '</div>';
        });
        container.innerHTML = html;
        container.querySelectorAll('[data-action="reg"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var eventId = btn.getAttribute('data-id');
            var title = btn.getAttribute('data-title');
            var user = API.getUser() || {};
            var employeeName = prompt('ФИО сотрудника:', user.name || '');
            if (!employeeName) return;
            var position = prompt('Должность:', 'Директор');
            if (!position) return;
            var school = prompt('От какой школы?', getCurrentSchoolName());
            if (!school) return;
            API.registerForExtra(category, eventId, {
              employeeName: employeeName,
              position: position,
              schoolName: school,
            })
              .then(function () {
                notify('Сотрудник ' + employeeName + ' успешно зарегистрирован на "' + title + '"');
                renderCategory(category, containerId);
              })
              .catch(function (err) {
                notify(err.message || 'Ошибка');
              });
          });
        });
      })
      .catch(function (err) {
        container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
      });
  }

  window.renderGL = function () { renderCategory('gl', 'gl'); };
  window.renderInternship = function () { renderCategory('internship', 'internship'); };
  window.renderCalendar = function () {
    var container = document.getElementById('calendar');
    if (!container) return;
    var now = new Date();
    if (window._calMonth === undefined) window._calMonth = now.getMonth();
    if (window._calYear === undefined) window._calYear = now.getFullYear();
    var year = window._calYear;
    var month = window._calMonth;
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    Promise.all([
      API.getExtras('calendar').then(function (r) { return r.items; }),
      API.getEvents().then(function (r) { return r.events; }),
    ])
      .then(function (results) {
        var catalogItems = results[0];
        var apiEvents = results[1];
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
        function addToDay(key, title, desc, dateStr) {
          if (!eventsByDay[key]) eventsByDay[key] = [];
          eventsByDay[key].push({ title: title, desc: desc, dateStr: dateStr });
        }
        catalogItems.forEach(function (item) {
          var dm = item.date.match(/^(\d+)\s*[–-]?\d*\s*([а-яё]+)/i) || item.date.match(/^(\d+)\s+([а-яё]+)/i);
          if (dm) {
            var d = parseInt(dm[1], 10);
            var mn = russianMonths[dm[2].toLowerCase()];
            if (mn !== undefined) {
              var key = year + '-' + String(mn + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
              addToDay(key, item.title, item.description, item.date);
            }
          }
        });
        apiEvents.forEach(function (ev) {
          var isoKey = toIsoDate(ev.date);
          if (isoKey) addToDay(isoKey, ev.title, ev.description, ev.date);
        });
        var fuzzyItems = catalogItems.filter(function (item) { return !item.date.match(/^\d/); });
        var firstDay = new Date(year, month, 1).getDay();
        var startOffset = firstDay === 0 ? 6 : firstDay - 1;
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        var html = '';
        html += '<style>.cal-day{cursor:default;transition:background 0.2s,color 0.2s;}.cal-day:hover:not(.cal-today){background:var(--crimson-mist)!important;}.cal-today:hover{background:var(--crimson-dark)!important;}.cal-nav{transition:all 0.2s;}.cal-nav:hover{background:var(--crimson-mist)!important;border-color:var(--crimson)!important;color:var(--crimson)!important;}</style>';
        html += '<h2 class="tab-title">Календарь мероприятий</h2>';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
        html += '<button class="cal-nav" data-dir="prev" style="background:var(--white);border:1.5px solid var(--border-light);color:var(--text-secondary);padding:8px 16px;border-radius:40px;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:Manrope,sans-serif;">◀</button>';
        html += '<span style="font-family:\'Playfair Display\',Georgia,serif;font-size:1.2rem;font-weight:700;color:var(--charcoal);">' + monthNames[month] + ' ' + year + '</span>';
        html += '<button class="cal-nav" data-dir="next" style="background:var(--white);border:1.5px solid var(--border-light);color:var(--text-secondary);padding:8px 16px;border-radius:40px;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:Manrope,sans-serif;">▶</button>';
        html += '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">';
        dayNames.forEach(function (d) { html += '<div style="text-align:center;font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;padding:6px 0;">' + d + '</div>'; });
        html += '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
        for (var i = 0; i < startOffset; i++) html += '<div></div>';
        for (var day = 1; day <= daysInMonth; day++) {
          var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          var dayEvents = eventsByDay[key] || [];
          var isToday = key === todayStr;
          var hasEvents = dayEvents.length > 0;
          var dw = new Date(year, month, day).getDay();
          var isWeekend = dw === 0 || dw === 6;
          var bg = isToday ? 'var(--crimson)' : 'transparent';
          var color = isToday ? '#fff' : 'var(--text-primary)';
          var fw = isToday ? '700' : '400';
          var cur = hasEvents ? 'pointer' : 'default';
          html += '<div class="cal-day' + (isToday ? ' cal-today' : '') + (hasEvents ? ' cal-has-events' : '') + (isWeekend ? ' cal-weekend' : '') + '" data-key="' + key + '" style="position:relative;text-align:center;padding:8px 0;border-radius:12px;cursor:' + cur + ';background:' + bg + ';color:' + color + ';font-weight:' + fw + ';font-size:0.85rem;">';
          html += '<span>' + day + '</span>';
          if (hasEvents) {
            html += '<div style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);display:flex;gap:3px;">';
            var dots = Math.min(dayEvents.length, 3);
            for (var idx = 0; idx < dots; idx++) html += '<div style="width:5px;height:5px;border-radius:50%;background:' + (isToday ? 'rgba(255,255,255,0.8)' : 'var(--crimson)') + ';"></div>';
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
        if (fuzzyItems.length) {
          html += '<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border-faint);"><div class="section-label">📌 Постоянные / Периодические</div>';
          fuzzyItems.forEach(function (item) {
            html += '<div class="new-section-card" style="background:var(--white);border:1px solid var(--border-faint);border-radius:12px;padding:16px;margin-bottom:12px;border-left:3px solid var(--crimson);box-shadow:var(--shadow-sm);"><h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:1rem;margin-bottom:8px;color:var(--charcoal);">' + escapeHtml(item.title) + '</h3><p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">📅 ' + escapeHtml(item.date) + '</p><p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">' + escapeHtml(item.description) + '</p></div>';
          });
          html += '</div>';
        }
        container.innerHTML = html;
        container.querySelectorAll('.cal-day.cal-has-events').forEach(function (el) {
          el.addEventListener('click', function () {
            var ek = el.getAttribute('data-key');
            var evts = eventsByDay[ek] || [];
            if (!evts.length) return;
            var mh = '<div class="modal-overlay" id="calDetailModal"><div class="modal-content"><button class="close-modal" id="closeCalDetail">✕</button><h2>📅 ' + ek + '</h2>';
            evts.forEach(function (ev) {
              mh += '<div style="background:var(--cream);border-radius:12px;padding:14px;margin-bottom:12px;border:1px solid var(--border-faint);"><div style="font-weight:700;font-size:0.9rem;color:var(--charcoal);margin-bottom:4px;">' + escapeHtml(ev.title) + '</div><div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">📅 ' + escapeHtml(ev.dateStr) + '</div><div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.4;">' + escapeHtml(ev.desc) + '</div></div>';
            });
            mh += '</div></div>';
            var md = document.createElement('div');
            md.innerHTML = mh;
            document.body.appendChild(md);
            document.getElementById('closeCalDetail').addEventListener('click', function () { md.remove(); });
            md.addEventListener('click', function (e) { if (e.target === md) md.remove(); });
          });
        });
        container.querySelectorAll('.cal-nav').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (btn.getAttribute('data-dir') === 'prev') {
              window._calMonth--;
              if (window._calMonth < 0) { window._calMonth = 11; window._calYear--; }
            } else {
              window._calMonth++;
              if (window._calMonth > 11) { window._calMonth = 0; window._calYear++; }
            }
            window.renderCalendar();
          });
        });
      })
      .catch(function (err) {
        container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
      });
  };
})();
