var currentSearchTerm = '';
var __searchTimer = null;
var __currentPage = 1;
var __totalPages = 1;

function renderDirectors(append) {
  if (!append) {
    __currentPage = 1;
    __totalPages = 1;
  }
  var container = document.getElementById('directorsList');
  if (!container) return;
  if (!append) renderDirectorsState(container, 'loading');

  API.getDirectors(currentSearchTerm, __currentPage, 20)
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
      renderDirectorsState(container, 'error', err.message || 'Ошибка загрузки директоров');
    });
}

function renderMentors() {
  var container = document.getElementById('mentorsList');
  if (!container) return;
  renderDirectorsState(container, 'loading');
  API.getMentors()
    .then(function (resp) {
      mentorsCache = resp.mentors;
      if (!mentorsCache.length) {
        renderDirectorsState(container, 'empty', 'Пока нет наставников');
        return;
      }
      container.innerHTML = mentorsCache.map(function (m) { return renderMentorCard(m); }).join('');
    })
    .catch(function (err) {
      renderDirectorsState(container, 'error', err.message || 'Ошибка загрузки наставников');
    });
}
