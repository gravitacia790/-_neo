// Точка входа фронтенда. Импортирует модули в безопасном порядке;
// app.js в конце вызывает initApp(). Сборка — Vite (см. vite.config.js).
import './api.js';
import './core-state.js';
import './shell-dom.js';
import './overlay.js';
import './utils.js';
import './html.js';
import './rating.js';
import './events-ui.js';
import './events-actions.js';
import './events.js';
import './directors-ui.js';
import './directors-detail.js';
import './directors-actions.js';
import './directors.js';
import './profile-ui.js';
import './profile-forms.js';
import './profile-loader.js';
import './profile-max.js';
import './admin/ui.js';
import './admin/logic.js';
import './admin/main.js';
import './auth.js';
import './views-profile.js';
import './views-school.js';
import './views-events.js';
import './views-directors.js';
import './views-expert.js';
import './views.js';
import './tabs.js';
import './extras.js';
import './ws.js';
import './notifications.js';
import './push-client.js';
import { initApp } from './app.js';

// Все модули вычислены — запускаем приложение (скрипт грузится с defer, DOM готов).
initApp();
