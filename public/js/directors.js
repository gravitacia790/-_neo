/* global getUiErrorMessage, retryPromise, isRetriableApiError */
var currentSearchTerm = '';
var __searchTimer = null;
var __currentPage = 1;
var __totalPages = 1;
var DIRECTOR_SEGMENT_KEY = 'directors.segment';
var DIRECTOR_FAVORITES_SORT_KEY = 'directors.favorites.sort';
var __directorSegment = 'all';
var __favoritesSort = 'recent';
window.__directorSegment = __directorSegment;

function normalizeDirectorSegment(segment) {
  if (segment === 'all' || segment === 'mentors' || segment === 'favorites') return segment;
  return 'all';
}

function setDirectorSegment(segment) {
  __directorSegment = normalizeDirectorSegment(segment);
  window.__directorSegment = __directorSegment;
  try {
    localStorage.setItem(DIRECTOR_SEGMENT_KEY, __directorSegment);
  } catch (_) {
    // ignore storage errors
  }
}

function renderDirectors(append) {
  if (__directorSegment === 'mentors') return renderMentors();
  if (__directorSegment === 'favorites') return renderFavoriteDirectors();
  if (!append) {
    __currentPage = 1;
    __totalPages = 1;
  }
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  if (!append) renderDirectorsState(container, 'loading');

  retryPromise(function () {
    return API.getDirectors(currentSearchTerm, __currentPage, 20);
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      __totalPages = resp.pagination.totalPages;
      if (!append) directorsCache = [];
      directorsCache = directorsCache.concat(resp.directors);
      if (!directorsCache.length) {
        renderDirectorsState(container, 'empty', currentSearchTerm ? 'По вашему запросу ничего не найдено' : 'Пока нет участников сообщества');
        return;
      }
      var html = append ? container.getAttribute('data-html') || '' : '';
      resp.directors.forEach(function (d) { html += renderDirectorCard(d); });
      if (__currentPage < __totalPages) {
        html += '<button class="save-btn load-more-btn" id="loadMoreBtn" style="width:100%; margin-top:16px;">Показать ещё (' + (__totalPages - __currentPage) + ' стр.)</button>';
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

function renderFavoriteDirectors() {
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  renderDirectorsState(container, 'loading');
  retryPromise(function () {
    return API.getFavoriteDirectors(__favoritesSort);
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      directorsCache = resp.favorites || [];
      if (currentSearchTerm) {
        var q = currentSearchTerm.toLowerCase();
        directorsCache = directorsCache.filter(function (d) {
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
      if (!directorsCache.length) {
        renderDirectorsState(
          container,
          'empty',
          currentSearchTerm ? 'По вашему запросу в избранном ничего не найдено' : 'В избранном пока пусто'
        );
        return;
      }
      container.innerHTML = directorsCache.map(function (d) { return renderDirectorCard(d, { compact: true }); }).join('');
      container.setAttribute('data-html', container.innerHTML);
      bindDirectorActions(container);
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить избранное.'));
      var retryBtn = container.querySelector('[data-action="retry-directors"]');
      if (retryBtn) retryBtn.addEventListener('click', renderFavoriteDirectors);
    });
}

function renderMentors() {
  var container = document.getElementById('directorsList');
  if (!container) return;
  updateDirectorsHint();
  renderDirectorsState(container, 'loading');
  retryPromise(function () {
    return API.getMentors();
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      directorsCache = resp.mentors || [];
      if (!directorsCache.length) {
        renderDirectorsState(container, 'empty', 'Пока нет наставников');
        return;
      }
      container.innerHTML = directorsCache.map(function (m) { return renderDirectorCard(m); }).join('');
      container.setAttribute('data-html', container.innerHTML);
      bindDirectorActions(container);
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить наставников.'));
      var retryBtn = container.querySelector('[data-action="retry-mentors"]');
      if (retryBtn) retryBtn.addEventListener('click', renderMentors);
    });
}

function bindDirectorSegments() {
  var root = document.getElementById('directorSegments');
  if (!root) return;
  var initialSegment;
  try {
    initialSegment = normalizeDirectorSegment(localStorage.getItem(DIRECTOR_SEGMENT_KEY) || 'all');
  } catch (_) {
    initialSegment = 'all';
  }
  setDirectorSegment(initialSegment);
  root.querySelectorAll('[data-segment]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-segment') === __directorSegment);
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

function updateDirectorsHint() {
  var hint = document.getElementById('directorsHint');
  var input = document.getElementById('directorSearchInput');
  var toolbar = document.getElementById('favoritesToolbar');
  if (!hint) return;
  if (toolbar) toolbar.hidden = __directorSegment !== 'favorites';
  if (__directorSegment === 'favorites') {
    hint.textContent =
      'Избранное: быстрый доступ к важным контактам. Здесь можно искать только среди сохраненных директоров.';
    if (input) input.placeholder = 'Поиск по избранным: имя, школа, тема...';
    return;
  }
  if (__directorSegment === 'mentors') {
    hint.textContent = 'Наставники: директора с открытой экспертной поддержкой.';
    if (input) input.placeholder = 'Поиск наставника по имени, школе, теме...';
    return;
  }
  hint.textContent = 'Все директора: используйте поиск и фильтры для быстрого выбора нужного контакта.';
  if (input) input.placeholder = 'Поиск по имени, школе...';
}

function bindFavoritesSort() {
  var select = document.getElementById('favoritesSortSelect');
  if (!select) return;
  try {
    __favoritesSort = localStorage.getItem(DIRECTOR_FAVORITES_SORT_KEY) || 'recent';
  } catch (_) {
    __favoritesSort = 'recent';
  }
  if (__favoritesSort !== 'name' && __favoritesSort !== 'recent') __favoritesSort = 'recent';
  select.value = __favoritesSort;
  if (select.dataset.bound === 'true') return;
  select.dataset.bound = 'true';
  select.addEventListener('change', function () {
    __favoritesSort = select.value === 'name' ? 'name' : 'recent';
    try {
      localStorage.setItem(DIRECTOR_FAVORITES_SORT_KEY, __favoritesSort);
    } catch (_) {
      // ignore storage errors
    }
    if (__directorSegment === 'favorites') renderFavoriteDirectors();
  });
}
