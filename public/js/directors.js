/* global getUiErrorMessage, retryPromise, isRetriableApiError */
var DIRECTOR_SEGMENT_KEY = 'directors.segment';
var DIRECTOR_FAVORITES_SORT_KEY = 'directors.favorites.sort';
var directorsState = APPSTATE.getDirectors();
window.__directorSegment = directorsState.segment;

function normalizeDirectorSegment(segment) {
  if (segment === 'all' || segment === 'mentors' || segment === 'favorites') return segment;
  return 'all';
}

function setDirectorSegment(segment) {
  var normalized = normalizeDirectorSegment(segment);
  APPSTATE.setDirectorsSegment(normalized);
  directorsState = APPSTATE.getDirectors();
  window.__directorSegment = directorsState.segment;
  try {
    localStorage.setItem(DIRECTOR_SEGMENT_KEY, directorsState.segment);
  } catch (_) {
    // ignore storage errors
  }
}

function resetDirectorsEntryState() {
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

function getDirectorsCache() {
  return APPSTATE.getDirectors().cache || [];
}

function renderDirectors(append) {
  directorsState = APPSTATE.getDirectors();
  if (directorsState.segment === 'mentors') return renderMentors();
  if (directorsState.segment === 'favorites') return renderFavoriteDirectors();
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

function renderFavoriteDirectors() {
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

function renderMentors() {
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

function updateDirectorsHint() {
  var hint = document.getElementById('directorsHint');
  var input = document.getElementById('directorSearchInput');
  var toolbar = document.getElementById('favoritesToolbar');
  if (!hint) return;
  directorsState = APPSTATE.getDirectors();
  if (toolbar) toolbar.hidden = directorsState.segment !== 'favorites';
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

function bindFavoritesSort() {
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
