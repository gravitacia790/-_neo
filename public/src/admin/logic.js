import { renderAdminPanel } from './main.js';
import { API } from '../api.js';
import { confirmDialog, feedbackDialog } from '../utils.js';
import { html as h } from '../html.js';
export function csvCell(value) {
  var text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) { return String(a).localeCompare(String(b), 'ru'); });
}

export function getAudienceLabel(value) {
  if (value === 'all') return 'Все пользователи';
  if (value === 'directors') return 'Все директора';
  if (value === 'category:gl') return 'Участники ГЛ';
  if (value === 'category:internship') return 'Участники стажировок';
  if (value === 'category:calendar') return 'Участники календарных событий';
  if (value && value.indexOf('event:') === 0) return 'Участники мероприятия';
  return value || 'Не указано';
}

export function getEventStatusLabel(value) {
  if (value === 'draft') return 'Черновик';
  if (value === 'archived') return 'Архив';
  return 'Опубликовано';
}

export function getMaterialTypeIcon(value) {
  if (value === 'presentation') return 'Презентация';
  if (value === 'recording') return 'Запись';
  if (value === 'document') return 'Документ';
  return 'Ссылка';
}

export function getMaterialCategoryLabel(value) {
  if (value === 'gl') return 'Гравитация лидерства';
  if (value === 'internship') return 'Стажировка';
  if (value === 'calendar') return 'Календарь';
  return 'Общее';
}

export function formatAdminDate(value) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
}

export function getMaterialPayload() {
  return {
    title: document.getElementById('materialTitle').value.trim(),
    description: document.getElementById('materialDescription').value.trim(),
    url: document.getElementById('materialUrl').value.trim(),
    category: document.getElementById('materialCategory').value,
    materialType: document.getElementById('materialType').value,
    eventId: document.getElementById('materialEventId').value,
    published: document.getElementById('materialPublished').checked,
  };
}

export function resetMaterialForm() {
  document.getElementById('materialId').value = '';
  document.getElementById('materialTitle').value = '';
  document.getElementById('materialDescription').value = '';
  document.getElementById('materialUrl').value = '';
  document.getElementById('materialCategory').value = 'gl';
  document.getElementById('materialType').value = 'link';
  document.getElementById('materialEventId').value = '';
  document.getElementById('materialPublished').checked = true;
}

export function getAdminEventPayload() {
  return {
    title: document.getElementById('adminEventTitle').value.trim(),
    date: document.getElementById('adminEventDate').value.trim(),
    description: document.getElementById('adminEventDescription').value.trim(),
    max: document.getElementById('adminEventMax').value || 1,
    status: document.getElementById('adminEventStatus').value,
  };
}

export function resetAdminEventForm() {
  document.getElementById('adminEventId').value = '';
  document.getElementById('adminEventTitle').value = '';
  document.getElementById('adminEventDate').value = '';
  document.getElementById('adminEventDescription').value = '';
  document.getElementById('adminEventMax').value = '';
  document.getElementById('adminEventStatus').value = 'published';
}

export function bindAdminActions(container, data) {
  container.querySelectorAll('.approve-application-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      updateApplication(btn, 'approved');
    });
  });
  container.querySelectorAll('.reject-application-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      confirmDialog({
        title: 'Отклонить заявку?',
        message: 'Пользователь не сможет войти, но заявка останется в журнале.',
        confirmText: 'Отклонить',
      }).then(function (confirmed) {
        if (confirmed) updateApplication(btn, 'rejected');
      });
    });
  });

  var currentRegistrations = data.registrations.slice();
  bindRegistrationFilters(container, data.registrations, function (filtered) {
    currentRegistrations = filtered;
  });
  var exportBtn = document.getElementById('exportRegistrationsBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      exportRegistrationsCsv(currentRegistrations);
    });
  }

  var resetBtn = document.getElementById('resetMaterialBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetMaterialForm);
  bindMaterialFilters(container, data.materials);

  var resetEventBtn = document.getElementById('resetAdminEventBtn');
  if (resetEventBtn) resetEventBtn.addEventListener('click', resetAdminEventForm);

  var saveEventBtn = document.getElementById('saveAdminEventBtn');
  if (saveEventBtn) {
    saveEventBtn.addEventListener('click', function () {
      var id = document.getElementById('adminEventId').value;
      if (!id) {
        feedbackDialog({ title: 'Мероприятие не выбрано', message: 'Сначала нажмите «Редактировать» в строке нужного мероприятия.' });
        return;
      }
      saveEventBtn.disabled = true;
      API.updateEvent(id, getAdminEventPayload())
        .then(function () { renderAdminPanel(); })
        .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); })
        .finally(function () { saveEventBtn.disabled = false; });
    });
  }

  var saveMaterialBtn = document.getElementById('saveMaterialBtn');
  if (saveMaterialBtn) {
    saveMaterialBtn.addEventListener('click', function () {
      var id = document.getElementById('materialId').value;
      var payload = getMaterialPayload();
      var request = id ? API.updateAdminMaterial(id, payload) : API.createAdminMaterial(payload);
      saveMaterialBtn.disabled = true;
      request
        .then(function () { renderAdminPanel(); })
        .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); })
        .finally(function () { saveMaterialBtn.disabled = false; });
    });
  }

  container.querySelectorAll('.edit-material-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var material = data.materials.find(function (m) { return String(m.id) === String(btn.getAttribute('data-id')); });
      if (!material) return;
      document.getElementById('materialId').value = material.id;
      document.getElementById('materialTitle').value = material.title;
      document.getElementById('materialDescription').value = material.description || '';
      document.getElementById('materialUrl').value = material.url;
      document.getElementById('materialCategory').value = material.category || 'gl';
      document.getElementById('materialType').value = material.materialType || 'link';
      document.getElementById('materialEventId').value = material.eventId || '';
      document.getElementById('materialPublished').checked = !!material.published;
      document.getElementById('materialTitle').focus();
    });
  });

  container.querySelectorAll('.delete-material-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      confirmDialog({
        title: 'Удалить материал?',
        message: 'Материал исчезнет из пользовательских разделов и админки.',
        confirmText: 'Удалить',
      }).then(function (confirmed) {
        if (!confirmed) return;
        API.deleteAdminMaterial(btn.getAttribute('data-id'))
          .then(function () { renderAdminPanel(); })
          .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); });
      });
    });
  });

  container.querySelectorAll('.edit-event-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var event = data.events.find(function (ev) { return String(ev.id) === String(btn.getAttribute('data-id')); });
      if (!event) return;
      document.getElementById('adminEventId').value = event.id;
      document.getElementById('adminEventTitle').value = event.title;
      document.getElementById('adminEventDate').value = event.date || '';
      document.getElementById('adminEventDescription').value = event.description || '';
      document.getElementById('adminEventMax').value = event.max || '';
      document.getElementById('adminEventStatus').value = event.status || 'published';
      document.getElementById('adminEventTitle').focus();
    });
  });

  container.querySelectorAll('.archive-event-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var event = data.events.find(function (ev) { return String(ev.id) === String(btn.getAttribute('data-id')); });
      if (!event) return;
      confirmDialog({
        title: 'Перенести мероприятие в архив?',
        message: 'Архивное мероприятие будет скрыто от пользователей и календаря.',
        confirmText: 'В архив',
      }).then(function (confirmed) {
        if (!confirmed) return;
        API.updateEvent(event.id, {
          title: event.title,
          date: event.date,
          description: event.description,
          max: event.max || 1,
          status: 'archived',
        })
          .then(function () { renderAdminPanel(); })
          .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); });
      });
    });
  });

  container.querySelectorAll('.view-participants-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activateAdminSection('registrations');
      var keyInput = document.getElementById('registrationEventKeyFilter');
      if (keyInput) keyInput.value = btn.getAttribute('data-event-key') || '';
      var eventFilter = document.getElementById('registrationEventFilter');
      if (eventFilter) eventFilter.value = '';
      applyRegistrationFilters(data.registrations, function (filtered) {
        currentRegistrations = filtered;
      });
    });
  });

  container.querySelectorAll('.export-event-participants-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-event-key') || '';
      var rows = data.registrations.filter(function (r) { return r.sourceKey === key; });
      exportRegistrationsCsv(rows, 'event-participants.csv');
    });
  });

  var sendAnnouncementBtn = document.getElementById('sendAnnouncementBtn');
  if (sendAnnouncementBtn) {
    sendAnnouncementBtn.addEventListener('click', function () {
      var payload = {
        title: document.getElementById('announcementTitle').value.trim(),
        message: document.getElementById('announcementMessage').value.trim(),
        audience: document.getElementById('announcementAudience').value,
      };
      sendAnnouncementBtn.disabled = true;
      API.sendAdminAnnouncement(payload)
        .then(function (result) {
          return feedbackDialog({
            title: 'Рассылка отправлена',
            message: 'Получателей: ' + result.recipients,
          }).then(renderAdminPanel);
        })
        .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); })
        .finally(function () { sendAnnouncementBtn.disabled = false; });
    });
  }
}

function updateApplication(button, status) {
  button.disabled = true;
  API.updateAdminApplication(button.getAttribute('data-id'), status)
    .then(function () {
      return feedbackDialog({
        title: status === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена',
        message:
          status === 'approved'
            ? 'Директор теперь может войти в приложение.'
            : 'Доступ к приложению для пользователя закрыт.',
      });
    })
    .then(renderAdminPanel)
    .catch(function (err) {
      feedbackDialog({ title: 'Ошибка', message: err.message });
    })
    .finally(function () {
      button.disabled = false;
    });
}

export function activateAdminSection(sectionName) {
  document.querySelectorAll('.admin-tab').forEach(function (item) {
    item.classList.toggle('active', item.getAttribute('data-admin-section') === sectionName);
  });
  document.querySelectorAll('.admin-section').forEach(function (panel) {
    panel.classList.toggle('active', panel.getAttribute('data-admin-panel') === sectionName);
  });
}

export function bindRegistrationFilters(container, registrations, onChange) {
  var filterIds = [
    'registrationSourceFilter',
    'registrationEventFilter',
    'registrationCityFilter',
    'registrationDateFromFilter',
    'registrationDateToFilter',
  ];
  filterIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function () {
        var keyInput = document.getElementById('registrationEventKeyFilter');
        if (keyInput) keyInput.value = '';
        applyRegistrationFilters(registrations, onChange);
      });
    }
  });
  var resetBtn = document.getElementById('resetRegistrationFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      filterIds.concat(['registrationEventKeyFilter']).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyRegistrationFilters(registrations, onChange);
    });
  }
  applyRegistrationFilters(registrations, onChange);
}

export function bindMaterialFilters(container, materials) {
  if (!materials || !materials.length) return;
  var filterIds = ['materialTypeFilter', 'materialCategoryFilter', 'materialEventFilter'];
  filterIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', applyMaterialFilters);
  });
  var resetBtn = document.getElementById('resetMaterialFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      filterIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyMaterialFilters();
    });
  }
  applyMaterialFilters();
}

export function applyMaterialFilters() {
  var type = getInputValue('materialTypeFilter');
  var category = getInputValue('materialCategoryFilter');
  var eventId = getInputValue('materialEventFilter');
  document.querySelectorAll('#adminMaterialsList .admin-list-card').forEach(function (card) {
    var visible = true;
    if (type && card.getAttribute('data-material-type') !== type) visible = false;
    if (category && card.getAttribute('data-material-category') !== category) visible = false;
    if (eventId && card.getAttribute('data-material-event') !== eventId) visible = false;
    card.hidden = !visible;
  });
}

export function applyRegistrationFilters(registrations, onChange) {
  var source = getInputValue('registrationSourceFilter');
  var eventTitle = getInputValue('registrationEventFilter');
  var city = getInputValue('registrationCityFilter');
  var dateFrom = getInputValue('registrationDateFromFilter');
  var dateTo = getInputValue('registrationDateToFilter');
  var eventKey = getInputValue('registrationEventKeyFilter');
  var filtered = registrations.filter(function (r) {
    if (eventKey && r.sourceKey !== eventKey) return false;
    if (source && r.source !== source) return false;
    if (eventTitle && r.eventTitle !== eventTitle) return false;
    if (city && r.city !== city) return false;
    if (dateFrom || dateTo) {
      var registeredDate = parseDateOnly(r.registeredAt);
      if (!registeredDate) return false;
      if (dateFrom && registeredDate < dateFrom) return false;
      if (dateTo && registeredDate > dateTo) return false;
    }
    return true;
  });
  renderRegistrationsTable(filtered);
  updateRegistrationsSummary(filtered.length, registrations.length);
  if (typeof onChange === 'function') onChange(filtered);
}

export function getInputValue(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

export function parseDateOnly(value) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function renderRegistrationsTable(registrations) {
  var body = document.getElementById('adminRegistrationsBody');
  if (!body) return;
  if (!registrations.length) {
    body.innerHTML = '<tr><td colspan="9" class="list-state">По текущим фильтрам регистраций нет. Измените фильтр или дождитесь новых заявок.</td></tr>';
    return;
  }
  body.innerHTML = registrations.map(function (r) {
    return h`<tr><td>${r.source}</td><td>${r.eventTitle}</td><td>${r.eventDate || '—'}</td><td>${r.participantName}</td><td>${r.phone || '—'}</td><td>${r.schoolName || '—'}</td><td>${r.city || '—'}</td><td>${r.registeredBy || '—'}${
      r.registeredByEmail ? h`<br><small>${r.registeredByEmail}</small>` : ''
    }</td><td><button class="ghost-btn cancel-registration-btn" data-source-key="${r.sourceKey}" data-registration-id="${r.registrationId}" data-event-id="${r.eventId}" data-category="${r.category || ''}">Отменить</button></td></tr>`;
  }).join('');
  bindCancelRegistrationButtons();
}

export function updateRegistrationsSummary(visibleCount, totalCount) {
  var el = document.getElementById('registrationsFilterSummary');
  if (el) el.textContent = 'Показано: ' + visibleCount + ' из ' + totalCount;
}

export function bindCancelRegistrationButtons() {
  document.querySelectorAll('.cancel-registration-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      confirmDialog({
        title: 'Отменить регистрацию?',
        message: 'Участник будет удалён из списка, а место снова станет доступно.',
        confirmText: 'Отменить регистрацию',
      }).then(function (confirmed) {
        if (!confirmed) return;
        var sourceKey = btn.getAttribute('data-source-key') || '';
        var registrationId = btn.getAttribute('data-registration-id');
        var eventId = btn.getAttribute('data-event-id');
        var request = sourceKey.indexOf('extra:') === 0
          ? API.cancelExtraRegistration(btn.getAttribute('data-category'), eventId, registrationId)
          : API.cancelEventRegistration(eventId, registrationId);
        request
          .then(function () { return feedbackDialog({ title: 'Регистрация отменена', message: 'Список участников обновлён.' }); })
          .then(renderAdminPanel)
          .catch(function (err) { feedbackDialog({ title: 'Ошибка', message: err.message }); });
      });
    });
  });
}

export function exportRegistrationsCsv(registrations, filename) {
  var rows = [
    ['Раздел', 'Мероприятие', 'Дата мероприятия', 'ФИО', 'Телефон', 'Школа', 'Город', 'Зарегистрировал', 'Email', 'Дата регистрации'],
  ];
  registrations.forEach(function (r) {
    rows.push([
      r.source,
      r.eventTitle,
      r.eventDate || '',
      r.participantName,
      r.phone || '',
      r.schoolName || '',
      r.city || '',
      r.registeredBy || '',
      r.registeredByEmail || '',
      r.registeredAt || '',
    ]);
  });
  var csv = '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(';'); }).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = filename || 'registrations.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
