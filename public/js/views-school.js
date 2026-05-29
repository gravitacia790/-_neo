function renderSchoolView() {
  var el = document.getElementById('school');
  if (!el) return;
  el.innerHTML =
    '<h2 class="tab-title">Информация о школе</h2>' +
    '<div id="schoolView" class="info-card" style="display:none;"></div>' +
    '<div id="schoolForm">' +
    '<div class="form-group"><label class="form-label">Полное название школы</label><input type="text" id="schoolName" placeholder="МБОУ СОШ №1"></div>' +
    '<div class="form-group"><label class="form-label">Адрес школы</label><input type="text" id="schoolAddress" placeholder="г. Москва, ул. Школьная, 1"></div>' +
    '<div class="form-group"><label class="form-label">Количество учеников</label><input type="number" id="studentCount" placeholder="500"></div>' +
    '<div class="form-group"><label class="form-label">Количество педагогов</label><input type="number" id="teacherCount" placeholder="30"></div>' +
    '<div class="form-group"><label class="form-label">Тип школы</label><select id="schoolType"><option>Средняя общеобразовательная</option><option>Гимназия</option><option>Лицей</option></select></div>' +
    '<div class="form-group"><label class="form-label">Количество зданий</label><input type="number" id="buildingCount" placeholder="1"></div>' +
    '<div class="form-group"><label class="form-label">Могу быть полезен:</label><textarea id="usefulExperience" rows="3"></textarea></div>' +
    '<div class="form-group"><label class="form-label">Хочу узнать:</label><textarea id="wantToKnow" rows="3"></textarea></div>' +
    '<button class="save-btn" id="doSaveSchool">Сохранить информацию</button></div>';
}
