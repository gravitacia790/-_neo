import { showSplash } from './app.js';
// HTTP-клиент к API. JWT передаётся в httpOnly cookie (автоматически браузером).
export var API = (function () {
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
    return fetch(url, opts).catch(function (cause) {
      var err = new Error('Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.');
      err.status = 0;
      err.cause = cause;
      throw err;
    }).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      var isJson = ct.indexOf('application/json') !== -1;
      var p = isJson ? res.json() : res.text();
      return p.then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'HTTP ' + res.status);
          err.status = res.status;
          err.data = data;
          if (res.status === 401 && url.indexOf('/api/auth/') !== 0) {
            clearUser();
            showSplash();
          }
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
    trackEvent: function (type, meta) {
      try {
        return request('POST', '/api/analytics/event', { type: type, meta: meta }).catch(function () {});
      } catch (_) {
        return Promise.resolve();
      }
    },
    forgotPassword: function (email) {
      return request('POST', '/api/auth/forgot-password', { email: email });
    },
    resetPassword: function (email, code, password) {
      return request('POST', '/api/auth/reset-password', { email: email, code: code, password: password });
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
    getFavoriteDirectors: function (sort) {
      var qs = sort ? ('?sort=' + encodeURIComponent(sort)) : '';
      return request('GET', '/api/directors/favorites' + qs);
    },
    toggleDirectorFavorite: function (directorId) {
      return request('POST', '/api/directors/' + directorId + '/favorite');
    },
    requestPhoneNumber: function (directorId) {
      return request('POST', '/api/phone-visibility-requests/' + directorId);
    },
    respondPhoneNumberRequest: function (requestId, decision) {
      return request('PUT', '/api/phone-visibility-requests/' + requestId, { decision: decision });
    },
    searchAiDirectors: function (query) {
      return request('POST', '/api/ai/search', { query: query });
    },
    getAiConversations: function () {
      return request('GET', '/api/ai/conversations');
    },
    getAiMessages: function (conversationId) {
      return request('GET', '/api/ai/conversations/' + conversationId + '/messages');
    },
    sendAiMessage: function (conversationId, content) {
      var normalizedConversationId = conversationId ? Number(conversationId) : null;
      return request('POST', '/api/ai/chat', {
        conversationId: Number.isFinite(normalizedConversationId) && normalizedConversationId > 0 ? normalizedConversationId : null,
        content: content,
      });
    },
    reindexAllAi: function () {
      return request('POST', '/api/ai/reindex-all');
    },

    getEvents: function (page, limit) {
      var params = [];
      if (page) params.push('page=' + page);
      if (limit) params.push('limit=' + limit);
      var qs = params.length ? '?' + params.join('&') : '';
      return request('GET', '/api/events' + qs);
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
    updateEvent: function (id, data) {
      return request('PUT', '/api/events/' + id, data);
    },
    cancelEventRegistration: function (eventId, registrationId) {
      return request('DELETE', '/api/events/' + eventId + '/registrations/' + registrationId);
    },

    getExtras: function (cat) {
      return request('GET', '/api/extras/' + cat);
    },
    registerForExtra: function (cat, eventId, data) {
      return request('POST', '/api/extras/' + cat + '/' + eventId + '/register', data);
    },
    cancelExtraRegistration: function (cat, eventId, registrationId) {
      return request('DELETE', '/api/extras/' + cat + '/' + eventId + '/registrations/' + registrationId);
    },
    getMaterials: function (category, eventId, materialType) {
      var params = [];
      if (category) params.push('category=' + encodeURIComponent(category));
      if (eventId) params.push('eventId=' + encodeURIComponent(eventId));
      if (materialType) params.push('type=' + encodeURIComponent(materialType));
      return request('GET', '/api/materials' + (params.length ? '?' + params.join('&') : ''));
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

    getPushConfig: function () {
      return fetch('/api/push/config', { credentials: 'include' }).then(function (res) {
        if (!res.ok) throw new Error('push-config-unavailable');
        return res.json();
      });
    },
    subscribePush: function (subscription) {
      return request('POST', '/api/push/subscribe', { subscription: subscription });
    },
    unsubscribePush: function (endpoint) {
      return request('POST', '/api/push/unsubscribe', { endpoint: endpoint });
    },

    maxGetStatus: function () {
      return request('GET', '/api/integrations/max/status');
    },
    maxCreateLink: function () {
      return request('POST', '/api/integrations/max/link');
    },
    maxUnlink: function () {
      return request('POST', '/api/integrations/max/unlink');
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
    getAdminApplications: function () {
      return request('GET', '/api/admin/applications');
    },
    updateAdminApplication: function (id, status) {
      return request('PUT', '/api/admin/applications/' + id, { status: status });
    },
    getAdminOverview: function () {
      return request('GET', '/api/admin/overview');
    },
    getAdminEvents: function () {
      return request('GET', '/api/admin/events');
    },
    getAdminRegistrations: function () {
      return request('GET', '/api/admin/registrations');
    },
    getAdminMaterials: function () {
      return request('GET', '/api/admin/materials');
    },
    getAdminAnnouncements: function () {
      return request('GET', '/api/admin/announcements');
    },
    createAdminMaterial: function (data) {
      return request('POST', '/api/admin/materials', data);
    },
    updateAdminMaterial: function (id, data) {
      return request('PUT', '/api/admin/materials/' + id, data);
    },
    deleteAdminMaterial: function (id) {
      return request('DELETE', '/api/admin/materials/' + id);
    },
    sendAdminAnnouncement: function (data) {
      return request('POST', '/api/admin/announcements', data);
    },
  };
})();
