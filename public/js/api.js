// HTTP-клиент к API. JWT передаётся в httpOnly cookie (автоматически браузером).
var API = (function () {
  var USER_KEY = 'currentUser';

  function getCookie(name) {
    try {
      var parts = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        if (part.indexOf(name + '=') === 0) return decodeURIComponent(part.slice(name.length + 1));
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }
  function setUser(u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }
  function clearUser() {
    localStorage.removeItem(USER_KEY);
  }

  function request(method, url, body, isForm) {
    var headers = {};
    var opts = { method: method, headers: headers, credentials: 'include' };
    // CSRF: double-submit token (cookie + header) for state-changing requests
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      var csrf = getCookie('csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
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
          var err = new Error((data && data.error) || 'HTTP ' + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  return {
    getUser: getUser,
    setUser: setUser,
    clearUser: clearUser,
    isAuthed: function () {
      return !!getUser();
    },
    isAdmin: function () {
      var u = getUser();
      return !!(u && u.role === 'admin');
    },

    register: function (data) {
      return request('POST', '/api/auth/register', data);
    },
    login: function (data) {
      return request('POST', '/api/auth/login', data);
    },
    logout: function () {
      return request('POST', '/api/auth/logout');
    },
    me: function () {
      return request('GET', '/api/auth/me');
    },
    forgotPassword: function (email) {
      return request('POST', '/api/auth/forgot-password', { email: email });
    },
    resetPassword: function (token, password) {
      return request('POST', '/api/auth/reset-password', { token: token, password: password });
    },

    getProfile: function () {
      return request('GET', '/api/profile');
    },
    saveProfile: function (data) {
      return request('PUT', '/api/profile', data);
    },
    saveSchool: function (data) {
      return request('PUT', '/api/profile/school', data);
    },
    uploadPhoto: function (file) {
      var fd = new FormData();
      fd.append('photo', file);
      return request('POST', '/api/profile/photo', fd, true);
    },

    getDirectors: function (q, page, limit) {
      var params = [];
      if (q) params.push('q=' + encodeURIComponent(q));
      if (page) params.push('page=' + page);
      if (limit) params.push('limit=' + limit);
      var qs = params.length ? '?' + params.join('&') : '';
      return request('GET', '/api/directors' + qs);
    },
    getMentors: function () {
      return request('GET', '/api/directors/mentors');
    },

    getEvents: function () {
      return request('GET', '/api/events');
    },
    createEvent: function (data) {
      return request('POST', '/api/events', data);
    },
    registerForEvent: function (id, data) {
      return request('POST', '/api/events/' + id + '/register', data);
    },
    deleteEvent: function (id) {
      return request('DELETE', '/api/events/' + id);
    },

    getExtras: function (cat) {
      return request('GET', '/api/extras/' + cat);
    },
    registerForExtra: function (cat, eventId, data) {
      return request('POST', '/api/extras/' + cat + '/' + eventId + '/register', data);
    },

    getMyRating: function () {
      return request('GET', '/api/ratings/me');
    },
    setRatingVisibility: function (isPublic) {
      return request('PUT', '/api/ratings/me/visibility', { public: isPublic });
    },

    getNotifications: function () {
      return request('GET', '/api/notifications');
    },
    markNotificationRead: function (ids) {
      return request('PUT', '/api/notifications/read', { ids: ids });
    },
    markAllNotificationsRead: function () {
      return request('PUT', '/api/notifications/read-all');
    },

    sendMessage: function (toUserId, text) {
      return request('POST', '/api/messages', { toUserId: toUserId, text: text });
    },
    getMessages: function () {
      return request('GET', '/api/messages');
    },
    getUnreadMessages: function () {
      return request('GET', '/api/messages/unread');
    },
    markAllMessagesRead: function () {
      return request('PUT', '/api/messages/read-all');
    },

    getAdminUsers: function () {
      return request('GET', '/api/admin/users');
    },
  };
})();
