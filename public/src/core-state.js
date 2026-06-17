export var APPSTATE = (function () {
  var state = {
    directors: {
      cache: [],
      searchTerm: '',
      page: 1,
      totalPages: 1,
      searchTimer: null,
      segment: 'all',
      favoritesSort: 'recent',
    },
    events: {
      cache: [],
    },
  };

  function getDirectors() {
    return state.directors;
  }

  function setDirectorsCache(items) {
    state.directors.cache = Array.isArray(items) ? items : [];
  }

  function appendDirectorsCache(items) {
    if (!Array.isArray(items) || !items.length) return;
    state.directors.cache = state.directors.cache.concat(items);
  }

  function setDirectorsPage(page, totalPages) {
    state.directors.page = Number(page) > 0 ? Number(page) : 1;
    state.directors.totalPages = Number(totalPages) > 0 ? Number(totalPages) : 1;
  }

  function resetDirectorsPagination() {
    state.directors.page = 1;
    state.directors.totalPages = 1;
  }

  function incrementDirectorsPage() {
    state.directors.page += 1;
  }

  function setDirectorsSearchTerm(term) {
    state.directors.searchTerm = term || '';
  }

  function setDirectorsSegment(segment) {
    state.directors.segment = segment;
  }

  function setDirectorsFavoritesSort(sort) {
    state.directors.favoritesSort = sort;
  }

  function setDirectorsSearchTimer(timerId) {
    state.directors.searchTimer = timerId || null;
  }

  function getEvents() {
    return state.events;
  }

  function setEventsCache(items) {
    state.events.cache = Array.isArray(items) ? items : [];
  }

  return {
    getDirectors: getDirectors,
    setDirectorsCache: setDirectorsCache,
    appendDirectorsCache: appendDirectorsCache,
    setDirectorsPage: setDirectorsPage,
    resetDirectorsPagination: resetDirectorsPagination,
    incrementDirectorsPage: incrementDirectorsPage,
    setDirectorsSearchTerm: setDirectorsSearchTerm,
    setDirectorsSegment: setDirectorsSegment,
    setDirectorsFavoritesSort: setDirectorsFavoritesSort,
    setDirectorsSearchTimer: setDirectorsSearchTimer,
    getEvents: getEvents,
    setEventsCache: setEventsCache,
  };
})();
