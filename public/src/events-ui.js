import { getMaterialTypeLabel } from './utils.js';
import { html, setHtml } from './html.js';

export function renderEventsState(container, type, text) {
  if (!container) return;
  if (type === 'loading') {
    setHtml(
      container,
      html`<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`
    );
    return;
  }
  if (type === 'error') {
    setHtml(
      container,
      html`<div class="list-state is-error"><div class="list-state__text">${text}</div><button class="ghost-btn retry-btn" data-action="retry-events">Повторить</button></div>`
    );
    return;
  }
  setHtml(container, html`<div class="list-state">${text}</div>`);
}

export function buildEventCardHtml(ev, meId) {
  var isCreator = ev.creatorId === meId;
  var count = ev.registrations.length;
  var max = Number(ev.max) || 999;
  var percent = Math.min(100, Math.round((count / max) * 100));
  var isFull = count >= max;

  var registrations = ev.registrations.length
    ? html`<div class="registration-list"><strong>Записавшиеся:</strong><ul>${ev.registrations.map(function (r) {
        var canCancel = isCreator || r.registeredBy === meId;
        return html`<li><span>${r.employeeName}</span><small>${r.schoolName}${r.city ? ' • ' + r.city : ''}${r.phone ? ' • ' + r.phone : ''}</small>${
          canCancel
            ? html`<button class="ghost-btn cancel-inline-btn" data-action="cancel-reg" data-event-id="${ev.id}" data-registration-id="${r.id}">Отменить</button>`
            : ''
        }</li>`;
      })}</ul></div>`
    : '';

  var materials =
    ev.materials && ev.materials.length
      ? html`<div class="event-materials"><strong>Материалы после семинара:</strong>${ev.materials.map(function (m) {
          return html`<a href="${m.url}" target="_blank" rel="noopener"><span class="material-type-badge">${getMaterialTypeLabel(
            m.materialType
          )}</span>${m.title}${m.description ? html`<small>${m.description}</small>` : ''}</a>`;
        })}</div>`
      : '';

  var actions = [];
  if (!isCreator && !isFull) actions.push(html`<button data-action="reg" data-id="${ev.id}">📝 Зарегистрироваться</button>`);
  if (!isCreator && isFull) actions.push(html`<button disabled class="is-disabled">Регистрация закрыта</button>`);
  if (isCreator) {
    actions.push(html`<button data-action="edit" data-id="${ev.id}">Редактировать</button>`);
    actions.push(html`<button data-action="del" data-id="${ev.id}" style="background:#ff4757;">🗑 Удалить</button>`);
  }

  return html`<div class="event-card${isFull ? ' is-full' : ''}" data-id="${ev.id}">
    <h3>${ev.title}</h3>
    <div class="date">📅 ${ev.date}</div>
    <p>${ev.description}</p>
    <div class="event-capacity"><div><span>👥 Записалось: ${count} / ${max}</span>${
      isFull ? html`<strong>Мест нет</strong>` : html`<strong>Свободно: ${Math.max(max - count, 0)}</strong>`
    }</div><div class="event-capacity-bar"><i style="width:${percent}%;"></i></div></div>
    <div>👤 Организатор: ${ev.creator} (${ev.creatorSchool})</div>
    ${registrations}${materials}
    <div class="event-actions">${actions}</div>
  </div>`;
}
