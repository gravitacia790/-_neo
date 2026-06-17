import { API } from './api.js';
import { APPSTATE } from './core-state.js';
import { normalizeMaxLink, showDirectorDetail } from './directors-detail.js';
import { getDirectorsCache, renderDirectors } from './directors.js';
import { notify, showModal } from './utils.js';
import { html } from './html.js';
export function bindDirectorActions(container) {
  function closeContactModal(overlay) {
    if (overlay && overlay.parentNode) overlay.remove();
  }

  function openContactActions(director) {
    if (!director) return;
    var phone = director.phone ? String(director.phone).trim() : '';
    var canCall = !!phone;
    var maxLink = typeof normalizeMaxLink === 'function' ? normalizeMaxLink(director.telegram) : null;
    if (!canCall && !maxLink) {
      notify('Контакты директора пока не указаны');
      return;
    }

    var name = director.name || 'коллегой';
    var school = director.school ? html`<div class="contact-actions__school">${director.school}</div>` : '';
    var phoneAction = canCall
      ? html`<button class="contact-actions__item contact-actions__item--primary" data-contact-action="phone"><span>Позвонить</span><strong>${phone}</strong></button>`
      : '';
    var maxAction = maxLink
      ? html`<button class="contact-actions__item" data-contact-action="max"><span>Написать в MAX</span><strong>${maxLink.replace('https://max.ru/', 'max.ru/')}</strong></button>`
      : '';

    var overlay = showModal(
      'Связаться за опытом',
      html`<div class="contact-actions" id="contactActionsModal"><p class="contact-actions__lead">Выберите удобный способ связаться с ${name}, чтобы обсудить практику, управленческий опыт или конкретную задачу.</p>${school}<div class="contact-actions__list">${phoneAction}${maxAction}</div></div>`
    );

    var phoneBtn = overlay.querySelector('[data-contact-action="phone"]');
    if (phoneBtn) {
      phoneBtn.addEventListener('click', function () {
        window.location.href = 'tel:' + phone.replace(/[^\d+]/g, '');
        closeContactModal(overlay);
      });
    }
    var maxBtn = overlay.querySelector('[data-contact-action="max"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', function () {
        window.open(maxLink, '_blank', 'noopener');
        closeContactModal(overlay);
      });
    }
    var modal = overlay.querySelector('.modal-content');
    if (modal) {
      modal.classList.add('contact-actions-modal');
    }
  }

  container.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var cache = getDirectorsCache();
      var d = cache.find(function (x) { return String(x.id) === String(id); });
      if (d) showDirectorDetail(d);
    });
  });
  container.querySelectorAll('[data-action="contact"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var cache = getDirectorsCache();
      var director = cache.find(function (x) { return String(x.id) === String(id); });
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
          var segmentState = APPSTATE.getDirectors();
          if (segmentState.segment === 'favorites' && !resp.isFavorite) {
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
      APPSTATE.incrementDirectorsPage();
      renderDirectors(true);
    });
  }
}

export function bindDirectorSearch() {
  var input = document.getElementById('directorSearchInput');
  if (!input) return;
  if (input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  input.addEventListener('input', function (e) {
    APPSTATE.setDirectorsSearchTerm(e.target.value.trim());
    var state = APPSTATE.getDirectors();
    if (state.searchTimer) clearTimeout(state.searchTimer);
    var timerId = setTimeout(function () {
      renderDirectors(false);
    }, 250);
    APPSTATE.setDirectorsSearchTimer(timerId);
  });
}
