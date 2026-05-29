function renderStaticViews() {
  renderProfileView();
  renderSchoolView();
  renderEventsView();
  renderDirectorsView();
  renderMentorsView();
  renderExpertView();
}

function initStaticViewBindings() {
  var addStrengthBtn = document.getElementById('addStrengthBtn');
  if (addStrengthBtn) addStrengthBtn.onclick = addStrength;
  var addSkillBtn = document.getElementById('addSkillBtn');
  if (addSkillBtn) addSkillBtn.onclick = addSkill;
  var saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.onclick = saveProfile;
  var saveSchoolBtn = document.getElementById('doSaveSchool');
  if (saveSchoolBtn) saveSchoolBtn.onclick = saveSchool;
}
