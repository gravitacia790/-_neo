/* global SHELLDOM, OVERLAY, getUiErrorMessage */
(function () {
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
        var html = '<h2 class="tab-title">' + titleMap[category] + '</h2>';
        var meId = (API.getUser() || {}).id;
        resp.items.forEach(function (event) {
          var regs = event.registrations || [];
          html +=
            '<div class="new-section-card extra-card" data-id="' + escapeHtml(event.id) + '">' +
            '<h3>' + escapeHtml(event.title) + '</h3>' +
            '<p>📅 ' + escapeHtml(event.date) + '</p>' +
            '<p>' + escapeHtml(event.description) + '</p>' +
            '<button class="save-btn" style="margin-top:10px; padding:8px;" data-action="reg" data-id="' + escapeHtml(event.id) + '" data-title="' + escapeHtml(event.title) + '">📝 Зарегистрироваться</button>' +
            (regs.length ? '<div class="registration-list"><strong>Записавшиеся:</strong><ul>' + regs.map(function (r) {
              var canCancel = r.registeredBy === meId;
              return '<li><span>' + escapeHtml(r.employeeName) + '</span><small>' + escapeHtml(r.schoolName) + (r.city ? ' • ' + escapeHtml(r.city) : '') + (r.phone ? ' • ' + escapeHtml(r.phone) : '') + '</small>' +
                (canCancel ? '<button class="ghost-btn cancel-inline-btn" data-action="cancel-extra-reg" data-category="' + escapeAttr(category) + '" data-event-id="' + escapeAttr(event.id) + '" data-registration-id="' + escapeAttr(r.id) + '">Отменить</button>' : '') +
                '</li>';
            }).join('') + '</ul></div>' : '') +
            '</div>';
        });
        html += buildMaterialsHtml(materials);
        container.innerHTML = html;
        bindMaterialFiltersForContainer(container);
        container.querySelectorAll('[data-action="reg"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var eventId = btn.getAttribute('data-id');
            var title = btn.getAttribute('data-title');
            openRegistrationModal({
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
        container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function buildMaterialsHtml(materials) {
    if (!materials || !materials.length) return '';
    var types = Array.from(new Set(materials.map(function (m) { return m.materialType || 'link'; })));
    var html = '<div class="materials-section"><div class="section-label">Материалы семинаров</div>';
    html += '<div class="material-filter-row"><button class="material-filter-btn active" data-material-filter="">Все</button>' +
      types.map(function (type) {
        return '<button class="material-filter-btn" data-material-filter="' + escapeAttr(type) + '">' + escapeHtml(getMaterialTypeLabel(type)) + '</button>';
      }).join('') + '</div>';
    materials.forEach(function (m) {
      html +=
        '<a class="material-card" data-material-type="' + escapeAttr(m.materialType || 'link') + '" href="' + escapeAttr(m.url) + '" target="_blank" rel="noopener">' +
        '<small class="material-type-badge">' + escapeHtml(getMaterialTypeLabel(m.materialType)) + '</small>' +
        '<strong>' + escapeHtml(m.title) + '</strong>' +
        (m.description ? '<span>' + escapeHtml(m.description) + '</span>' : '') +
        '</a>';
    });
    return html + '</div>';
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
        html += buildMaterialsHtml(materials);
        container.innerHTML = html;
        bindMaterialFiltersForContainer(container);
        container.querySelectorAll('.cal-day.cal-has-events').forEach(function (el) {
          el.addEventListener('click', function () {
            var ek = el.getAttribute('data-key');
            var evts = eventsByDay[ek] || [];
            if (!evts.length) return;
            var mh = '<div class="modal-overlay" id="calDetailModal"><div class="modal-content"><button class="close-modal" id="closeCalDetail">✕</button><h2>📅 ' + ek + '</h2>';
            evts.forEach(function (ev) {
              var count = (ev.registrations || []).length;
              var capacity = ev.max ? ' / ' + escapeHtml(ev.max) : '';
              var isFull = ev.max && count >= Number(ev.max);
              var creator = ev.creator ? '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:6px;">👤 ' + escapeHtml(ev.creator) + (ev.creatorSchool ? ' • ' + escapeHtml(ev.creatorSchool) : '') + '</div>' : '';
              var materials = ev.materials && ev.materials.length ? '<div class="event-materials" style="margin-top:10px;"><strong>Материалы:</strong>' + ev.materials.map(function (m) {
                return '<a href="' + escapeAttr(m.url) + '" target="_blank" rel="noopener"><span class="material-type-badge">' + escapeHtml(getMaterialTypeLabel(m.materialType)) + '</span>' + escapeHtml(m.title) + (m.description ? '<small>' + escapeHtml(m.description) + '</small>' : '') + '</a>';
              }).join('') + '</div>' : '';
              mh +=
                '<div style="background:var(--cream);border-radius:12px;padding:14px;margin-bottom:12px;border:1px solid var(--border-faint);">' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--charcoal);margin-bottom:4px;">' + escapeHtml(ev.title) + '</div>' +
                '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">📅 ' + escapeHtml(ev.dateStr) + '</div>' +
                creator +
                '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.4;">' + escapeHtml(ev.desc) + '</div>' +
                materials +
                '<div style="font-size:0.76rem;color:var(--text-muted);margin-top:8px;">👥 Записалось: ' + count + capacity + '</div>' +
                (isFull
                  ? '<button class="save-btn" disabled style="margin-top:12px;padding:9px;">Регистрация закрыта</button>'
                  : '<button class="save-btn cal-register-btn" style="margin-top:12px;padding:9px;" data-source="' + escapeAttr(ev.source) + '" data-id="' + escapeAttr(ev.id) + '" data-title="' + escapeAttr(ev.title) + '">📝 Зарегистрироваться</button>') +
                '</div>';
            });
            mh += '</div></div>';
            var md = document.createElement('div');
            md.innerHTML = mh;
            document.body.appendChild(md);
            document.getElementById('closeCalDetail').addEventListener('click', function () { md.remove(); });
            md.addEventListener('click', function (e) { if (e.target === md) md.remove(); });
            md.querySelectorAll('.cal-register-btn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var source = btn.getAttribute('data-source');
                var eventId = btn.getAttribute('data-id');
                var title = btn.getAttribute('data-title');
                md.remove();
                openRegistrationModal({
                  onSubmit: function (data) {
                    if (source === 'published') return API.registerForEvent(eventId, data);
                    return API.registerForExtra('calendar', eventId, data);
                  },
                  successMessage: 'Участник зарегистрирован на "' + title + '"',
                  onSuccess: function () {
                    window.renderCalendar();
                  },
                });
              });
            });
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
})();
