import { saveProfile, saveSchool } from './profile-forms.js';
import { MAX_LINK } from './profile-max.js';
import { addSkill, addStrength } from './profile-ui.js';
import { renderDirectorsView } from './views-directors.js';
import { renderEventsView } from './views-events.js';
import { renderExpertView } from './views-expert.js';
import { renderProfileView } from './views-profile.js';
import { renderSchoolView } from './views-school.js';
export function renderStaticViews() {
  renderProfileView();
  renderSchoolView();
  renderEventsView();
  renderDirectorsView();
  renderExpertView();
}

export function initStaticViewBindings() {
  var addStrengthBtn = document.getElementById('addStrengthBtn');
  if (addStrengthBtn) addStrengthBtn.onclick = addStrength;
  var addSkillBtn = document.getElementById('addSkillBtn');
  if (addSkillBtn) addSkillBtn.onclick = addSkill;
  var saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.onclick = saveProfile;
  var saveSchoolBtn = document.getElementById('doSaveSchool');
  if (saveSchoolBtn) saveSchoolBtn.onclick = saveSchool;
  if (typeof MAX_LINK !== 'undefined' && MAX_LINK) MAX_LINK.bind();
}
