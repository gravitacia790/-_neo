const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  PageBreak,
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'ТЕХНИЧЕСКОЕ_ЗАДАНИЕ.docx');
const CRIMSON = 'A1313A';
const CHARCOAL = '1C1A28';
const LIGHT = 'F5F2EB';

function p(text, opts) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Manrope', size: 22, color: CHARCOAL, ...(opts || {}) })],
    spacing: { after: 120 },
  });
}

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 34, color: CHARCOAL, font: 'Playfair Display' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 160 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Manrope', size: 22, color: CHARCOAL })],
    bullet: { level: 0 },
    spacing: { after: 50 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function th(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: CRIMSON },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18, font: 'Manrope' })] })],
  });
}

function td(text, width, shaded) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: shaded ? { type: ShadingType.SOLID, color: LIGHT } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 18, font: 'Manrope', color: CHARCOAL })] })],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D4D0C8' },
    },
    rows: [
      new TableRow({ children: headers.map((header, i) => th(header, widths[i])) }),
      ...rows.map((row, rowIndex) => new TableRow({ children: row.map((cell, i) => td(cell, widths[i], rowIndex % 2 === 1)) })),
    ],
  });
}

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: 'ТЕХНИЧЕСКОЕ ЗАДАНИЕ', bold: true, size: 36, font: 'Playfair Display', color: CRIMSON })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'Гравитация NEO', bold: true, size: 52, font: 'Playfair Display', color: CHARCOAL })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: 'Профессиональное сообщество директоров школ Московской области', size: 24, font: 'Manrope', color: CHARCOAL })] }),
      table(['Параметр', 'Значение'], [
        ['Версия', '1.0-final'],
        ['Дата актуализации', '26.05.2026'],
        ['Статус', 'Финальная редакция'],
        ['Формат', 'DOCX'],
      ], [35, 65]),

      pageBreak(),
      h1('Содержание'),
      p('1. Назначение системы'),
      p('2. Основные функции'),
      p('3. Технологический стек'),
      p('4. Архитектурное состояние проекта'),
      p('5. Безопасность'),
      p('6. База данных'),
      p('7. Эксплуатационная готовность'),
      p('8. Критерии готовности'),
      p('9. Дорожная карта дальнейшего развития'),
      p('10. Итог'),

      h1('1. Назначение системы'),
      p('Система «Гравитация NEO» предназначена для объединения директоров школ Московской области в единое цифровое пространство с профилями, поиском, мероприятиями, сообщениями, уведомлениями и административными функциями.'),

      h1('2. Основные функции'),
      bullet('Аутентификация, регистрация и сброс пароля'),
      bullet('Профиль директора и карточка школы'),
      bullet('Поиск директоров и наставников'),
      bullet('Мероприятия и регистрация сотрудников'),
      bullet('Встроенные уведомления и личные сообщения'),
      bullet('Рейтинг активности и административная панель'),

      h1('3. Технологический стек'),
      table(['Слой', 'Технологии'], [
        ['Backend', 'Node.js, Express, SQLite, Zod, JWT, bcryptjs, ws'],
        ['Frontend', 'HTML, CSS, Vanilla JavaScript SPA'],
        ['Качество', 'ESLint, Prettier, Vitest, Supertest'],
        ['Ops', 'GitHub Actions CI, health/readiness, structured logging'],
      ], [30, 70]),

      h1('4. Архитектурное состояние проекта'),
      bullet('Backend разделён на routes и services'),
      bullet('Frontend разбит на app, views и feature-модули'),
      bullet('Ключевые домены вынесены в service-layer: auth, events, profile, directors, messages'),
      bullet('Поиск директоров использует FTS5-индекс'),
      bullet('Миграции БД применяются автоматически'),
      p('Архитектурно проект ушёл от первоначального SPA-монолита к модульной структуре, что снижает технический долг и упрощает сопровождение.'),

      h1('5. Безопасность'),
      bullet('JWT хранится в httpOnly cookie'),
      bullet('Есть CSRF-проверка для state-changing запросов'),
      bullet('CSP ужесточён, unsafe-inline удалён из script-src'),
      bullet('Rate limit и временная блокировка после неудачных логинов'),
      bullet('Валидация env на старте в production'),
      bullet('Structured logging для ошибок и событий сервера'),
      table(['Риск', 'Мера снижения'], [
        ['Подбор пароля', 'lockout после 5 неудачных попыток и rate limit'],
        ['XSS', 'CSP и удаление inline script handlers'],
        ['Ошибочная конфигурация', 'startup validation через server/config.js'],
        ['Деградация поиска', 'FTS индекс director_search'],
      ], [38, 62]),

      h1('6. База данных'),
      p('В системе используются таблицы users, profiles, schools, events, event_registrations, extra_registrations, ratings, rating_activities, notifications, messages, password_reset_tokens, profile_strengths, profile_skills, profile_tags и FTS-индекс director_search.'),
      table(['Группа таблиц', 'Назначение'], [
        ['Идентификация', 'users, password_reset_tokens'],
        ['Профиль', 'profiles, schools, profile_strengths, profile_skills, profile_tags'],
        ['Активности', 'events, event_registrations, extra_registrations'],
        ['Коммуникации', 'notifications, messages'],
        ['Аналитика и поиск', 'ratings, rating_activities, director_search'],
      ], [35, 65]),

      h1('7. Эксплуатационная готовность'),
      bullet('Health endpoint: /health'),
      bullet('Readiness endpoint: /ready'),
      bullet('Structured logging на сервере'),
      bullet('CI workflow: lint, test, coverage'),
      bullet('Test coverage script работает стабильно'),

      h1('8. Критерии готовности'),
      table(['Критерий', 'Статус'], [
        ['Тесты проходят', 'Да, 23/23'],
        ['Lint без ошибок', 'Да'],
        ['Migration-based schema evolution', 'Да'],
        ['Service-layer по ключевым доменам', 'Да'],
        ['Frontend декомпозирован на модули', 'Да'],
      ], [60, 40]),

      h1('9. Дорожная карта дальнейшего развития'),
      bullet('Подключение реального email flow для reset-password'),
      bullet('Расширение test coverage по service-layer и WebSocket'),
      bullet('Дальнейшая модульная декомпозиция frontend shared/state слоя'),
      bullet('Усиление observability и deployment playbook'),

      h1('10. Итог'),
      p('Текущая версия проекта представляет собой production-ready foundation: система покрыта тестами, проходит lint, имеет CI, startup/config validation, readiness checks, service-layer архитектуру и модульный фронтенд. Дальнейшее развитие должно идти через расширение бизнес-функций, а не через исправление архитектурных проблем основы.'),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log('DOCX создан:', OUT);
});
