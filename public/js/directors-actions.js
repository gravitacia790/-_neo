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
  input.addEventListener('input', function (e) {
    currentSearchTerm = e.target.value.trim();
    if (__searchTimer) clearTimeout(__searchTimer);
    __searchTimer = setTimeout(function () {
      renderDirectors(false);
    }, 250);
  });
}
