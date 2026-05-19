(function () {
  function renderCategory(category, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div>Загрузка...</div>';
    API.getExtras(category).then(function (resp) {
      var titleMap = { gl: '⭐ Гравитация лидерства', internship: '🎓 Стажировка', calendar: '📅 Календарь мероприятий' };
      var html = '<h2>' + titleMap[category] + '</h2>';
      resp.items.forEach(function (event) {
        var regs = event.registrations || [];
        html += '<div class="new-section-card" data-id="' + escapeHtml(event.id) + '">' +
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
          var employeeName = prompt('ФИО сотрудника:', user.name || ''); if (!employeeName) return;
          var position = prompt('Должность:', 'Директор'); if (!position) return;
          var school = prompt('От какой школы?', getCurrentSchoolName()); if (!school) return;
          API.registerForExtra(category, eventId, { employeeName: employeeName, position: position, schoolName: school })
            .then(function () {
              notify('Сотрудник ' + employeeName + ' успешно зарегистрирован на "' + title + '"');
              renderCategory(category, containerId);
            })
            .catch(function (err) { notify(err.message || 'Ошибка'); });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
    });
  }

  window.renderGL = function () { renderCategory('gl', 'gl'); };
  window.renderInternship = function () { renderCategory('internship', 'internship'); };
  window.renderCalendar = function () { renderCategory('calendar', 'calendar'); };
})();
