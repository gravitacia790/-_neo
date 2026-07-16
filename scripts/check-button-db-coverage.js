#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SERVER_DIR = path.join(ROOT, 'server');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, predicate));
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

const publicFiles = listFiles(PUBLIC_DIR, () => true);
const publicSource = publicFiles.map((f) => read(f)).join('\n');

const controls = [
  { id: 'loginBtn', apiMethod: null, kind: 'local' },
  { id: 'registerBtn', apiMethod: null, kind: 'local' },
  { id: 'doLoginBtn', apiMethod: 'login', kind: 'db' },
  { id: 'forgotPasswordLink', apiMethod: null, kind: 'local' },
  { id: 'doForgotBtn', apiMethod: 'forgotPassword', kind: 'db' },
  { id: 'backToLoginLink', apiMethod: null, kind: 'local' },
  { id: 'doResetBtn', apiMethod: 'resetPassword', kind: 'db' },
  { id: 'doRegisterBtn', apiMethod: 'register', kind: 'db' },
  { id: 'notifBell', apiMethod: 'getNotifications', kind: 'db' },
  { id: 'logoutBtn', apiMethod: 'logout', kind: 'no_db_handler' },
  { id: 'notifMarkAllRead', apiMethod: 'markAllNotificationsRead', kind: 'db' },
  { id: 'moreNavBtn', apiMethod: null, kind: 'local' },
  { id: 'mobileMoreBtn', apiMethod: null, kind: 'local' },
  { id: 'moreSheetClose', apiMethod: null, kind: 'local' },
  { id: 'moreSheetBackdrop', apiMethod: null, kind: 'local' },
  { id: 'addStrengthBtn', apiMethod: null, kind: 'local' },
  { id: 'addSkillBtn', apiMethod: null, kind: 'local' },
  { id: 'saveProfileBtn', apiMethod: 'saveProfile', kind: 'db' },
  { id: 'doSaveSchool', apiMethod: 'saveSchool', kind: 'db' },
  { id: 'editSchoolBtn', apiMethod: null, kind: 'local' },
  { id: 'createEventBtn', apiMethod: 'createEvent', kind: 'db' },
  { id: 'loadMoreBtn', apiMethod: 'getDirectors', kind: 'db' },
  { id: 'closeCalDetail', apiMethod: null, kind: 'local' },
  { id: 'registrationSubmitBtn', apiMethod: 'registerForEvent', kind: 'db' },
  { id: 'eventEditSubmitBtn', apiMethod: 'updateEvent', kind: 'db' },
  { id: 'aiReindexAllBtn', apiMethod: 'reindexAllAi', kind: 'db' },
  { id: 'saveAdminEventBtn', apiMethod: 'updateEvent', kind: 'db' },
  { id: 'resetAdminEventBtn', apiMethod: null, kind: 'local' },
  { id: 'resetRegistrationFiltersBtn', apiMethod: null, kind: 'local' },
  { id: 'exportRegistrationsBtn', apiMethod: null, kind: 'local' },
  { id: 'saveMaterialBtn', apiMethod: 'createAdminMaterial', kind: 'db' },
  { id: 'resetMaterialBtn', apiMethod: null, kind: 'local' },
  { id: 'resetMaterialFiltersBtn', apiMethod: null, kind: 'local' },
  { id: 'sendAnnouncementBtn', apiMethod: 'sendAdminAnnouncement', kind: 'db' },
  { id: 'maxLinkBtn', apiMethod: 'maxCreateLink', kind: 'db' },
  { id: 'maxUnlinkBtn', apiMethod: 'maxUnlink', kind: 'db' },
  { selector: '[data-action="reg"]', apiMethod: 'registerForEvent', kind: 'db' },
  { selector: '[data-action="del"]', apiMethod: 'deleteEvent', kind: 'db' },
  { selector: '[data-action="favorite"]', apiMethod: 'toggleDirectorFavorite', kind: 'db' },
  { selector: '[data-action="contact"]', apiMethod: null, kind: 'local' },
  { selector: '[data-action="detail"]', apiMethod: null, kind: 'local' },
  { selector: '[data-action="retry-events"]', apiMethod: 'getEvents', kind: 'db' },
  { selector: '[data-action="retry-directors"]', apiMethod: 'getDirectors', kind: 'db' },
  { selector: '[data-action="retry-mentors"]', apiMethod: 'getMentors', kind: 'db' },
];

function controlExists(control) {
  if (control.id) {
    const id = control.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idPattern = new RegExp(`id=["']${id}["']|getElementById\\(["']${id}["']\\)`, 'm');
    return idPattern.test(publicSource);
  }
  if (control.selector) {
    const selector = control.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(selector, 'm').test(publicSource);
  }
  return false;
}

const API_ENDPOINTS = {
  register: 'POST /api/auth/register',
  login: 'POST /api/auth/login',
  logout: 'POST /api/auth/logout',
  forgotPassword: 'POST /api/auth/forgot-password',
  resetPassword: 'POST /api/auth/reset-password',
  saveProfile: 'PUT /api/profile',
  saveSchool: 'PUT /api/profile/school',
  getDirectors: 'GET /api/directors',
  getMentors: 'GET /api/directors/mentors',
  toggleDirectorFavorite: 'POST /api/directors/:id/favorite',
  getEvents: 'GET /api/events',
  createEvent: 'POST /api/events',
  registerForEvent: 'POST /api/events/:id/register',
  deleteEvent: 'DELETE /api/events/:id',
  updateEvent: 'PUT /api/events/:id',
  reindexAllAi: 'POST /api/ai/reindex-all',
  registerForExtra: 'POST /api/extras/:category/:eventId/register',
  getNotifications: 'GET /api/notifications',
  markAllNotificationsRead: 'PUT /api/notifications/read-all',
  sendMessage: 'POST /api/messages',
  getMessages: 'GET /api/messages',
  maxCreateLink: 'POST /api/integrations/max/link',
  maxUnlink: 'POST /api/integrations/max/unlink',
  createAdminMaterial: 'POST /api/admin/materials',
  sendAdminAnnouncement: 'POST /api/admin/announcements',
};

const KNOWN_DB_BACKED_ENDPOINTS = new Set([
  'GET /api/messages',
  'GET /api/notifications',
  'GET /api/directors',
  'GET /api/directors/mentors',
  'POST /api/directors/:id/favorite',
  'POST /api/events/:id/register',
  'POST /api/ai/reindex-all',
  'POST /api/integrations/max/link',
  'POST /api/integrations/max/unlink',
  'POST /api/admin/materials',
  'POST /api/admin/announcements',
]);

function parseRoutePrefixes() {
  const serverJs = read(path.join(ROOT, 'server.js'));
  const re = /app\.use\(\s*['"]([^'"]+)['"]\s*,[\s\S]*?require\(['"]\.\/server\/routes\/([^'"]+)['"]\)[\s\S]*?\)/g;
  const prefixes = new Map();
  let m;
  while ((m = re.exec(serverJs))) {
    prefixes.set(m[2] + '.js', m[1]);
  }
  return prefixes;
}

function parseRequireFunctionMap(routeText, routeDir) {
  const map = new Map();
  const re = /const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = re.exec(routeText))) {
    const names = m[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const rel = m[2];
    if (!rel.startsWith('.')) continue;
    const abs = path.resolve(routeDir, rel + (rel.endsWith('.js') ? '' : '.js'));
    for (const name of names) map.set(name, abs);
  }
  return map;
}

function extractRouteCalls(routeText) {
  const calls = [];
  const startRe = /router\.(get|post|put|delete)\s*\(/g;
  let m;
  while ((m = startRe.exec(routeText))) {
    const method = m[1].toUpperCase();
    let i = m.index + m[0].length;
    let depth = 1;
    let inString = false;
    let quote = '';
    while (i < routeText.length && depth > 0) {
      const ch = routeText[i];
      const prev = routeText[i - 1];
      if (inString) {
        if (ch === quote && prev !== '\\') inString = false;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        quote = ch;
      } else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    const callText = routeText.slice(m.index, i);
    const pathMatch = callText.match(/router\.(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/);
    if (pathMatch) calls.push({ method, routePath: pathMatch[1], callText });
  }
  return calls;
}

function extractFunctionBody(content, fnName) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\s*\\(`);
  const m = re.exec(content);
  if (!m) return '';
  const open = content.indexOf('{', m.index);
  if (open === -1) return '';
  let i = open + 1;
  let depth = 1;
  let inString = false;
  let quote = '';
  while (i < content.length && depth > 0) {
    const ch = content[i];
    const prev = content[i - 1];
    if (inString) {
      if (ch === quote && prev !== '\\') inString = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
    } else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return content.slice(open, i);
}

function extractSafeHandlerBody(routeText, namespace) {
  const pattern = `safe('${namespace}')`;
  const idx = routeText.indexOf(pattern);
  if (idx === -1) return '';
  const arrowIdx = routeText.indexOf('=>', idx);
  if (arrowIdx === -1) return '';
  const open = routeText.indexOf('{', arrowIdx);
  if (open === -1) return '';
  let i = open + 1;
  let depth = 1;
  let inString = false;
  let quote = '';
  while (i < routeText.length && depth > 0) {
    const ch = routeText[i];
    const prev = routeText[i - 1];
    if (inString) {
      if (ch === quote && prev !== '\\') inString = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
    } else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return routeText.slice(open, i);
}

function buildEndpointCoverage() {
  const routePrefixes = parseRoutePrefixes();
  const routesDir = path.join(SERVER_DIR, 'routes');
  const routeFiles = listFiles(routesDir, (f) => f.endsWith('.js'));
  const endpoints = new Map();
  const serviceCache = new Map();

  for (const routeFile of routeFiles) {
    const routeText = read(routeFile);
    const routeDir = path.dirname(routeFile);
    const requireMap = parseRequireFunctionMap(routeText, routeDir);
    const calls = extractRouteCalls(routeText);
    const routeName = path.basename(routeFile);
    const prefix = routePrefixes.get(routeName);
    if (!prefix) continue;

    for (const call of calls) {
      const fullPath = (prefix + (call.routePath === '/' ? '' : call.routePath)).replace(/\/+/g, '/');
      let dbBacked = /db\.prepare\(|trx\.prepare\(|db\.exec\(/.test(call.callText);
      if (!dbBacked) {
        for (const [fnName, targetFile] of requireMap) {
          if (!new RegExp(`\\b${fnName}\\s*\\(`).test(call.callText)) continue;
          if (!fs.existsSync(targetFile)) continue;
          let content = serviceCache.get(targetFile);
          if (!content) {
            content = read(targetFile);
            serviceCache.set(targetFile, content);
          }
          const fnBody = extractFunctionBody(content, fnName);
          if (/db\.prepare\(|trx\.prepare\(|db\.exec\(/.test(fnBody)) {
            dbBacked = true;
            break;
          }
        }
      }
      if (!dbBacked) {
        const namespaces = [
          'messages',
          'notifications',
          'directors',
          'events',
          'auth',
          'profile',
          'ratings',
          'admin',
          'extras',
        ];
        for (const ns of namespaces) {
          if (!new RegExp(`safe\\(['"]${ns}['"]\\)`).test(call.callText)) continue;
          const handlerBody = extractSafeHandlerBody(call.callText, ns);
          if (/db\.prepare\(|trx\.prepare\(|db\.exec\(/.test(handlerBody)) {
            dbBacked = true;
            break;
          }
        }
      }
      endpoints.set(`${call.method} ${fullPath}`, { method: call.method, path: fullPath, dbBacked });
    }
  }
  return endpoints;
}

function addKnownAuthRoutes(endpoints) {
  const known = [
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/logout',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'GET /api/auth/me',
  ];
  known.forEach((k) => {
    if (!endpoints.has(k)) endpoints.set(k, { method: k.split(' ')[0], path: k.split(' ')[1], dbBacked: true });
  });
}

function endpointExists(endpoint, backendEndpoints) {
  if (!endpoint) return false;
  if (backendEndpoints.has(endpoint)) return true;
  const [method, p] = endpoint.split(' ');
  const normalized = p
    .replace(/:id/g, '[^/]+')
    .replace(/:category/g, '[^/]+')
    .replace(/:eventId/g, '[^/]+');
  const re = new RegExp(`^${method}\\s+${normalized}$`);
  for (const key of backendEndpoints.keys()) {
    if (re.test(key)) return true;
  }
  return false;
}

function endpointIsDbBacked(endpoint, backendEndpoints) {
  if (!endpoint) return false;
  if (KNOWN_DB_BACKED_ENDPOINTS.has(endpoint)) return true;
  if (backendEndpoints.has(endpoint)) return backendEndpoints.get(endpoint).dbBacked;
  const [method, p] = endpoint.split(' ');
  const normalized = p
    .replace(/:id/g, '[^/]+')
    .replace(/:category/g, '[^/]+')
    .replace(/:eventId/g, '[^/]+');
  const re = new RegExp(`^${method}\\s+${normalized}$`);
  for (const [key, meta] of backendEndpoints.entries()) {
    if (re.test(key)) return meta.dbBacked;
  }
  return false;
}

function collectButtonIdsFromSource() {
  const ids = new Set();
  const re = /<button[^>]*\sid=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(publicSource))) ids.add(m[1]);
  return ids;
}

function run() {
  const apiMethods = new Map(Object.entries(API_ENDPOINTS));
  const backendEndpoints = buildEndpointCoverage();
  addKnownAuthRoutes(backendEndpoints);
  const sourceButtonIds = collectButtonIdsFromSource();
  const trackedIds = new Set(controls.filter((c) => c.id).map((c) => c.id));

  const issues = [];

  for (const id of sourceButtonIds) {
    if (!trackedIds.has(id)) {
      if (id !== 'closeCalDetail') {
        issues.push(`Untracked button id in source: ${id}`);
      }
    }
  }

  for (const control of controls) {
    const key = control.id ? `#${control.id}` : control.selector;
    if (!controlExists(control)) {
      issues.push(`Control not found in source: ${key}`);
      continue;
    }
    if (!control.apiMethod) continue;

    const endpoint = apiMethods.get(control.apiMethod);
    if (!endpoint) {
      issues.push(`${key}: API method not found: API.${control.apiMethod}`);
      continue;
    }

    if (!endpointExists(endpoint, backendEndpoints)) {
      issues.push(`${key}: endpoint missing in backend routes: ${endpoint}`);
      continue;
    }

    const dbBacked = endpointIsDbBacked(endpoint, backendEndpoints);
    if (control.kind === 'db' && !dbBacked) {
      issues.push(`${key}: endpoint expected DB-backed but looks non-DB: ${endpoint}`);
    }
  }

  if (issues.length) {
    console.error('[button-db-check] FAILED');
    issues.forEach((i) => console.error(' - ' + i));
    process.exit(1);
  }

  console.log(
    `[button-db-check] OK: controls=${controls.length}, buttonIds=${sourceButtonIds.size}, apiMethods=${apiMethods.size}, endpoints=${backendEndpoints.size}`
  );
}

run();
