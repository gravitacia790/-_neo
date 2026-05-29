function promptAndRegister(eventId) {
  var employeeName = prompt('ФИО сотрудника:');
  if (!employeeName) return;
  var position = prompt('Должность:');
  if (!position) return;
  var school = prompt('От какой школы?', getCurrentSchoolName());
  if (!school) return;
  API.registerForEvent(eventId, { employeeName: employeeName, position: position, schoolName: school })
    .then(function () {
      notify('Сотрудник ' + employeeName + ' записан');
      renderEvents();
    })
    .catch(function (err) {
      notify(err.message || 'Ошибка');
    });
}

function bindEventListActions(container) {
  container.querySelectorAll('[data-action="reg"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      promptAndRegister(btn.getAttribute('data-id'));
    });
  });
  container.querySelectorAll('[data-action="del"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Удалить?')) return;
      API.deleteEvent(btn.getAttribute('data-id')).then(renderEvents).catch(function (err) {
        notify(err.message || 'Ошибка');
      });
    });
  });
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
    if (!title || !date || !desc) {
      notify('Заполните все поля');
      return;
    }
    API.createEvent({ title: title, date: date, description: desc, max: max, isSpeaker: isSpeaker })
      .then(function () {
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventDesc').value = '';
        document.getElementById('eventMax').value = '';
        document.getElementById('eventSpeakerCheckbox').checked = false;
        renderEvents();
      })
      .catch(function (err) {
        notify(err.message || 'Ошибка создания');
      });
  });
}

window.promptAndRegister = promptAndRegister;
