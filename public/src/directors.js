import { getUiErrorMessage, isRetriableApiError, retryPromise } from './utils.js';
import { API } from './api.js';
import { APPSTATE } from './core-state.js';
import { bindDirectorActions } from './directors-actions.js';
import { renderDirectorCard, renderDirectorsState } from './directors-ui.js';
import { html, setHtml } from './html.js';
import { renderAiAssistant } from './ai-assistant.js';
export var DIRECTOR_SEGMENT_KEY = 'directors.segment';
export var DIRECTOR_FAVORITES_SORT_KEY = 'directors.favorites.sort';
export var directorsState = APPSTATE.getDirectors();
var aiSearchRequestId = 0;

export function normalizeDirectorSegment(segment) {
  if (segment === 'all' || segment === 'mentors' || segment === 'favorites' || segment === 'ai') return segment;
  return 'all';
}

export function setDirectorSegment(segment) {
  var normalized = normalizeDirectorSegment(segment);
  APPSTATE.setDirectorsSegment(normalized);
  directorsState = APPSTATE.getDirectors();
  try {
    localStorage.setItem(DIRECTOR_SEGMENT_KEY, directorsState.segment);
  } catch (_) {
    // ignore storage errors
  }
}

export function resetDirectorsEntryState() {
  setDirectorSegment('all');
  APPSTATE.setDirectorsSearchTerm('');
  directorsState = APPSTATE.getDirectors();
  var input = document.getElementById('directorSearchInput');
  if (input) input.value = '';
  var root = document.getElementById('directorSegments');
  if (root) {
    root.querySelectorAll('[data-segment]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-segment') === directorsState.segment);
    });
  }
  updateDirectorsHint();
}

export function getDirectorsCache() {
  return APPSTATE.getDirectors().cache || [];
}

function setAiPageMode(isAi) {
  var page = document.getElementById('directors');
  var list = document.getElementById('directorsList');
  if (page) page.classList.toggle('ai-page', !!isAi);
  if (list) list.classList.toggle('ai-directors-mode', !!isAi);
}

export function renderDirectors(append) {
  directorsState = APPSTATE.getDirectors();
  if (directorsState.segment === 'mentors') return renderMentors();
  if (directorsState.segment === 'favorites') return renderFavoriteDirectors();
  if (directorsState.segment === 'ai') return renderAiDirectors();
  setAiPageMode(false);
  if (!append) {
    APPSTATE.resetDirectorsPagination();
    directorsState = APPSTATE.getDirectors();
  }
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  if (!append) renderDirectorsState(container, 'loading');

  retryPromise(function () {
    return API.getDirectors(directorsState.searchTerm, directorsState.page, 20);
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      APPSTATE.setDirectorsPage(directorsState.page, resp.pagination.totalPages);
      if (!append) APPSTATE.setDirectorsCache([]);
      APPSTATE.appendDirectorsCache(resp.directors);
      directorsState = APPSTATE.getDirectors();
      if (!getDirectorsCache().length) {
        renderDirectorsState(container, 'empty', directorsState.searchTerm ? 'По вашему запросу ничего не найдено' : 'Пока нет участников сообщества');
        return;
      }
      var html = append ? container.getAttribute('data-html') || '' : '';
      resp.directors.forEach(function (d) { html += renderDirectorCard(d); });
      if (directorsState.page < directorsState.totalPages) {
        html += '<button class="save-btn load-more-btn" id="loadMoreBtn" style="width:100%; margin-top:16px;">Показать ещё (' + (directorsState.totalPages - directorsState.page) + ' стр.)</button>';
      }
      container.innerHTML = html;
      container.setAttribute('data-html', html);
      bindDirectorActions(container);
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить директоров.'));
      var retryBtn = container.querySelector('[data-action="retry-directors"]');
      if (retryBtn) {
        retryBtn.addEventListener('click', function () {
          renderDirectors(false);
        });
      }
    });
}

export function renderFavoriteDirectors() {
  setAiPageMode(false);
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  renderDirectorsState(container, 'loading');
  retryPromise(function () {
    return API.getFavoriteDirectors(directorsState.favoritesSort);
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      var filteredDirectors = resp.favorites || [];
      if (directorsState.searchTerm) {
        var q = directorsState.searchTerm.toLowerCase();
        filteredDirectors = filteredDirectors.filter(function (d) {
          var haystack = [
            d.name,
            d.school,
            d.city,
            d.useful,
            d.wantToKnow,
            (d.tags || []).join(' '),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.indexOf(q) !== -1;
        });
      }
      APPSTATE.setDirectorsCache(filteredDirectors);
      if (!filteredDirectors.length) {
        renderDirectorsState(
          container,
          'empty',
          directorsState.searchTerm ? 'По вашему запросу в избранном ничего не найдено' : 'В избранном пока пусто'
        );
        return;
      }
      container.innerHTML = filteredDirectors.map(function (d) { return renderDirectorCard(d, { compact: true }); }).join('');
      container.setAttribute('data-html', container.innerHTML);
      bindDirectorActions(container);
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить избранное.'));
      var retryBtn = container.querySelector('[data-action="retry-directors"]');
      if (retryBtn) retryBtn.addEventListener('click', renderFavoriteDirectors);
    });
}

export function renderMentors() {
  setAiPageMode(false);
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  renderDirectorsState(container, 'loading');
  retryPromise(function () {
    return API.getMentors();
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      var mentors = resp.mentors || [];
      APPSTATE.setDirectorsCache(mentors);
      if (!mentors.length) {
        renderDirectorsState(container, 'empty', 'Пока нет наставников');
        return;
      }
      container.innerHTML = mentors.map(function (m) { return renderDirectorCard(m); }).join('');
      container.setAttribute('data-html', container.innerHTML);
      bindDirectorActions(container);
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить наставников.'));
      var retryBtn = container.querySelector('[data-action="retry-mentors"]');
      if (retryBtn) retryBtn.addEventListener('click', renderMentors);
    });
}

export function renderAiDirectors() {
  setAiPageMode(true);
  var container = document.getElementById('directorsList');
  if (!container) return;
  aiSearchRequestId += 1;
  updateDirectorsHint();
  APPSTATE.setDirectorsCache([]);
  setHtml(
    container,
    html`<div class="ai-search-panel">
      ${
        API.isAdmin()
          ? html`<div class="ai-admin-tools"><button class="ghost-btn" type="button" id="aiReindexAllBtn">Обновить AI-индекс</button><span id="aiReindexStatus" class="ai-admin-status"></span></div>`
          : ''
      }
      <form id="aiDirectorSearchForm" class="ai-search-form">
        <label class="ai-search-label" for="aiDirectorQuery">Опишите задачу, по которой нужен опыт коллеги</label>
        <textarea id="aiDirectorQuery" class="ai-search-textarea" rows="4" maxlength="1000" placeholder="Например: нужно запустить инженерные классы, выстроить наставничество педагогов или подготовиться к аккредитации"></textarea>
        <button class="save-btn ai-search-submit" type="submit">Найти коллег</button>
      </form>
      <div id="aiDirectorResults" class="ai-search-results"></div>
    </div>`
  );
  renderAiAssistant(container);

  var form = document.getElementById('aiDirectorSearchForm');
  var textarea = document.getElementById('aiDirectorQuery');
  var results = document.getElementById('aiDirectorResults');
  var submitBtn = form ? form.querySelector('.ai-search-submit') : null;
  var reindexBtn = document.getElementById('aiReindexAllBtn');
  var reindexStatus = document.getElementById('aiReindexStatus');
  if (reindexBtn) {
    reindexBtn.addEventListener('click', function () {
      reindexBtn.disabled = true;
      if (reindexStatus) reindexStatus.textContent = 'Обновляем профили...';
      API.reindexAllAi()
        .then(function () {
          if (reindexStatus) reindexStatus.textContent = 'AI-индекс обновлён';
        })
        .catch(function (err) {
          if (reindexStatus) reindexStatus.textContent = err.message || 'Не удалось обновить AI-индекс';
        })
        .finally(function () {
          reindexBtn.disabled = false;
        });
    });
  }
  if (!form || !textarea || !results) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var query = textarea.value.trim();
    if (query.length < 8) {
      setHtml(results, html`<div class="list-state is-error">Опишите задачу чуть подробнее.</div>`);
      return;
    }
    var requestId = aiSearchRequestId + 1;
    aiSearchRequestId = requestId;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Ищем коллег...';
    }
    textarea.disabled = true;
    setHtml(results, html`<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`);
    API.searchAiDirectors(query)
      .then(function (resp) {
        if (requestId !== aiSearchRequestId || APPSTATE.getDirectors().segment !== 'ai' || !document.body.contains(results)) return;
        var matches = resp.matches || [];
        APPSTATE.setDirectorsCache(matches.map(function (m) { return m.director; }));
        var intentBlock = resp.intent
          ? html`<div class="ai-intent">
              <div><strong>Как AI понял задачу:</strong> ${resp.intent.task}</div>
              <div class="ai-intent-keywords">Темы поиска: ${(resp.intent.keywords || []).join(', ')}</div>
            </div>`
          : '';
        if (!matches.length) {
          setHtml(results, html`${intentBlock}<div class="list-state">Подходящих коллег пока не найдено. Попробуйте описать задачу другими словами.</div>`);
          return;
        }
        setHtml(
          results,
          html`${intentBlock}${matches.map(function (m) {
            return html`<div class="ai-match-card">
              <div class="ai-match-reason"><strong>Почему подходит:</strong> ${m.reason || 'Профиль близок к вашему запросу по смыслу.'}</div>
              ${renderDirectorCard(m.director, { compact: true })}
            </div>`;
          })}`
        );
        bindDirectorActions(results);
      })
      .catch(function (err) {
        if (requestId !== aiSearchRequestId || APPSTATE.getDirectors().segment !== 'ai' || !document.body.contains(results)) return;
        setHtml(results, html`<div class="list-state is-error">${err.message || 'AI-поиск временно недоступен.'}</div>`);
      })
      .finally(function () {
        if (requestId !== aiSearchRequestId || !document.body.contains(results)) return;
        textarea.disabled = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Найти коллег';
        }
      });
  });
}

export function bindDirectorSegments() {
  var root = document.getElementById('directorSegments');
  if (!root) return;
  var initialSegment;
  try {
    initialSegment = normalizeDirectorSegment(localStorage.getItem(DIRECTOR_SEGMENT_KEY) || 'all');
  } catch (_) {
    initialSegment = 'all';
  }
  setDirectorSegment(initialSegment);
  directorsState = APPSTATE.getDirectors();
  root.querySelectorAll('[data-segment]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-segment') === directorsState.segment);
  });
  updateDirectorsHint();

  root.querySelectorAll('[data-segment]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setDirectorSegment(btn.getAttribute('data-segment'));
      root.querySelectorAll('[data-segment]').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderDirectors(false);
    });
  });
}

export function updateDirectorsHint() {
  var hint = document.getElementById('directorsHint');
  var input = document.getElementById('directorSearchInput');
  var toolbar = document.getElementById('favoritesToolbar');
  var searchContainer = document.getElementById('directorSearchContainer');
  if (!hint) return;
  directorsState = APPSTATE.getDirectors();
  if (toolbar) toolbar.hidden = directorsState.segment !== 'favorites';
  if (searchContainer) searchContainer.hidden = directorsState.segment === 'ai';
  if (directorsState.segment === 'ai') {
    hint.textContent = 'AI: опишите задачу, и система подберёт директоров с похожим реализованным опытом.';
    return;
  }
  if (directorsState.segment === 'favorites') {
    hint.textContent =
      'Избранное: быстрый доступ к важным контактам. Здесь можно искать только среди сохраненных директоров.';
    if (input) input.placeholder = 'Поиск по избранным: имя, школа, тема...';
    return;
  }
  if (directorsState.segment === 'mentors') {
    hint.textContent = 'Наставники: директора с открытой экспертной поддержкой.';
    if (input) input.placeholder = 'Поиск наставника по имени, школе, теме...';
    return;
  }
  hint.textContent = 'Все директора: используйте поиск и фильтры для быстрого выбора нужного контакта.';
  if (input) input.placeholder = 'Поиск по имени, школе...';
}

export function bindFavoritesSort() {
  var select = document.getElementById('favoritesSortSelect');
  if (!select) return;
  try {
    APPSTATE.setDirectorsFavoritesSort(localStorage.getItem(DIRECTOR_FAVORITES_SORT_KEY) || 'recent');
  } catch (_) {
    APPSTATE.setDirectorsFavoritesSort('recent');
  }
  directorsState = APPSTATE.getDirectors();
  if (directorsState.favoritesSort !== 'name' && directorsState.favoritesSort !== 'recent') {
    APPSTATE.setDirectorsFavoritesSort('recent');
    directorsState = APPSTATE.getDirectors();
  }
  select.value = directorsState.favoritesSort;
  if (select.dataset.bound === 'true') return;
  select.dataset.bound = 'true';
  select.addEventListener('change', function () {
    APPSTATE.setDirectorsFavoritesSort(select.value === 'name' ? 'name' : 'recent');
    directorsState = APPSTATE.getDirectors();
    try {
      localStorage.setItem(DIRECTOR_FAVORITES_SORT_KEY, directorsState.favoritesSort);
    } catch (_) {
      // ignore storage errors
    }
    if (directorsState.segment === 'favorites') renderFavoriteDirectors();
  });
}
