export function renderProfileView() {
  var el = document.getElementById('profile');
  if (!el) return;
  el.innerHTML =
    '<h2 class="tab-title">Профиль директора</h2>' +
    '<div class="form-group"><label class="form-label">Фото директора</label><input type="file" id="directorPhoto" accept="image/jpeg,image/png,image/webp"><div id="photoPreview" class="photo-preview"></div></div>' +
    '<div class="form-group"><label class="form-label">ФИО полностью</label><input type="text" id="directorName" placeholder="Иванов Иван Иванович"></div>' +
    '<div class="form-group"><label class="form-label">Email</label><input type="email" id="directorEmail" placeholder="director@school.ru"></div>' +
    '<div class="form-group"><label class="form-label">Телефон</label><input type="tel" id="directorPhone" placeholder="+7 (999) 999-99-99"><div class="checkbox-label"><input type="checkbox" id="phonePublicCheckbox"><label for="phonePublicCheckbox">Показывать мой телефон другим директорам</label></div><div class="form-hint">Если выключено, номер виден только вам и администратору.</div></div>' +
    '<div class="form-group"><label class="form-label">MAX (ссылка или username)</label><input type="text" id="directorMax" placeholder="https://max.ru/username или username"></div>' +
    '<div class="form-group max-link-block" id="maxLinkBlock" hidden>' +
    '<label class="form-label">Уведомления и коды в MAX</label>' +
    '<div id="maxLinkStatus" class="max-link-status">Проверка статуса…</div>' +
    '<button type="button" class="add-btn" id="maxLinkBtn" hidden>Привязать MAX</button>' +
    '<button type="button" class="add-btn" id="maxUnlinkBtn" hidden>Отвязать MAX</button>' +
    '</div>' +
    '<h3 class="section-label">Мои сильные стороны</h3><div id="strengthsList"></div>' +
    '<button class="add-btn" id="addStrengthBtn">+ Добавить качество</button>' +
    '<h3 class="section-label">Профессиональные навыки</h3><div id="skillsList"></div>' +
    '<button class="add-btn" id="addSkillBtn">+ Добавить навык</button>' +
    '<h3 class="section-label">Уникальный опыт</h3><div class="form-group"><textarea id="uniqueExperience" rows="3" placeholder="Расскажите о вашем уникальном профессиональном опыте..."></textarea></div>' +
    '<h3 class="section-label">Личные интересы</h3><div class="form-group"><textarea id="personalInterests" rows="3" placeholder="Ваши хобби, увлечения и интересы..."></textarea></div>' +
    '<div class="checkbox-label"><input type="checkbox" id="mentorCheckbox"><label for="mentorCheckbox">Готов стать наставником будущих лидеров в сфере образования</label></div>' +
    '<div class="checkbox-label"><input type="checkbox" id="consentCheckbox"><label for="consentCheckbox">Согласен на обработку персональных данных</label></div>' +
    '<button class="save-btn" id="saveProfileBtn">Сохранить профиль</button><div id="ratingDisplay"></div>';
}
