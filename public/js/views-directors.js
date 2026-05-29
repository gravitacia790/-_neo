function renderDirectorsView() {
  var el = document.getElementById('directors');
  if (!el) return;
  el.innerHTML =
    '<h2 class="tab-title">Директора школ</h2>' +
    '<div class="search-container"><input type="text" id="directorSearchInput" class="search-input" placeholder="Поиск по имени, школе..."></div>' +
    '<div id="directorsList" class="directors-grid"></div>';
}

function renderMentorsView() {
  var el = document.getElementById('mentors');
  if (!el) return;
  el.innerHTML = '<h2 class="tab-title">Потенциальные наставники</h2><div id="mentorsList"></div>';
}
