import { API } from './api.js';
import { APPSTATE } from './core-state.js';
import { bindDirectorActions } from './directors-actions.js';
import { renderDirectorCard } from './directors-ui.js';
import { escapeHtml } from './utils.js';
import { html, raw, setHtml } from './html.js';

var activeConversationId = null;
var assistantRenderId = 0;

function formatInlineMarkdown(value) {
  return String(value || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function formatAssistantText(value) {
  var lines = escapeHtml(value || '').split(/\r?\n/);
  var output = [];
  var paragraph = [];
  var listType = null;

  function closeList() {
    if (listType) {
      output.push('</' + listType + '>');
      listType = null;
    }
  }

  function flushParagraph() {
    if (!paragraph.length) return;
    output.push('<p>' + formatInlineMarkdown(paragraph.join('<br>')) + '</p>');
    paragraph = [];
  }

  lines.forEach(function (line) {
    var heading = line.match(/^#{1,4}\s+(.+)$/);
    var bullet = line.match(/^[-*]\s+(.+)$/);
    var numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      output.push('<h4>' + formatInlineMarkdown(heading[1]) + '</h4>');
      return;
    }
    if (bullet || numbered) {
      flushParagraph();
      var nextType = bullet ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push('<' + listType + '>');
      }
      output.push('<li>' + formatInlineMarkdown((bullet || numbered)[1]) + '</li>');
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      return;
    }
    closeList();
    paragraph.push(line);
  });

  flushParagraph();
  closeList();
  return raw(output.join(''));
}

function appendMessage(container, role, content, matches) {
  if (!container) return;
  var cards = (matches || []).map(function (item) {
    return html`<div class="ai-assistant-match"><div class="ai-assistant-match__reason">${item.reason || 'Подходящий опыт по теме запроса.'}</div>${renderDirectorCard(item.director, { compact: true })}</div>`;
  });
  var message = html`<div class="ai-assistant-message ai-assistant-message--${role}">
    <div class="ai-assistant-message__label">${role === 'user' ? 'Вы' : 'Ассистент'}</div>
    <div class="ai-assistant-message__body">${formatAssistantText(content)}</div>
    ${cards.length ? html`<div class="ai-assistant-matches"><div class="ai-assistant-matches__title">Нашёл подходящих коллег</div>${cards}</div>` : ''}
  </div>`;
  container.insertAdjacentHTML('beforeend', String(message));
  if (matches && matches.length) {
    APPSTATE.setDirectorsCache(matches.map(function (item) { return item.director; }));
    bindDirectorActions(container);
  }
  container.scrollTop = container.scrollHeight;
}

function renderWelcome(container) {
  setHtml(
    container,
    html`<div class="ai-assistant-message ai-assistant-message--assistant">
      <div class="ai-assistant-message__label">Ассистент</div>
      <div class="ai-assistant-message__body">Опишите ситуацию в школе — помогу разобраться, составить план действий или найти коллегу с похожим опытом.</div>
    </div>`
  );
}

function showError(container, error) {
  appendMessage(container, 'assistant', error && error.message ? error.message : 'Не удалось получить ответ. Попробуйте ещё раз.', []);
}

function loadConversation(panel, conversationId, renderId) {
  var messages = panel.querySelector('#aiAssistantMessages');
  if (!messages || !conversationId) return Promise.resolve();
  messages.innerHTML = '<div class="list-state">Загружаю разговор...</div>';
  return API.getAiMessages(conversationId).then(function (data) {
    if (renderId !== assistantRenderId || !document.body.contains(panel)) return;
    messages.innerHTML = '';
    (data.messages || []).forEach(function (item) {
      appendMessage(messages, item.role, item.content, item.metadata && item.metadata.matches ? item.metadata.matches.map(function (director) { return { director: director }; }) : []);
    });
    if (!data.messages || !data.messages.length) renderWelcome(messages);
  });
}

function loadConversationList(panel, renderId) {
  var select = panel.querySelector('#aiAssistantConversation');
  if (!select) return;
  API.getAiConversations().then(function (data) {
    if (renderId !== assistantRenderId || !document.body.contains(panel)) return;
    var conversations = data.conversations || [];
    if (!activeConversationId && conversations.length) activeConversationId = conversations[0].id;
    var options = '<option value="">Новый разговор</option>' + conversations.map(function (item) {
      return '<option value="' + item.id + '">' + String(item.title || 'Разговор').replace(/[&<>"']/g, '') + '</option>';
    }).join('');
    select.innerHTML = options;
    select.value = activeConversationId || '';
    if (activeConversationId) loadConversation(panel, activeConversationId, renderId).catch(function (error) { showError(panel.querySelector('#aiAssistantMessages'), error); });
  }).catch(function () {
    // A new conversation can still be started if history is temporarily unavailable.
  });
}

export function renderAiAssistant(container) {
  if (!container) return;
  assistantRenderId += 1;
  var renderId = assistantRenderId;
  var panel = document.createElement('section');
  panel.className = 'ai-assistant-panel';
  panel.innerHTML = String(html`<div class="ai-assistant-header">
      <div><div class="ai-assistant-eyebrow">Персональный помощник</div><h3>Развиваем школу вместе</h3></div>
      <select id="aiAssistantConversation" class="ai-assistant-conversations" aria-label="Разговор"></select>
    </div>
    <p class="ai-assistant-intro">Можно описать проблему своими словами. Ассистент поможет разложить её по шагам и при необходимости подберёт коллег с похожим опытом.</p>
    <div id="aiAssistantMessages" class="ai-assistant-messages" aria-live="polite"></div>
    <form id="aiAssistantForm" class="ai-assistant-form">
      <textarea id="aiAssistantInput" class="ai-assistant-input" rows="3" maxlength="4000" placeholder="Например: в школе перегружены классные руководители. С чего начать изменения?"></textarea>
      <div class="ai-assistant-form__footer"><span>Не вводите персональные данные учеников</span><button class="save-btn" type="submit">Отправить</button></div>
    </form>`);
  container.insertBefore(panel, container.firstChild);

  var messages = panel.querySelector('#aiAssistantMessages');
  var form = panel.querySelector('#aiAssistantForm');
  var input = panel.querySelector('#aiAssistantInput');
  var submit = form.querySelector('button[type="submit"]');
  var select = panel.querySelector('#aiAssistantConversation');
  renderWelcome(messages);
  loadConversationList(panel, renderId);

  select.addEventListener('change', function () {
    activeConversationId = select.value ? Number(select.value) : null;
    if (activeConversationId) loadConversation(panel, activeConversationId, renderId).catch(function (error) { showError(messages, error); });
    else renderWelcome(messages);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var content = input.value.trim();
    if (content.length < 2) return;
    appendMessage(messages, 'user', content, []);
    input.value = '';
    input.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Думаю...';
    API.sendAiMessage(activeConversationId, content)
      .then(function (response) {
        activeConversationId = response.conversation && response.conversation.id;
        appendMessage(messages, 'assistant', response.message.content, response.matches || []);
        select.value = activeConversationId || '';
        loadConversationList(panel, renderId);
      })
      .catch(function (error) { showError(messages, error); })
      .finally(function () {
        input.disabled = false;
        submit.disabled = false;
        submit.textContent = 'Отправить';
        input.focus();
      });
  });
}
