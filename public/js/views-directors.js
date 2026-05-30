function renderDirectorsView() {
  var el = document.getElementById('directors');
  if (!el) return;
  el.innerHTML =
    '<h2 class="tab-title">Директора школ</h2>' +
    '<div class="director-segments" id="directorSegments">' +
    '<button class="director-segment active" data-segment="all">Все</button>' +
    '<button class="director-segment" data-segment="mentors">Наставники</button>' +
    '<button class="director-segment" data-segment="favorites">Избранное</button>' +
    '</div>' +
    '<div class="directors-hint" id="directorsHint"></div>' +
    '<div class="favorites-toolbar" id="favoritesToolbar" hidden>' +
    '<label for="favoritesSortSelect" class="favorites-toolbar__label">Сортировка:</label>' +
    '<select id="favoritesSortSelect" class="favorites-toolbar__select">' +
    '<option value="recent">Недавно добавленные</option>' +
    '<option value="name">По алфавиту</option>' +
    '</select>' +
    '</div>' +
    '<div class="search-container"><input type="text" id="directorSearchInput" class="search-input" placeholder="Поиск по имени, школе..."></div>' +
    '<div id="directorsList" class="directors-grid"></div>';
}

function renderMentorsView() {
  var el = document.getElementById('mentors');
  if (!el) return;
  el.innerHTML = '<h2 class="tab-title">Потенциальные наставники</h2><div id="mentorsList"></div>';
}
