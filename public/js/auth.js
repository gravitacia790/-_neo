function showLoginModal() {
  var html = '<div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="director@school.ru"></div>' +
    '<div class="form-group"><label>Пароль</label><input type="password" id="loginPassword" placeholder="******"></div>' +
    '<button class="save-btn" id="doLoginBtn">Войти</button>' +
    '<div style="margin-top:10px; font-size:0.8rem; opacity:0.7;">Демо: elena@school11.ru / demo1234</div>';
  var modal = showModal('Вход в аккаунт', html);
  modal.querySelector('#doLoginBtn').onclick = function () {
    var email = modal.querySelector('#loginEmail').value.trim();
    var password = modal.querySelector('#loginPassword').value;
    if (!email || !password) { notify('Заполните все поля'); return; }
    API.login({ email: email, password: password }).then(function (resp) {
      API.setToken(resp.token);
      API.setUser(resp.user);
      modal.remove();
      showMainApp();
    }).catch(function (err) {
      notify(err.message || 'Ошибка входа');
    });
  };
}

function showRegisterModal() {
  var html = '<div class="form-group"><label>ФИО</label><input type="text" id="regName" placeholder="Иванов Иван Иванович"></div>' +
    '<div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="director@school.ru"></div>' +
    '<div class="form-group"><label>Телефон</label><input type="tel" id="regPhone" placeholder="+7 (999) 999-99-99"></div>' +
    '<div class="form-group"><label>Пароль</label><input type="password" id="regPassword" placeholder="минимум 6 символов"></div>' +
    '<button class="save-btn" id="doRegisterBtn">Зарегистрироваться</button>';
  var modal = showModal('Регистрация', html);
  modal.querySelector('#doRegisterBtn').onclick = function () {
    var name = modal.querySelector('#regName').value.trim();
    var email = modal.querySelector('#regEmail').value.trim();
    var phone = modal.querySelector('#regPhone').value.trim();
    var password = modal.querySelector('#regPassword').value;
    if (!name || !email || !password) { notify('Заполните все поля'); return; }
    if (password.length < 6) { notify('Пароль должен быть не менее 6 символов'); return; }
    API.register({ name: name, email: email, phone: phone, password: password }).then(function (resp) {
      API.setToken(resp.token);
      API.setUser(resp.user);
      modal.remove();
      showMainApp();
    }).catch(function (err) {
      notify(err.message || 'Ошибка регистрации');
    });
  };
}

function logout() {
  API.clearToken();
  document.getElementById('splashScreen').style.display = 'flex';
  document.getElementById('mainContent').classList.remove('active');
}
