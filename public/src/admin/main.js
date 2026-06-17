import { bindAdminActions } from './logic.js';
import { bindAdminTabs, buildAdminTabs, getAdminSectionRegistry } from './ui.js';
import { API } from '../api.js';
import { isAdmin } from '../utils.js';
import { html as h } from '../html.js';
export function renderAdminPanel() {
  var container = document.getElementById('admin');
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML = '<div>Доступ запрещён</div>';
    return;
  }
  container.innerHTML = '<h2 class="tab-title">Админ-панель</h2><div>Загрузка...</div>';
  Promise.all([
    API.getAdminOverview(),
    API.getAdminApplications(),
    API.getAdminUsers(),
    API.getAdminEvents(),
    API.getAdminRegistrations(),
    API.getAdminMaterials(),
    API.getAdminAnnouncements(),
  ])
    .then(function (results) {
      var overview = results[0].overview || {};
      var applications = results[1].applications || [];
      var users = results[2].users || [];
      var events = results[3].events || [];
      var registrations = results[4].registrations || [];
      var materials = results[5].materials || [];
      var announcements = results[6].announcements || [];
      var sections = getAdminSectionRegistry({
        overview: overview,
        applications: applications,
        users: users,
        events: events,
        registrations: registrations,
        materials: materials,
        announcements: announcements,
      });
      var html =
        '<h2 class="tab-title">Админ-панель</h2>' +
        buildAdminTabs(sections) +
        sections.map(function (section) { return section.render(); }).join('');

      container.innerHTML = html;
      bindAdminTabs(container);
      bindAdminActions(container, {
        applications: applications,
        registrations: registrations,
        materials: materials,
        events: events,
      });
    })
    .catch(function (err) {
      container.innerHTML = h`<div style="color:#ff8;">Ошибка: ${err.message}</div>`;
    });
}
