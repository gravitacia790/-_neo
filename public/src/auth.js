import { API } from './api.js';
import { showMainApp, showSplash } from './app.js';
import { APPSTATE } from './core-state.js';
import { NOTIF } from './notifications.js';
import { feedbackDialog, notify, showModal } from './utils.js';
import { html as h } from './html.js';
import { WS } from './ws.js';
export function clearFieldErrors(modal) {
  modal.querySelectorAll('.field-error').forEach(function (el) {
    el.classList.remove('field-error');
  });
  modal.querySelectorAll('.field-error-text').forEach(function (el) {
    el.remove();
  });
  var box = modal.querySelector('.modal-error-box');
  if (box) box.remove();
}

export function showFieldError(modal, selector, message) {
  var input = modal.querySelector(selector);
  if (!input) return;
  input.classList.add('field-error');
  var text = document.createElement('div');
  text.className = 'field-error-text';
  text.textContent = message;
  input.insertAdjacentElement('afterend', text);
}

export function showModalError(modal, message) {
  var box = document.createElement('div');
  box.className = 'modal-error-box';
  box.textContent = message;
  var title = modal.querySelector('.modal-content h2');
  if (title) title.insertAdjacentElement('afterend', box);
}

export function setBusy(button, busyText, isBusy) {
  if (!button) return;
  if (isBusy) {
    button.dataset.defaultText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    return;
  }
  button.disabled = false;
  if (button.dataset.defaultText) button.textContent = button.dataset.defaultText;
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function attachInputCleanup(modal) {
  modal.querySelectorAll('input').forEach(function (input) {
    input.addEventListener('input', function () {
      input.classList.remove('field-error');
      var next = input.nextElementSibling;
      if (next && next.classList.contains('field-error-text')) next.remove();
      var box = modal.querySelector('.modal-error-box');
      if (box) box.remove();
    });
  });
}

export function showLoginModal() {
  var html =
    '<div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="director@school.ru"></div>' +
    '<div class="form-group"><label>Пароль</label><input type="password" id="loginPassword" placeholder="******"></div>' +
    '<button class="save-btn" id="doLoginBtn">Войти</button>' +
    '<div style="margin-top:8px; text-align:center;"><a href="#" id="forgotPasswordLink" style="font-size:0.8rem;color:var(--crimson);">Забыли пароль?</a></div>' +
    '<div style="margin-top:8px; font-size:0.8rem; opacity:0.7;">Демо: elena@school11.ru / demo1234</div>';
  var modal = showModal('Вход в аккаунт', html);
  var btn = modal.querySelector('#doLoginBtn');
  attachInputCleanup(modal);

  btn.onclick = function () {
    clearFieldErrors(modal);
    var email = modal.querySelector('#loginEmail').value.trim();
    var password = modal.querySelector('#loginPassword').value;
    var hasError = false;
    if (!email) {
      showFieldError(modal, '#loginEmail', 'Введите email');
      hasError = true;
    } else if (!validateEmail(email)) {
      showFieldError(modal, '#loginEmail', 'Неверный формат email');
      hasError = true;
    }
    if (!password) {
      showFieldError(modal, '#loginPassword', 'Введите пароль');
      hasError = true;
    }
    if (hasError) return;

    setBusy(btn, 'Вход...', true);
    API.login({ email: email, password: password })
      .then(function (resp) {
        API.setUser(resp.user);
        modal.remove();
        showMainApp();
      })
      .catch(function (err) {
        showModalError(modal, err.message || 'Ошибка входа');
      })
      .finally(function () {
        setBusy(btn, '', false);
      });
  };

  modal.querySelector('#forgotPasswordLink').onclick = function (e) {
    e.preventDefault();
    modal.remove();
    showForgotPasswordModal();
  };
}

export function showForgotPasswordModal() {
  var html =
    '<div class="form-group"><label>Ваш email</label><input type="email" id="forgotEmail" placeholder="director@school.ru"></div>' +
    '<button class="save-btn" id="doForgotBtn">Получить код</button>' +
    '<div class="modal-hint">Код для сброса пароля придёт на указанную при регистрации почту. Действует 10 минут.</div>' +
    '<div style="margin-top:8px; text-align:center;"><a href="#" id="backToLoginLink" style="font-size:0.8rem;color:var(--crimson);">Вернуться ко входу</a></div>';
  var modal = showModal('Сброс пароля', html);
  var btn = modal.querySelector('#doForgotBtn');
  attachInputCleanup(modal);

  btn.onclick = function () {
    clearFieldErrors(modal);
    var email = modal.querySelector('#forgotEmail').value.trim();
    if (!email) return showFieldError(modal, '#forgotEmail', 'Укажите email');
    if (!validateEmail(email)) return showFieldError(modal, '#forgotEmail', 'Неверный формат email');

    setBusy(btn, 'Отправка...', true);
    API.forgotPassword(email)
      .then(function (resp) {
        modal.remove();
        // resp.code приходит только вне production (dev/тесты), чтобы подставить автоматически.
        showResetPasswordModal(email, resp && resp.code);
      })
      .catch(function (err) {
        showModalError(modal, err.message || 'Ошибка отправки');
      })
      .finally(function () {
        setBusy(btn, '', false);
      });
  };

  modal.querySelector('#backToLoginLink').onclick = function (e) {
    e.preventDefault();
    modal.remove();
    showLoginModal();
  };
}

export function showResetPasswordModal(email, devCode) {
  var html = h`<div class="modal-hint">Код отправлен на ${email || ''}</div><div class="form-group"><label>Код из письма</label><input type="text" inputmode="numeric" maxlength="6" id="resetCode" placeholder="6 цифр" value="${devCode || ''}"></div><div class="form-group"><label>Новый пароль</label><input type="password" id="resetPassword" placeholder="минимум 6 символов"></div><div class="form-group"><label>Повторите пароль</label><input type="password" id="resetPasswordConfirm" placeholder="******"></div><button class="save-btn" id="doResetBtn">Сохранить пароль</button>`;
  var modal = showModal('Новый пароль', html);
  var btn = modal.querySelector('#doResetBtn');
  attachInputCleanup(modal);

  btn.onclick = function () {
    clearFieldErrors(modal);
    var code = modal.querySelector('#resetCode').value.trim();
    var pw = modal.querySelector('#resetPassword').value;
    var pw2 = modal.querySelector('#resetPasswordConfirm').value;
    var hasError = false;
    if (!/^\d{6}$/.test(code)) {
      showFieldError(modal, '#resetCode', 'Введите 6-значный код из письма');
      hasError = true;
    }
    if (!pw) {
      showFieldError(modal, '#resetPassword', 'Введите новый пароль');
      hasError = true;
    } else if (pw.length < 6) {
      showFieldError(modal, '#resetPassword', 'Минимум 6 символов');
      hasError = true;
    }
    if (!pw2) {
      showFieldError(modal, '#resetPasswordConfirm', 'Повторите пароль');
      hasError = true;
    } else if (pw !== pw2) {
      showFieldError(modal, '#resetPasswordConfirm', 'Пароли не совпадают');
      hasError = true;
    }
    if (hasError) return;

    setBusy(btn, 'Сохранение...', true);
    API.resetPassword(email, code, pw)
      .then(function () {
        modal.remove();
        notify('Пароль изменён. Теперь войдите заново.');
        showLoginModal();
      })
      .catch(function (err) {
        showModalError(modal, err.message || 'Ошибка смены пароля');
      })
      .finally(function () {
        setBusy(btn, '', false);
      });
  };
}

export function showRegisterModal() {
  var html =
    '<div class="form-group"><label>ФИО</label><input type="text" id="regName" placeholder="Иванов Иван Иванович"></div>' +
    '<div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="director@school.ru"></div>' +
    '<div class="form-group"><label>Телефон</label><input type="tel" id="regPhone" placeholder="+7 (999) 999-99-99"></div>' +
    '<div class="form-group"><label>Пароль</label><input type="password" id="regPassword" placeholder="минимум 6 символов"></div>' +
    '<button class="save-btn" id="doRegisterBtn">Зарегистрироваться</button>';
  var modal = showModal('Регистрация', html);
  var btn = modal.querySelector('#doRegisterBtn');
  attachInputCleanup(modal);

  btn.onclick = function () {
    clearFieldErrors(modal);
    var name = modal.querySelector('#regName').value.trim();
    var email = modal.querySelector('#regEmail').value.trim();
    var phone = modal.querySelector('#regPhone').value.trim();
    var password = modal.querySelector('#regPassword').value;
    var hasError = false;
    if (!name) {
      showFieldError(modal, '#regName', 'Введите ФИО');
      hasError = true;
    }
    if (!email) {
      showFieldError(modal, '#regEmail', 'Введите email');
      hasError = true;
    } else if (!validateEmail(email)) {
      showFieldError(modal, '#regEmail', 'Неверный формат email');
      hasError = true;
    }
    if (!password) {
      showFieldError(modal, '#regPassword', 'Введите пароль');
      hasError = true;
    } else if (password.length < 6) {
      showFieldError(modal, '#regPassword', 'Минимум 6 символов');
      hasError = true;
    }
    if (hasError) return;

    setBusy(btn, 'Регистрация...', true);
    API.register({ name: name, email: email, phone: phone, password: password })
      .then(function (resp) {
        modal.remove();
        return feedbackDialog({
          title: 'Заявка отправлена',
          message:
            (resp && resp.message) ||
            'Администратор проверит данные. После подтверждения вы сможете войти в приложение.',
        }).then(showLoginModal);
      })
      .catch(function (err) {
        if (err && err.data && Array.isArray(err.data.details)) {
          err.data.details.forEach(function (issue) {
            if (issue.path && issue.path[0] === 'name') showFieldError(modal, '#regName', issue.message);
            if (issue.path && issue.path[0] === 'email') showFieldError(modal, '#regEmail', issue.message);
            if (issue.path && issue.path[0] === 'password') showFieldError(modal, '#regPassword', issue.message);
          });
        }
        showModalError(modal, err.message || 'Ошибка регистрации');
      })
      .finally(function () {
        setBusy(btn, '', false);
      });
  };
}

export function logout() {
  WS.disconnect();
  NOTIF.closeDropdown();
  var directorsState = typeof APPSTATE !== 'undefined' ? APPSTATE.getDirectors() : null;
  if (directorsState && directorsState.searchTimer) {
    clearTimeout(directorsState.searchTimer);
    APPSTATE.setDirectorsSearchTimer(null);
  }
  API.logout()
    .catch(function () {})
    .then(function () {
      API.clearUser();
      showSplash();
    });
}
