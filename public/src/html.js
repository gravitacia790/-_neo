// Безопасные HTML-шаблоны. Тег `html` экранирует ВСЕ подстановки по умолчанию,
// поэтому забыть экранирование пользовательских данных невозможно.
//
//   container.innerHTML = html`<div class="card">${user.name}</div>`;
//
// Вложенные результаты `html`...`` и массивы таких результатов вставляются как есть
// (не экранируются повторно). Для заведомо доверенного HTML используйте raw().
import { escapeHtml } from './utils.js';

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

function escapeValue(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(escapeValue).join('');
  return escapeHtml(String(v));
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += escapeValue(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

// Пометить строку как доверенный HTML (не экранировать). Применять только к статике
// или к уже безопасно собранному HTML — никогда к пользовательским данным.
export function raw(value) {
  return new SafeHtml(value == null ? '' : String(value));
}

// Экранировать значение и заменить переводы строк на <br> (безопасно).
export function nl2br(value) {
  return new SafeHtml(escapeHtml(value == null ? '' : String(value)).replace(/\n/g, '<br>'));
}

// Присвоить безопасный HTML в element.innerHTML.
export function setHtml(el, content) {
  if (!el) return;
  el.innerHTML = content instanceof SafeHtml ? content.value : escapeHtml(String(content == null ? '' : content));
}

export { SafeHtml };
