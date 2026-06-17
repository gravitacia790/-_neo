import { formatAdminDate, getAudienceLabel, getEventStatusLabel, getMaterialCategoryLabel, getMaterialTypeIcon, uniqueSorted } from './logic.js';
import { getMaterialTypeLabel } from '../utils.js';
import { html as h, raw } from '../html.js';

export function getAdminSectionRegistry(data) {
  var pendingApplicationsCount = data.applications.filter(function (item) {
    return item.status === 'pending';
  }).length;
  return [
    { id: 'overview', label: 'Обзор', render: function () { return buildOverviewSection(data.overview); } },
    {
      id: 'applications',
      label: 'Заявки' + (pendingApplicationsCount ? ' (' + pendingApplicationsCount + ')' : ''),
      render: function () { return buildApplicationsSection(data.applications); },
    },
    { id: 'directors', label: 'Директора', render: function () { return buildDirectorsSection(data.users); } },
    { id: 'events', label: 'Мероприятия', render: function () { return buildEventsSection(data.events); } },
    { id: 'registrations', label: 'Регистрации', render: function () { return buildRegistrationsSection(data.registrations); } },
    { id: 'materials', label: 'Материалы', render: function () { return buildMaterialsSection(data.materials, data.events); } },
    { id: 'broadcasts', label: 'Рассылки', render: function () { return buildBroadcastsSection(data.events, data.announcements); } },
  ];
}

export function buildAdminTabs(sections) {
  return h`<div class="admin-tabs" id="adminTabs">${sections.map(function (section, index) {
    return h`<button class="admin-tab${index === 0 ? ' active' : ''}" data-admin-section="${section.id}">${section.label}</button>`;
  })}</div>`;
}

export function buildOverviewSection(overview) {
  var cards = [
    ['Директоров', overview.directors || 0],
    ['Ожидают решения', overview.pendingApplications || 0],
    ['Мероприятий', overview.events || 0],
    ['Регистраций', overview.registrations || 0],
    ['За 7 дней', overview.registrationsLast7Days || 0],
    ['Материалов', overview.materials || 0],
    ['Рассылок', overview.announcements || 0],
  ];
  return h`<section class="admin-section active" data-admin-panel="overview"><div class="admin-metric-grid">${cards.map(function (card) {
    return h`<div class="admin-metric"><span>${card[0]}</span><strong>${card[1]}</strong></div>`;
  })}</div>${buildOverviewLists(overview)}</section>`;
}

export function buildApplicationsSection(applications) {
  if (!applications.length) {
    return h`<section class="admin-section" data-admin-panel="applications"><h3 class="section-label">Заявки на регистрацию</h3><div class="list-state">Новых заявок нет.</div></section>`;
  }
  return h`<section class="admin-section" data-admin-panel="applications"><h3 class="section-label">Заявки на регистрацию</h3><div class="admin-card-list">${applications.map(function (item) {
    return h`<div class="admin-list-card admin-application-card"><strong>${item.name}</strong><p>${item.email}${
      item.phone ? ' • ' + item.phone : ''
    }</p><small>${item.status === 'rejected' ? 'Отклонена' : 'Ожидает решения'} • ${formatAdminDate(
      item.createdAt
    )}</small><div class="admin-application-actions"><button class="save-btn approve-application-btn" data-id="${
      item.id
    }">Одобрить</button><button class="ghost-btn reject-application-btn" data-id="${
      item.id
    }">Отклонить</button></div></div>`;
  })}</div></section>`;
}

export function buildOverviewLists(overview) {
  var upcoming = overview.upcomingEvents || [];
  var top = overview.topEvents || [];
  return h`<div class="admin-overview-lists"><div class="admin-list-card"><strong>Ближайшие опубликованные мероприятия</strong>${
    upcoming.length
      ? h`<ul class="admin-mini-list">${upcoming.map(function (ev) {
          return h`<li><span>${ev.title}</span><small>${ev.date || 'Дата не указана'}</small></li>`;
        })}</ul>`
      : h`<p>Пока нет опубликованных мероприятий. Опубликуйте событие в разделе «Мероприятия».</p>`
  }</div><div class="admin-list-card"><strong>Топ мероприятий по регистрациям</strong>${
    top.length
      ? h`<ul class="admin-mini-list">${top.map(function (ev) {
          return h`<li><span>${ev.title}</span><small>Регистраций: ${ev.registrationsCount || 0}</small></li>`;
        })}</ul>`
      : h`<p>Регистраций пока нет. После первых записей здесь появится рейтинг мероприятий.</p>`
  }</div></div>`;
}

export function buildDirectorsSection(users) {
  var rows = users.length
    ? users.map(function (u) {
        var acts = (u.lastActivities || []).map(function (a) { return h`${a.description} (+${a.points})`; });
        var actsCell = acts.length ? raw(acts.map(String).join('<br>')) : '—';
        return h`<tr><td>${u.name}</td><td>${u.email}</td><td><strong>${u.totalScore}</strong></td><td>${u.public ? 'Да' : 'Нет'}</td><td><small>${actsCell}</small></td></tr>`;
      })
    : h`<tr><td colspan="5" class="list-state">Директора пока не зарегистрированы.</td></tr>`;
  return h`<section class="admin-section" data-admin-panel="directors"><h3 class="section-label">Рейтинг директоров</h3><div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Директор</th><th>Email</th><th>Рейтинг</th><th>Публичный</th><th>Активности</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function buildEventsSection(events) {
  var rows = events.length
    ? events.map(function (ev) {
        return h`<tr><td>${ev.title}</td><td>${ev.date || '—'}</td><td>${getEventStatusLabel(ev.status)}</td><td>${ev.creator || '—'}${
          ev.creatorEmail ? h`<br><small>${ev.creatorEmail}</small>` : ''
        }</td><td>${ev.registrationsCount}</td><td>${ev.max || '—'}</td><td><button class="ghost-btn edit-event-btn" data-id="${ev.id}">Редактировать</button> <button class="ghost-btn view-participants-btn" data-event-key="event:${ev.id}">Участники</button> <button class="ghost-btn export-event-participants-btn" data-event-key="event:${ev.id}">CSV участников</button> <button class="ghost-btn archive-event-btn" data-id="${ev.id}">В архив</button></td></tr>`;
      })
    : h`<tr><td colspan="7" class="list-state">Мероприятий пока нет. Создайте первое событие в разделе «Мероприятия».</td></tr>`;
  return h`<section class="admin-section" data-admin-panel="events"><h3 class="section-label">Управление мероприятиями</h3><div class="admin-form-card"><input type="hidden" id="adminEventId"><div class="form-group"><label class="form-label">Название</label><input id="adminEventTitle" type="text"></div><div class="form-group"><label class="form-label">Дата и время</label><input id="adminEventDate" type="text" placeholder="Например: 2026-06-20 14:00"></div><div class="form-group"><label class="form-label">Описание</label><textarea id="adminEventDescription" rows="2"></textarea></div><div class="form-group"><label class="form-label">Максимум участников</label><input id="adminEventMax" type="number" min="1"></div><div class="form-group"><label class="form-label">Статус</label><select id="adminEventStatus"><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option></select></div><button class="save-btn" id="saveAdminEventBtn">Сохранить мероприятие</button><button class="ghost-btn" id="resetAdminEventBtn" style="margin-top:8px;">Очистить</button></div><div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Название</th><th>Дата</th><th>Статус</th><th>Организатор</th><th>Регистраций</th><th>Максимум</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function buildRegistrationsSection(registrations) {
  var sourceOptions = uniqueSorted(registrations.map(function (r) { return r.source; }));
  var eventOptions = uniqueSorted(registrations.map(function (r) { return r.eventTitle; }));
  var cityOptions = uniqueSorted(registrations.map(function (r) { return r.city; }).filter(Boolean));
  var option = function (v) { return h`<option value="${v}">${v}</option>`; };
  var filters = h`<section class="admin-section" data-admin-panel="registrations"><h3 class="section-label">Регистрации</h3><div class="admin-filter-row"><select id="registrationSourceFilter"><option value="">Все разделы</option>${sourceOptions.map(option)}</select><select id="registrationEventFilter"><option value="">Все мероприятия</option>${eventOptions.map(option)}</select><select id="registrationCityFilter"><option value="">Все города</option>${cityOptions.map(option)}</select><input id="registrationDateFromFilter" type="date" aria-label="Дата регистрации от"><input id="registrationDateToFilter" type="date" aria-label="Дата регистрации до"><input id="registrationEventKeyFilter" type="hidden"><button class="ghost-btn" id="resetRegistrationFiltersBtn">Сбросить</button></div><div class="admin-export-row"><button class="save-btn" id="exportRegistrationsBtn">Выгрузить текущую выборку CSV</button><span id="registrationsFilterSummary"></span></div>`;
  if (!registrations.length) {
    return h`${filters}<div class="list-state">Регистраций пока нет. Когда участники начнут записываться, здесь появится таблица и CSV-выгрузка.</div></section>`;
  }
  return h`${filters}<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Раздел</th><th>Мероприятие</th><th>Дата</th><th>Участник</th><th>Телефон</th><th>Школа</th><th>Город</th><th>Зарегистрировал</th><th>Действия</th></tr></thead><tbody id="adminRegistrationsBody"></tbody></table></div></section>`;
}

export function buildMaterialsSection(materials, events) {
  var eventOptions = h`<option value="">Без привязки</option>${events.map(function (ev) {
    return h`<option value="${String(ev.id)}">${ev.title}</option>`;
  })}`;
  var categoryOptions = uniqueSorted(materials.map(function (m) { return m.category; }));
  var typeOptions = uniqueSorted(materials.map(function (m) { return m.materialType; }));
  var form = h`<section class="admin-section" data-admin-panel="materials"><h3 class="section-label">Материалы семинаров</h3><div class="admin-form-card"><input type="hidden" id="materialId"><div class="form-group"><label class="form-label">Название</label><input id="materialTitle" type="text"></div><div class="form-group"><label class="form-label">Описание</label><textarea id="materialDescription" rows="2"></textarea></div><div class="form-group"><label class="form-label">Ссылка</label><input id="materialUrl" type="url" placeholder="https://..."></div><div class="form-group"><label class="form-label">Категория</label><select id="materialCategory"><option value="gl">Гравитация лидерства</option><option value="internship">Стажировка</option><option value="calendar">Календарь</option><option value="general">Общее</option></select></div><div class="form-group"><label class="form-label">Тип материала</label><select id="materialType"><option value="presentation">Презентация</option><option value="recording">Запись</option><option value="document">Документ</option><option value="link">Ссылка</option></select></div><div class="form-group"><label class="form-label">Мероприятие</label><select id="materialEventId">${eventOptions}</select></div><div class="checkbox-label"><input type="checkbox" id="materialPublished" checked><label for="materialPublished">Опубликовано</label></div><button class="save-btn" id="saveMaterialBtn">Сохранить материал</button><button class="ghost-btn" id="resetMaterialBtn" style="margin-top:8px;">Очистить</button></div>`;
  if (!materials.length) {
    return h`${form}<div class="list-state">Материалов пока нет. Добавьте ссылку на презентацию, запись, документ или полезный ресурс.</div></section>`;
  }
  return h`${form}<div class="admin-filter-row"><select id="materialTypeFilter"><option value="">Все типы</option>${typeOptions.map(function (v) {
    return h`<option value="${v}">${getMaterialTypeLabel(v)}</option>`;
  })}</select><select id="materialCategoryFilter"><option value="">Все категории</option>${categoryOptions.map(function (v) {
    return h`<option value="${v}">${getMaterialCategoryLabel(v)}</option>`;
  })}</select><select id="materialEventFilter"><option value="">Все мероприятия</option>${eventOptions}</select><button class="ghost-btn" id="resetMaterialFiltersBtn">Сбросить</button></div><div class="admin-card-list" id="adminMaterialsList">${materials.map(buildAdminMaterialCard)}</div></section>`;
}

export function buildAdminMaterialCard(m) {
  return h`<div class="admin-list-card" data-material-id="${m.id}" data-material-type="${m.materialType || 'link'}" data-material-category="${m.category || 'general'}" data-material-event="${m.eventId || ''}"><span class="material-type-badge">${getMaterialTypeIcon(m.materialType)} ${getMaterialTypeLabel(m.materialType)}</span><strong>${m.title}</strong><p>${m.description || 'Без описания'}</p><small>${getMaterialCategoryLabel(m.category)} • ${m.published ? 'Опубликовано' : 'Скрыто'}</small><div><a href="${m.url}" target="_blank" rel="noopener">Открыть</a></div><button class="ghost-btn edit-material-btn" data-id="${m.id}">Редактировать</button> <button class="ghost-btn delete-material-btn" data-id="${m.id}">Удалить</button></div>`;
}

export function buildBroadcastsSection(events, announcements) {
  var eventOptions = events.map(function (ev) {
    return h`<option value="event:${ev.id}">Участники: ${ev.title}</option>`;
  });
  return h`<section class="admin-section" data-admin-panel="broadcasts"><h3 class="section-label">Рассылка информации</h3><div class="admin-form-card"><div class="form-group"><label class="form-label">Заголовок</label><input id="announcementTitle" type="text"></div><div class="form-group"><label class="form-label">Текст</label><textarea id="announcementMessage" rows="3"></textarea></div><div class="form-group"><label class="form-label">Аудитория</label><select id="announcementAudience"><option value="all">Все пользователи</option><option value="directors">Все директора</option><option value="category:gl">Участники ГЛ</option><option value="category:internship">Участники стажировок</option><option value="category:calendar">Участники календарных событий</option>${eventOptions}</select></div><button class="save-btn" id="sendAnnouncementBtn">Отправить уведомление</button></div>${buildAnnouncementsHistory(announcements)}</section>`;
}

export function buildAnnouncementsHistory(announcements) {
  if (!announcements.length) {
    return h`<h3 class="section-label" style="margin-top:18px;">История рассылок</h3><div class="list-state">Рассылок пока нет</div>`;
  }
  return h`<h3 class="section-label" style="margin-top:18px;">История рассылок</h3><div class="admin-card-list">${announcements.map(function (item) {
    return h`<div class="admin-list-card"><strong>${item.title}</strong><p>${item.message}</p><small>Аудитория: ${getAudienceLabel(item.audience)} • Получателей: ${item.recipientCount || 0}${
      item.createdBy ? ' • Автор: ' + item.createdBy : ''
    }${item.sentAt ? ' • Отправлено: ' + formatAdminDate(item.sentAt) : ''}</small></div>`;
  })}</div>`;
}

export function bindAdminTabs(container) {
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
