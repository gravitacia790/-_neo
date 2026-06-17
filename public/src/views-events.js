export function renderEventsView() {
  var el = document.getElementById('events');
  if (!el) return;
  el.innerHTML =
    '<h2 class="tab-title">Обмен опытом: мероприятия</h2>' +
    '<div class="create-event-card">' +
    '<h3 class="section-label">Опубликовать мероприятие</h3>' +
    '<div class="form-group"><label class="form-label">Название</label><input type="text" id="eventTitle" placeholder="Мастер-класс по цифровизации"></div>' +
    '<div class="form-group"><label class="form-label">Дата и время</label><input type="datetime-local" id="eventDate"></div>' +
    '<div class="form-group"><label class="form-label">Описание</label><textarea id="eventDesc" rows="2"></textarea></div>' +
    '<div class="form-group"><label class="form-label">Максимум участников</label><input type="number" id="eventMax" placeholder="10"></div>' +
    '<div class="checkbox-label"><input type="checkbox" id="eventSpeakerCheckbox"><label for="eventSpeakerCheckbox">Я буду спикером на этом мероприятии (+15 баллов)</label></div>' +
    '<button class="save-btn" id="createEventBtn">Опубликовать мероприятие</button></div>' +
    '<h3 class="section-label" style="margin-top: 24px;">Доступные мероприятия</h3><div id="eventsList"></div>';
}
