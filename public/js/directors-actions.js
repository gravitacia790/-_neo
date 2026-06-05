function bindDirectorActions(container) {
  function normalizeTelegramLink(rawValue) {
    if (!rawValue) return null;
    var value = String(rawValue).trim();
    if (!value) return null;
    if (/^https:\/\/t\.me\//i.test(value)) return value;
    if (value.charAt(0) === '@') value = value.slice(1);
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(value)) return null;
    return 'https://t.me/' + value;
  }

  function openContactActions(director) {
    if (!director) return;
    var canCall = !!(director.phone && String(director.phone).trim());
    var tgLink = normalizeTelegramLink(director.telegram);
    if (!canCall && !tgLink) {
      notify('Контакты директора пока не указаны');
      return;
    }
    var name = director.name || 'директором';
    if (tgLink) {
      var useTg = window.confirm('Связь с ' + name + ':\nНажмите "ОК" для Telegram или "Отмена" для звонка.');
      if (useTg) {
        window.open(tgLink, '_blank', 'noopener');
        return;
      }
    }
    if (canCall) {
      window.location.href = 'tel:' + String(director.phone).replace(/[^\d+]/g, '');
      return;
    }
    if (tgLink) {
      window.open(tgLink, '_blank', 'noopener');
    }
  }

  container.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var d = directorsCache.find(function (x) { return String(x.id) === String(id); });
      if (d) showDirectorDetail(d);
    });
  });
  container.querySelectorAll('[data-action="contact"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var director = directorsCache.find(function (x) { return String(x.id) === String(id); });
      openContactActions(director);
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
