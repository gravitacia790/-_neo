function renderAdminPanel() {
  var container = document.getElementById('admin');
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML = '<div>Доступ запрещён</div>';
    return;
  }
  container.innerHTML = '<h2 class="tab-title">Админ-панель</h2><div>Загрузка...</div>';
  Promise.all([
    API.getAdminOverview(),
    API.getAdminUsers(),
    API.getAdminEvents(),
    API.getAdminRegistrations(),
    API.getAdminMaterials(),
  ])
    .then(function (results) {
      var overview = results[0].overview || {};
      var users = results[1].users || [];
      var events = results[2].events || [];
      var registrations = results[3].registrations || [];
      var materials = results[4].materials || [];
      var html =
        '<h2 class="tab-title">Админ-панель</h2>' +
        '<div class="admin-tabs" id="adminTabs">' +
        '<button class="admin-tab active" data-admin-section="overview">Обзор</button>' +
        '<button class="admin-tab" data-admin-section="directors">Директора</button>' +
        '<button class="admin-tab" data-admin-section="events">Мероприятия</button>' +
        '<button class="admin-tab" data-admin-section="registrations">Регистрации</button>' +
        '<button class="admin-tab" data-admin-section="materials">Материалы</button>' +
        '<button class="admin-tab" data-admin-section="broadcasts">Рассылки</button>' +
        '</div>' +
        buildOverviewSection(overview) +
        buildDirectorsSection(users) +
        buildEventsSection(events) +
        buildRegistrationsSection(registrations) +
        buildMaterialsSection(materials, events) +
        buildBroadcastsSection(events);

      container.innerHTML = html;
      bindAdminTabs(container);
      bindAdminActions(container, { registrations: registrations, materials: materials, events: events });
    })
    .catch(function (err) {
      container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
    });
}

function buildOverviewSection(overview) {
  var cards = [
    ['Директоров', overview.directors || 0],
    ['Мероприятий', overview.events || 0],
    ['Регистраций', overview.registrations || 0],
    ['Материалов', overview.materials || 0],
    ['Рассылок', overview.announcements || 0],
  ];
  return (
    '<section class="admin-section active" data-admin-panel="overview">' +
    '<div class="admin-metric-grid">' +
    cards.map(function (card) {
      return '<div class="admin-metric"><span>' + escapeHtml(card[0]) + '</span><strong>' + escapeHtml(card[1]) + '</strong></div>';
    }).join('') +
    '</div></section>'
  );
}

function buildDirectorsSection(users) {
  var html =
    '<section class="admin-section" data-admin-panel="directors"><h3 class="section-label">Рейтинг директоров</h3>' +
    '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
    '<th>Директор</th><th>Email</th><th>Рейтинг</th><th>Публичный</th><th>Активности</th></tr></thead><tbody>';
  users.forEach(function (u) {
    var lastActs =
      (u.lastActivities || [])
        .map(function (a) { return escapeHtml(a.description) + ' (+' + a.points + ')'; })
        .join('<br>') || '—';
    html +=
      '<tr><td>' + escapeHtml(u.name) + '</td><td>' + escapeHtml(u.email) + '</td><td><strong>' +
      u.totalScore + '</strong></td><td>' + (u.public ? 'Да' : 'Нет') + '</td><td><small>' + lastActs + '</small></td></tr>';
  });
  return html + '</tbody></table></div></section>';
}

function buildEventsSection(events) {
  var html =
    '<section class="admin-section" data-admin-panel="events"><h3 class="section-label">Опубликованные мероприятия</h3>' +
    '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
    '<th>Название</th><th>Дата</th><th>Организатор</th><th>Регистраций</th><th>Максимум</th><th>Действия</th></tr></thead><tbody>';
  events.forEach(function (ev) {
    html +=
      '<tr><td>' + escapeHtml(ev.title) + '</td><td>' + escapeHtml(ev.date || '—') + '</td><td>' +
      escapeHtml(ev.creator || '—') + (ev.creatorEmail ? '<br><small>' + escapeHtml(ev.creatorEmail) + '</small>' : '') +
      '</td><td>' + escapeHtml(ev.registrationsCount) + '</td><td>' + escapeHtml(ev.max || '—') + '</td><td>' +
      '<button class="ghost-btn delete-event-btn" data-id="' + escapeAttr(ev.id) + '">Снять</button></td></tr>';
  });
  return html + '</tbody></table></div></section>';
}

function buildRegistrationsSection(registrations) {
  var html =
    '<section class="admin-section" data-admin-panel="registrations"><h3 class="section-label">Регистрации</h3>' +
    '<button class="save-btn" id="exportRegistrationsBtn" style="margin:0 0 14px;">Выгрузить CSV</button>';
  if (!registrations.length) return html + '<div class="list-state">Регистраций пока нет</div></section>';
  html +=
    '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
    '<th>Раздел</th><th>Мероприятие</th><th>Дата</th><th>Участник</th><th>Телефон</th><th>Школа</th><th>Город</th><th>Зарегистрировал</th>' +
    '</tr></thead><tbody>';
  registrations.forEach(function (r) {
    html +=
      '<tr><td>' + escapeHtml(r.source) + '</td><td>' + escapeHtml(r.eventTitle) + '</td><td>' +
      escapeHtml(r.eventDate || '—') + '</td><td>' + escapeHtml(r.participantName) + '</td><td>' +
      escapeHtml(r.phone || '—') + '</td><td>' + escapeHtml(r.schoolName || '—') + '</td><td>' +
      escapeHtml(r.city || '—') + '</td><td>' + escapeHtml(r.registeredBy || '—') +
      (r.registeredByEmail ? '<br><small>' + escapeHtml(r.registeredByEmail) + '</small>' : '') + '</td></tr>';
  });
  return html + '</tbody></table></div></section>';
}

function buildMaterialsSection(materials, events) {
  var eventOptions = '<option value="">Без привязки</option>' + events.map(function (ev) {
    return '<option value="' + escapeAttr(String(ev.id)) + '">' + escapeHtml(ev.title) + '</option>';
  }).join('');
  var html =
    '<section class="admin-section" data-admin-panel="materials"><h3 class="section-label">Материалы семинаров</h3>' +
    '<div class="admin-form-card">' +
    '<input type="hidden" id="materialId">' +
    '<div class="form-group"><label class="form-label">Название</label><input id="materialTitle" type="text"></div>' +
    '<div class="form-group"><label class="form-label">Описание</label><textarea id="materialDescription" rows="2"></textarea></div>' +
    '<div class="form-group"><label class="form-label">Ссылка</label><input id="materialUrl" type="url" placeholder="https://..."></div>' +
    '<div class="form-group"><label class="form-label">Категория</label><select id="materialCategory"><option value="gl">Гравитация лидерства</option><option value="internship">Стажировка</option><option value="calendar">Календарь</option><option value="general">Общее</option></select></div>' +
    '<div class="form-group"><label class="form-label">Мероприятие</label><select id="materialEventId">' + eventOptions + '</select></div>' +
    '<div class="checkbox-label"><input type="checkbox" id="materialPublished" checked><label for="materialPublished">Опубликовано</label></div>' +
    '<button class="save-btn" id="saveMaterialBtn">Сохранить материал</button><button class="ghost-btn" id="resetMaterialBtn" style="margin-top:8px;">Очистить</button></div>';
  if (!materials.length) return html + '<div class="list-state">Материалов пока нет</div></section>';
  html += '<div class="admin-card-list">';
  materials.forEach(function (m) {
    html +=
      '<div class="admin-list-card" data-material-id="' + escapeAttr(m.id) + '">' +
      '<strong>' + escapeHtml(m.title) + '</strong><p>' + escapeHtml(m.description || 'Без описания') + '</p>' +
      '<small>' + escapeHtml(m.category) + ' • ' + (m.published ? 'Опубликовано' : 'Скрыто') + '</small>' +
      '<div><a href="' + escapeAttr(m.url) + '" target="_blank" rel="noopener">Открыть</a></div>' +
      '<button class="ghost-btn edit-material-btn" data-id="' + escapeAttr(m.id) + '">Редактировать</button> ' +
      '<button class="ghost-btn delete-material-btn" data-id="' + escapeAttr(m.id) + '">Удалить</button>' +
      '</div>';
  });
  return html + '</div></section>';
}

function buildBroadcastsSection(events) {
  var eventOptions = events.map(function (ev) {
    return '<option value="event:' + escapeAttr(ev.id) + '">Участники: ' + escapeHtml(ev.title) + '</option>';
  }).join('');
  return (
    '<section class="admin-section" data-admin-panel="broadcasts"><h3 class="section-label">Рассылка информации</h3>' +
    '<div class="admin-form-card">' +
    '<div class="form-group"><label class="form-label">Заголовок</label><input id="announcementTitle" type="text"></div>' +
    '<div class="form-group"><label class="form-label">Текст</label><textarea id="announcementMessage" rows="3"></textarea></div>' +
    '<div class="form-group"><label class="form-label">Аудитория</label><select id="announcementAudience">' +
    '<option value="all">Все пользователи</option><option value="directors">Все директора</option>' +
    '<option value="category:gl">Участники ГЛ</option><option value="category:internship">Участники стажировок</option><option value="category:calendar">Участники календарных событий</option>' +
    eventOptions + '</select></div>' +
    '<button class="save-btn" id="sendAnnouncementBtn">Отправить уведомление</button></div></section>'
  );
}

function csvCell(value) {
  var text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function escapeAttr(value) {
  return escapeHtml(value == null ? '' : String(value)).replace(/"/g, '&quot;');
}

function bindAdminTabs(container) {
  var tabs = Array.prototype.slice.call(container.querySelectorAll('.admin-tab'));
  var panels = Array.prototype.slice.call(container.querySelectorAll('.admin-section'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-admin-section');
      tabs.forEach(function (item) { item.classList.toggle('active', item === tab); });
      panels.forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-admin-panel') === target);
      });
    });
  });
}

function getMaterialPayload() {
  return {
    title: document.getElementById('materialTitle').value.trim(),
    description: document.getElementById('materialDescription').value.trim(),
    url: document.getElementById('materialUrl').value.trim(),
    category: document.getElementById('materialCategory').value,
    eventId: document.getElementById('materialEventId').value,
    published: document.getElementById('materialPublished').checked,
  };
}

function resetMaterialForm() {
  document.getElementById('materialId').value = '';
  document.getElementById('materialTitle').value = '';
  document.getElementById('materialDescription').value = '';
  document.getElementById('materialUrl').value = '';
  document.getElementById('materialCategory').value = 'gl';
  document.getElementById('materialEventId').value = '';
  document.getElementById('materialPublished').checked = true;
}

function bindAdminActions(container, data) {
  var exportBtn = document.getElementById('exportRegistrationsBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      exportRegistrationsCsv(data.registrations);
    });
  }

  var resetBtn = document.getElementById('resetMaterialBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetMaterialForm);

  var saveMaterialBtn = document.getElementById('saveMaterialBtn');
  if (saveMaterialBtn) {
    saveMaterialBtn.addEventListener('click', function () {
      var id = document.getElementById('materialId').value;
      var payload = getMaterialPayload();
      var request = id ? API.updateAdminMaterial(id, payload) : API.createAdminMaterial(payload);
      saveMaterialBtn.disabled = true;
      request
        .then(function () { renderAdminPanel(); })
        .catch(function (err) { alert(err.message); })
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
      document.getElementById('materialEventId').value = material.eventId || '';
      document.getElementById('materialPublished').checked = !!material.published;
      document.getElementById('materialTitle').focus();
    });
  });

  container.querySelectorAll('.delete-material-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Удалить материал?')) return;
      API.deleteAdminMaterial(btn.getAttribute('data-id'))
        .then(function () { renderAdminPanel(); })
        .catch(function (err) { alert(err.message); });
    });
  });

  container.querySelectorAll('.delete-event-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Снять мероприятие с публикации?')) return;
      API.deleteEvent(btn.getAttribute('data-id'))
        .then(function () { renderAdminPanel(); })
        .catch(function (err) { alert(err.message); });
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
          alert('Рассылка отправлена. Получателей: ' + result.recipients);
          renderAdminPanel();
        })
        .catch(function (err) { alert(err.message); })
        .finally(function () { sendAnnouncementBtn.disabled = false; });
    });
  }
}

function exportRegistrationsCsv(registrations) {
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
  link.download = 'registrations.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
