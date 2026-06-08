// Данные директоров теперь приходят с сервера. Этот файл оставлен для совместимости
// и хранит результат последнего запроса.
if (typeof APPSTATE !== 'undefined') {
  Object.defineProperty(window, 'directorsCache', {
    get: function () {
      return APPSTATE.getDirectors().cache;
    },
    set: function (value) {
      APPSTATE.setDirectorsCache(value);
    },
  });
} else {
  var directorsCache = [];
}
