function renderEvents() {
  var container = document.getElementById('eventsList');
  if (!container) return;
  container.innerHTML = '<div>Загрузка...</div>';
  API.getEvents().then(function (resp) {
    var events = resp.events;
    if (!events.length) {
      container.innerHTML = '<div style="text-align:center; padding:20px;">Нет мероприятий. Создайте первое!</div>';
      return;
    }
    var meId = (API.getUser() || {}).id;
    var html = '';
    events.forEach(function (ev) {
      var isCreator = (ev.creatorId === meId);
      html += '<div class="event-card" data-id="' + ev.id + '">' +
        '<h3>' + escapeHtml(ev.title) + '</h3>' +
        '<div class="date">📅 ' + escapeHtml(ev.date) + '</div>' +
        '<p>' + escapeHtml(ev.description) + '</p>' +
        '<div>👥 Записалось: ' + ev.registrations.length + ' / ' + ev.max + '</div>' +
        '<div>👤 Организатор: ' + escapeHtml(ev.creator) + ' (' + escapeHtml(ev.creatorSchool) + ')</div>';
      if (ev.registrations.length) {
        html += '<div><strong>Записавшиеся:</strong><ul>' + ev.registrations.map(function (r) {
          return '<li>' + escapeHtml(r.employeeName) + ' (' + escapeHtml(r.position) + ') — ' + escapeHtml(r.schoolName) + '</li>';
        }).join('') + '</ul></div>';
      }
      html += '<div style="margin-top:12px;">';
      if (!isCreator) html += '<button data-action="reg" data-id="' + ev.id + '">📝 Записать сотрудника</button>';
      if (isCreator) html += '<button data-action="del" data-id="' + ev.id + '" style="background:#ff4757;">🗑 Удалить</button>';
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-action="reg"]').forEach(function (btn) {
      btn.addEventListener('click', function () { promptAndRegister(btn.getAttribute('data-id')); });
    });
    container.querySelectorAll('[data-action="del"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Удалить?')) return;
        API.deleteEvent(btn.getAttribute('data-id')).then(renderEvents).catch(function (err) {
          notify(err.message || 'Ошибка');
        });
      });
    });
  }).catch(function (err) {
    container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
  });
}

function promptAndRegister(eventId) {
  var employeeName = prompt('ФИО сотрудника:'); if (!employeeName) return;
  var position = prompt('Должность:'); if (!position) return;
  var school = prompt('От какой школы?', getCurrentSchoolName()); if (!school) return;
  API.registerForEvent(eventId, { employeeName: employeeName, position: position, schoolName: school })
    .then(function () {
      notify('Сотрудник ' + employeeName + ' записан');
      renderEvents();
    })
    .catch(function (err) { notify(err.message || 'Ошибка'); });
}

function bindCreateEvent() {
  var btn = document.getElementById('createEventBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var title = document.getElementById('eventTitle').value.trim();
    var date = document.getElementById('eventDate').value.trim();
    var desc = document.getElementById('eventDesc').value.trim();
    var max = parseInt(document.getElementById('eventMax').value, 10) || 999;
    var isSpeaker = document.getElementById('eventSpeakerCheckbox').checked;
    if (!title || !date || !desc) { notify('Заполните все поля'); return; }
    API.createEvent({ title: title, date: date, description: desc, max: max, isSpeaker: isSpeaker })
      .then(function () {
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventDesc').value = '';
        document.getElementById('eventMax').value = '';
        document.getElementById('eventSpeakerCheckbox').checked = false;
        renderEvents();
      })
      .catch(function (err) { notify(err.message || 'Ошибка создания'); });
  });
}
