/* global getUiErrorMessage */
function deriveRegistrationCity(profile, school) {
  if (profile && profile.city) return profile.city;
  if (school && school.address) {
    var firstPart = String(school.address).split(',')[0].trim();
    return firstPart.replace(/^г\.?\s*/i, '');
  }
  return '';
}

function getRegistrationDefaults() {
  var profile = getMyProfileCache() || {};
  var school = getMySchoolCache() || {};
  var user = API.getUser() || {};
  var nameEl = document.getElementById('directorName');
  var phoneEl = document.getElementById('directorPhone');
  var schoolEl = document.getElementById('schoolName');
  var addressEl = document.getElementById('schoolAddress');

  return {
    employeeName: (nameEl && nameEl.value.trim()) || profile.name || user.name || '',
    position: 'Директор',
    schoolName: (schoolEl && schoolEl.value.trim()) || school.name || '',
    phone: (phoneEl && phoneEl.value.trim()) || profile.phone || '',
    city: deriveRegistrationCity(profile, {
      address: (addressEl && addressEl.value.trim()) || school.address || '',
    }),
  };
}

function showRegistrationFieldError(modal, selector, message) {
  var input = modal.querySelector(selector);
  if (!input) return;
  input.classList.add('field-error');
  var text = document.createElement('div');
  text.className = 'field-error-text';
  text.textContent = message;
  input.insertAdjacentElement('afterend', text);
}

function openRegistrationModal(options) {
  options = options || {};
  var defaults = getRegistrationDefaults();
  var modal = showModal(
    'Регистрация на мероприятие',
    '<form class="registration-form" id="registrationForm">' +
      '<p class="modal-hint">Проверьте данные участника. Мы подтянули их из профиля, чтобы организаторы видели контакты и школу.</p>' +
      '<div class="form-group"><label class="form-label">ФИО участника</label><input type="text" id="regParticipantName" value="' + escapeAttr(defaults.employeeName) + '"></div>' +
      '<div class="form-group"><label class="form-label">Телефон для связи</label><input type="tel" id="regParticipantPhone" value="' + escapeAttr(defaults.phone) + '" placeholder="+7 (999) 999-99-99"></div>' +
      '<div class="form-group"><label class="form-label">Школа</label><input type="text" id="regParticipantSchool" value="' + escapeAttr(defaults.schoolName) + '"></div>' +
      '<div class="form-group"><label class="form-label">Город</label><input type="text" id="regParticipantCity" value="' + escapeAttr(defaults.city) + '" placeholder="Например: Химки"></div>' +
      '<button class="save-btn" type="submit" id="registrationSubmitBtn">Зарегистрироваться</button>' +
    '</form>'
  );
  var form = modal.querySelector('#registrationForm');
  var submit = modal.querySelector('#registrationSubmitBtn');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    modal.querySelectorAll('.field-error').forEach(function (el) { el.classList.remove('field-error'); });
    modal.querySelectorAll('.field-error-text').forEach(function (el) { el.remove(); });
    var data = {
      employeeName: modal.querySelector('#regParticipantName').value.trim(),
      position: defaults.position,
      phone: modal.querySelector('#regParticipantPhone').value.trim(),
      schoolName: modal.querySelector('#regParticipantSchool').value.trim(),
      city: modal.querySelector('#regParticipantCity').value.trim(),
    };
    var hasError = false;
    if (!data.employeeName) {
      showRegistrationFieldError(modal, '#regParticipantName', 'Укажите ФИО участника');
      hasError = true;
    }
    if (!data.phone) {
      showRegistrationFieldError(modal, '#regParticipantPhone', 'Укажите телефон для связи');
      hasError = true;
    } else if (!/^[\d\s\-+()]{7,20}$/.test(data.phone)) {
      showRegistrationFieldError(modal, '#regParticipantPhone', 'Введите корректный номер телефона');
      hasError = true;
    }
    if (!data.schoolName) {
      showRegistrationFieldError(modal, '#regParticipantSchool', 'Укажите школу');
      hasError = true;
    }
    if (!data.city) {
      showRegistrationFieldError(modal, '#regParticipantCity', 'Укажите город');
      hasError = true;
    }
    if (hasError) return;

    submit.disabled = true;
    submit.dataset.defaultText = submit.textContent;
    submit.textContent = 'Отправляем...';
    options
      .onSubmit(data)
      .then(function () {
        modal.remove();
        notify(options.successMessage || 'Вы зарегистрированы');
        if (typeof options.onSuccess === 'function') options.onSuccess(data);
      })
      .catch(function (err) {
        notify(getUiErrorMessage(err, 'Не удалось зарегистрироваться.'));
      })
      .finally(function () {
        submit.disabled = false;
        submit.textContent = submit.dataset.defaultText || 'Зарегистрироваться';
      });
  });
}

function promptAndRegister(eventId) {
  openRegistrationModal({
    onSubmit: function (data) {
      return API.registerForEvent(eventId, data);
    },
    successMessage: 'Участник записан',
    onSuccess: function () {
      renderEvents();
    },
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
    btn.textContent = btn.dataset.defaultText || 'Опубликовать мероприятие';
  }

  function formatPublishedEventDate(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return raw;
    var monthNames = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    var monthIndex = parseInt(match[2], 10) - 1;
    var monthName = monthNames[monthIndex] || match[2];
    return parseInt(match[3], 10) + ' ' + monthName + ' ' + match[1] + ', ' + match[4] + ':' + match[5];
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

    API.createEvent({ title: title, date: formatPublishedEventDate(date), description: desc, max: max, isSpeaker: isSpeaker })
      .then(function () {
        if (titleEl) titleEl.value = '';
        if (dateEl) dateEl.value = '';
        if (descEl) descEl.value = '';
        if (maxEl) maxEl.value = '';
        if (speakerEl) speakerEl.checked = false;
        renderEvents();
        notify('Мероприятие опубликовано и добавлено в календарь');
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
window.openRegistrationModal = openRegistrationModal;
