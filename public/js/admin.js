function renderAdminPanel() {
  var container = document.getElementById('admin');
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML = '<div>Доступ запрещён</div>';
    return;
  }
  container.innerHTML = '<h2>👑 Админ-панель</h2><div>Загрузка...</div>';
  API.getAdminUsers()
    .then(function (resp) {
      var users = resp.users;
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
      html += '</tbody></table></div>';
      container.innerHTML = html;
    })
    .catch(function (err) {
      container.innerHTML = '<div style="color:#ff8;">Ошибка: ' + escapeHtml(err.message) + '</div>';
    });
}
