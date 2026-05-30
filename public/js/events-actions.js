/* global getUiErrorMessage */
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
  if (btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';
  var eventsTab = document.getElementById('events');
  var titleEl = document.getElementById('eventTitle');
  var dateEl = document.getElementById('eventDate');
  var descEl = document.getElementById('eventDesc');
  var maxEl = document.getElementById('eventMax');
  var speakerEl = document.getElementById('eventSpeakerCheckbox');

  function clearCreateEventErrors() {
    if (!eventsTab) return;
    eventsTab.querySelectorAll('.event-form-error').forEach(function (el) {
      el.remove();
    });
    [titleEl, dateEl, descEl, maxEl].forEach(function (el) {
      if (el) el.classList.remove('field-error');
    });
  }

  function showCreateEventError(el, msg) {
    if (!el) return;
    el.classList.add('field-error');
    var err = document.createElement('div');
    err.className = 'field-error-text event-form-error';
    err.textContent = msg;
    el.insertAdjacentElement('afterend', err);
  }

  function setCreateEventBusy(isBusy) {
    if (isBusy) {
      btn.dataset.defaultText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Создание...';
      return;
    }
    btn.disabled = false;
    btn.textContent = btn.dataset.defaultText || 'Создать мероприятие';
  }

  btn.addEventListener('click', function () {
    clearCreateEventErrors();
    var title = titleEl ? titleEl.value.trim() : '';
    var date = dateEl ? dateEl.value.trim() : '';
    var desc = descEl ? descEl.value.trim() : '';
    var maxRaw = maxEl ? maxEl.value.trim() : '';
    var max = parseInt(maxRaw, 10);
    var isSpeaker = !!(speakerEl && speakerEl.checked);
    var hasError = false;

    if (!title) {
      showCreateEventError(titleEl, 'Введите название мероприятия');
      hasError = true;
    }
    if (!date) {
      showCreateEventError(dateEl, 'Укажите дату и время');
      hasError = true;
    }
    if (!desc) {
      showCreateEventError(descEl, 'Добавьте короткое описание');
      hasError = true;
    }
    if (maxRaw && (!Number.isFinite(max) || max < 1 || max > 500)) {
      showCreateEventError(maxEl, 'Количество участников: от 1 до 500');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    if (!Number.isFinite(max)) max = 999;
    setCreateEventBusy(true);

    API.createEvent({ title: title, date: date, description: desc, max: max, isSpeaker: isSpeaker })
      .then(function () {
        if (titleEl) titleEl.value = '';
        if (dateEl) dateEl.value = '';
        if (descEl) descEl.value = '';
        if (maxEl) maxEl.value = '';
        if (speakerEl) speakerEl.checked = false;
        renderEvents();
        notify('Мероприятие создано');
      })
      .catch(function (err) {
        notify(getUiErrorMessage(err, 'Не удалось создать мероприятие.'));
      })
      .finally(function () {
        setCreateEventBusy(false);
      });
  });
}

window.promptAndRegister = promptAndRegister;
