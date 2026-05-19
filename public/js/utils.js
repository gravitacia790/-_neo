function escapeHtml(str) {
  return (str == null ? '' : String(str)).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

function showModal(title, contentHtml) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-content"><button class="close-modal">&times;</button><h2 style="margin-bottom: 20px;">' + escapeHtml(title) + '</h2>' + contentHtml + '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.close-modal').onclick = function () { overlay.remove(); };
  overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
  return overlay;
}

function getCurrentUserEmail() {
  var u = API.getUser();
  return u ? u.email : null;
}

function getCurrentUserName() {
  var u = API.getUser();
  return u ? u.name : null;
}

function isAdmin() {
  return API.isAdmin();
}

// Глобальный кэш профиля и школы для отображения карточек
var __myProfile = null;
var __mySchool = null;
function setMyProfileCache(profile, school) {
  __myProfile = profile;
  __mySchool = school;
}
function getMyProfileCache() { return __myProfile; }
function getMySchoolCache() { return __mySchool; }

function getCurrentDirectorName() {
  return (__myProfile && __myProfile.name) || getCurrentUserName() || 'Директор';
}

function getCurrentSchoolName() {
  return (__mySchool && __mySchool.name) || 'Школа';
}

function notify(msg, isError) {
  // Минималистичное уведомление, можно заменить на тосты позже
  if (isError) console.error(msg);
  alert(msg);
}
