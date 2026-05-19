// HTTP-клиент к API. JWT хранится в localStorage.
var API = (function () {
  var TOKEN_KEY = 'authToken';
  var USER_KEY = 'currentUser';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  function request(method, url, body, isForm) {
    var headers = {};
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var opts = { method: method, headers: headers };
    if (body !== undefined && body !== null) {
      if (isForm) {
        opts.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    return fetch(url, opts).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      var isJson = ct.indexOf('application/json') !== -1;
      var p = isJson ? res.json() : res.text();
      return p.then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('HTTP ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  return {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getUser: getUser,
    setUser: setUser,
    isAuthed: function () { return !!getToken(); },
    isAdmin: function () { var u = getUser(); return !!(u && u.role === 'admin'); },

    register: function (data) { return request('POST', '/api/auth/register', data); },
    login: function (data) { return request('POST', '/api/auth/login', data); },
    me: function () { return request('GET', '/api/auth/me'); },

    getProfile: function () { return request('GET', '/api/profile'); },
    saveProfile: function (data) { return request('PUT', '/api/profile', data); },
    saveSchool: function (data) { return request('PUT', '/api/profile/school', data); },
    uploadPhoto: function (file) {
      var fd = new FormData();
      fd.append('photo', file);
      return request('POST', '/api/profile/photo', fd, true);
    },

    getDirectors: function (q) { return request('GET', '/api/directors' + (q ? '?q=' + encodeURIComponent(q) : '')); },
    getMentors: function () { return request('GET', '/api/directors/mentors'); },

    getEvents: function () { return request('GET', '/api/events'); },
    createEvent: function (data) { return request('POST', '/api/events', data); },
    registerForEvent: function (id, data) { return request('POST', '/api/events/' + id + '/register', data); },
    deleteEvent: function (id) { return request('DELETE', '/api/events/' + id); },

    getExtras: function (cat) { return request('GET', '/api/extras/' + cat); },
    registerForExtra: function (cat, eventId, data) { return request('POST', '/api/extras/' + cat + '/' + eventId + '/register', data); },

    getMyRating: function () { return request('GET', '/api/ratings/me'); },
    setRatingVisibility: function (isPublic) { return request('PUT', '/api/ratings/me/visibility', { public: isPublic }); },

    getAdminUsers: function () { return request('GET', '/api/admin/users'); }
  };
})();
