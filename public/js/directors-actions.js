function bindDirectorActions(container) {
  container.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var d = directorsCache.find(function (x) { return String(x.id) === String(id); });
      if (d) showDirectorDetail(d);
    });
  });
  container.querySelectorAll('[data-action="contact"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-name');
      var id = btn.getAttribute('data-id');
      showMessageModal(parseInt(id, 10), name);
    });
  });
  container.querySelectorAll('[data-action="favorite"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      API.toggleDirectorFavorite(id)
        .then(function (resp) {
          btn.classList.toggle('active', !!resp.isFavorite);
          btn.setAttribute('aria-pressed', resp.isFavorite ? 'true' : 'false');
          btn.textContent = resp.isFavorite ? '★ В избранном' : '☆ В избранное';
          if (window.__directorSegment === 'favorites' && !resp.isFavorite) {
            renderDirectors(false);
          }
        })
        .catch(function (err) {
          notify(err.message || 'Не удалось обновить избранное');
        });
    });
  });
  var loadMore = document.getElementById('loadMoreBtn');
  if (loadMore) {
    loadMore.addEventListener('click', function () {
      __currentPage++;
      renderDirectors(true);
    });
  }
}

function bindDirectorSearch() {
  var input = document.getElementById('directorSearchInput');
  if (!input) return;
  if (input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  input.addEventListener('input', function (e) {
    currentSearchTerm = e.target.value.trim();
    if (__searchTimer) clearTimeout(__searchTimer);
    __searchTimer = setTimeout(function () {
      renderDirectors(false);
    }, 250);
  });
}
