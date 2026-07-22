import { API } from './api.js';
import { escapeHtml } from './utils.js';

function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function renderTrack(track) {
  const actions = (track.actions || [])
    .map(function (action) {
      const done = action.status === 'completed';
      return (
        '<li class="development-action' + (done ? ' development-action--done' : '') + '">' +
        '<div><span class="development-action__week">Неделя ' + action.weekNumber + '</span>' +
        '<strong>' + escapeHtml(action.title) + '</strong>' +
        (action.description ? '<p>' + escapeHtml(action.description) + '</p>' : '') +
        '</div>' +
        '<button class="development-action__toggle" data-action-id="' + action.id + '" data-action-status="' + action.status + '">' +
        (done ? 'Вернуть' : 'Отметить') +
        '</button></li>'
      );
    })
    .join('');
  return (
    '<article class="development-track" data-track-id="' + track.id + '">' +
    '<div class="development-track__top"><div><span class="development-eyebrow">Активный трек</span><h3>' + escapeHtml(track.title) + '</h3>' +
    (track.focusArea ? '<p class="development-track__focus">' + escapeHtml(track.focusArea) + '</p>' : '') +
    '</div><div class="development-progress"><strong>' + track.progress + '%</strong><span>пройдено</span></div></div>' +
    (track.outcome ? '<div class="development-outcome"><span>Результат месяца</span><p>' + escapeHtml(track.outcome) + '</p></div>' : '') +
    '<div class="development-progressbar"><span style="width:' + track.progress + '%"></span></div>' +
    '<ol class="development-actions">' + actions + '</ol>' +
    '<form class="development-reflection-form" data-reflection-track="' + track.id + '">' +
    '<label>Рефлексия недели<textarea name="content" rows="2" maxlength="4000" placeholder="Что получилось, что оказалось сложным, какой следующий шаг?"></textarea></label>' +
    '<button class="ghost-btn" type="submit">Сохранить рефлексию</button></form></article>'
  );
}

function bindActions(container, loadDashboard) {
  container.querySelectorAll('[data-action-id]').forEach(function (button) {
    button.addEventListener('click', function () {
      button.disabled = true;
      const status = button.dataset.actionStatus === 'completed' ? 'planned' : 'completed';
      API.updateDevelopmentAction(button.dataset.actionId, status).then(loadDashboard).catch(function (error) {
        window.alert(error.message);
        button.disabled = false;
      });
    });
  });

  container.querySelectorAll('[data-reflection-track]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const content = String(new FormData(form).get('content') || '').trim();
      if (content.length < 2) return;
      const button = form.querySelector('button');
      button.disabled = true;
      API.addDevelopmentReflection(form.dataset.reflectionTrack, content)
        .then(loadDashboard)
        .catch(function (error) {
          window.alert(error.message);
          button.disabled = false;
        });
    });
  });

  const aiForm = container.querySelector('#developmentAiForm');
  if (aiForm) {
    aiForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const input = aiForm.querySelector('textarea');
      const button = aiForm.querySelector('button');
      const requestText = input.value.trim();
      if (requestText.length < 8) return;
      button.disabled = true;
      button.textContent = 'Собираю трек…';
      API.createDevelopmentAiPlan(requestText)
        .then(function () {
          input.value = '';
          return loadDashboard();
        })
        .catch(function (error) {
          window.alert(error.message);
        })
        .finally(function () {
          button.disabled = false;
          button.textContent = 'Создать трек с AI';
        });
    });
  }

  const manualForm = container.querySelector('#developmentManualForm');
  if (manualForm) {
    manualForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const formData = new FormData(manualForm);
      const title = String(formData.get('title') || '').trim();
      if (title.length < 2) return;
      const button = manualForm.querySelector('button');
      button.disabled = true;
      API.createDevelopmentTrack({ title: title, outcome: String(formData.get('outcome') || '').trim() })
        .then(loadDashboard)
        .catch(function (error) {
          window.alert(error.message);
          button.disabled = false;
        });
    });
  }
}

export function renderDevelopmentView() {
  const container = document.getElementById('development');
  if (!container) return;

  function loadDashboard() {
    container.innerHTML = '<div class="list-state">Загружаю ваш трек развития…</div>';
    return API.getDevelopmentDashboard().then(function (data) {
      const tracks = data.tracks || [];
      const reflections = (data.reflections || [])
        .map(function (item) {
          return '<li><strong>' + escapeHtml(item.trackTitle) + '</strong><p>' + escapeHtml(item.content) + '</p><span>' + displayDate(item.createdAt) + '</span></li>';
        })
        .join('');
      container.innerHTML =
        '<section class="development-view">' +
        '<header class="development-hero"><div><span class="development-eyebrow">Персональный AI-наставник</span><h2>Моё развитие</h2><p>Выберите значимую управленческую задачу и превратите её в небольшие практики на месяц.</p></div></header>' +
        '<section class="development-create"><h3>С чего хотите начать?</h3>' +
        '<form id="developmentAiForm"><label>Опишите задачу<textarea rows="3" maxlength="2000" placeholder="Например: хочу увереннее проводить сложные разговоры с педагогами и давать полезную обратную связь."></textarea></label><button class="save-btn" type="submit">Создать трек с AI</button></form>' +
        '<details class="development-manual"><summary>Создать трек самостоятельно</summary><form id="developmentManualForm"><label>Название<input name="title" maxlength="180" placeholder="Например: Сложные разговоры с коллективом" required></label><label>Результат через месяц<textarea name="outcome" rows="2" maxlength="1000" placeholder="Как я пойму, что продвинулся?"></textarea></label><button class="ghost-btn" type="submit">Создать трек</button></form></details></section>' +
        '<section class="development-tracks"><h3>Активные треки</h3>' +
        (tracks.length ? tracks.map(renderTrack).join('') : '<div class="development-empty">Пока нет активного трека. Опишите задачу — AI-наставник предложит первые практические шаги.</div>') +
        '</section>' +
        (reflections ? '<section class="development-reflections"><h3>Последние рефлексии</h3><ul>' + reflections + '</ul></section>' : '') +
        '</section>';
      bindActions(container, loadDashboard);
      return data;
    }).catch(function (error) {
      container.innerHTML = '<div class="list-state">Не удалось загрузить трек: ' + escapeHtml(error.message) + '</div>';
    });
  }

  loadDashboard();
}
