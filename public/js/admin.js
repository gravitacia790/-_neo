function renderAdminPanel() {
  var container = document.getElementById('admin');
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML = '<div>Доступ запрещён</div>';
    return;
  }
  container.innerHTML = '<h2>👑 Админ-панель</h2><div>Загрузка...</div>';
  Promise.all([API.getAdminUsers(), API.getAdminRegistrations()])
    .then(function (results) {
      var users = results[0].users;
      var registrations = results[1].registrations || [];
      var html =
        '<h2>👑 Админ-панель: рейтинг директоров</h2>' +
        '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
        '<th>Директор</th><th>Email</th><th>Рейтинг</th><th>Публичный</th><th>Активности (последние)</th>' +
        '</tr></thead><tbody>';
      users.forEach(function (u) {
        var lastActs =
          (u.lastActivities || [])
            .map(function (a) {
              return escapeHtml(a.description) + ' (+' + a.points + ')';
            })
            .join('<br>') || '—';
        html +=
          '<tr><td>' +
          escapeHtml(u.name) +
          '</td><td>' +
          escapeHtml(u.email) +
          '</td>' +
          '<td><strong>' +
          u.totalScore +
          '</strong></td>' +
          '<td>' +
          (u.public ? 'Да' : 'Нет') +
          '</td>' +
          '<td><small>' +
          lastActs +
          '</small></td></tr>';
      });
      html +=
        '</tbody></table></div>' +
        '<h2 class="tab-title" style="margin-top:28px;">Регистрации на мероприятия</h2>' +
        '<button class="save-btn" id="exportRegistrationsBtn" style="margin:0 0 14px;">Выгрузить CSV</button>';
      if (!registrations.length) {
        html += '<div class="list-state">Регистраций пока нет</div>';
      } else {
        html +=
          '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
          '<th>Раздел</th><th>Мероприятие</th><th>Дата</th><th>Участник</th><th>Телефон</th><th>Школа</th><th>Город</th><th>Зарегистрировал</th>' +
          '</tr></thead><tbody>';
        registrations.forEach(function (r) {
          html +=
            '<tr><td>' +
            escapeHtml(r.source) +
            '</td><td>' +
            escapeHtml(r.eventTitle) +
            '</td><td>' +
            escapeHtml(r.eventDate || '—') +
            '</td><td>' +
            escapeHtml(r.participantName) +
            '</td><td>' +
            escapeHtml(r.phone || '—') +
            '</td><td>' +
            escapeHtml(r.schoolName || '—') +
            '</td><td>' +
            escapeHtml(r.city || '—') +
            '</td><td>' +
            escapeHtml(r.registeredBy || '—') +
            (r.registeredByEmail ? '<br><small>' + escapeHtml(r.registeredByEmail) + '</small>' : '') +
            '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      container.innerHTML = html;
      var exportBtn = document.getElementById('exportRegistrationsBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', function () {
          exportRegistrationsCsv(registrations);
        });
      }
    })
    .catch(function (err) {
      container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
    });
}

function csvCell(value) {
  var text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
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
