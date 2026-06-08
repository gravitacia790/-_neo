const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

function convertPlaceholders(sql) {
  let idx = 1;
  return sql.replace(/\?/g, () => `$${idx++}`);
}

function createFacade(executor) {
  return {
    async exec(sql) {
      await executor.query(sql);
    },
    prepare(sql) {
      const text = convertPlaceholders(sql);
      return {
        async get(...params) {
          const result = await executor.query(text, params);
          return result.rows[0] || null;
        },
        async all(...params) {
          const result = await executor.query(text, params);
          return result.rows;
        },
        async run(...params) {
          const result = await executor.query(text, params);
          const row = result.rows[0] || null;
          return {
            rowCount: result.rowCount,
            lastInsertRowid: row && (row.id || row.user_id) ? row.id || row.user_id : null,
          };
        },
      };
    },
    transaction(fn) {
      return async (...args) => {
        const client = await executor.connect();
        const tx = createFacade(client);
        try {
          await client.query('BEGIN');
          const result = await fn(tx, ...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          try {
            await client.query('ROLLBACK');
          } catch (_) {
            // ignore rollback errors, original error is more important
          }
          throw err;
        } finally {
          if (typeof client.release === 'function') {
            client.release();
          }
        }
      };
    },
  };
}

function createPool() {
  if (process.env.NODE_ENV === 'test') {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    mem.public.registerFunction({ name: 'now', returns: 'timestamp', implementation: () => new Date() });
    const pgAdapter = mem.adapters.createPg();
    return new pgAdapter.Pool({ max: 1 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('[db] DATABASE_URL is required for PostgreSQL');
  }
  return new Pool({ connectionString: databaseUrl });
}

const DB_SINGLETON_KEY = '__gravitacia_pg_singleton__';
const existingSingleton = global[DB_SINGLETON_KEY];
let pool = existingSingleton ? existingSingleton.pool : null;
let db = existingSingleton ? existingSingleton.db : null;

if (!pool || !db) {
  pool = createPool();
  db = createFacade(pool);
  global[DB_SINGLETON_KEY] = { pool, db };
}

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn('db.admin_not_configured');
    }
    return;
  }
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    const info = await db
      .prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin') RETURNING id`)
      .run(adminEmail, hash, 'Администратор');
    await db.prepare('INSERT INTO ratings (user_id, total_score, is_public) VALUES (?, 0, 0)').run(info.lastInsertRowid);
    logger.info('db.admin_created', { email: adminEmail });
  }
}

async function seedDemoDirectors() {
  var demoModeEnabled = process.env.DEMO_MODE === 'true';
  var seedDemoEnabled = process.env.SEED_DEMO === 'true';
  if (process.env.NODE_ENV === 'production' && !demoModeEnabled && !seedDemoEnabled) return;
  if (process.env.RESTORE_DEMO_DIRECTORS === 'true') {
    await db.prepare("DELETE FROM users WHERE role = 'director'").run();
  }
  const countRow = await db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('director');
  if (Number(countRow.c) > 0) return;

  const demos = [
    {
      name: 'Елена Викторовна Громова',
      email: 'elena@school11.ru',
      phone: '+7 (999) 111-11-11',
      city: 'Химки, Московская область',
      school: {
        name: 'МБОУ «Гимназия №11»',
        address: 'Химки, ул. Ленина, 11',
        students: 1200,
        teachers: 85,
        type: 'Гимназия',
        building_count: 2,
        useful_experience:
          '12 лет успешного руководства школой с высокими образовательными результатами (ТОП-50 школ МО).\nВнедрение системы наставничества для молодых педагогов, снижение текучести кадров на 35%.\nЭксперт по подготовке к государственной аккредитации и лицензированию.\nОрг��низация профильных инженерных и IT-классов в сотрудничеств�� с вузами.\nГрантовая деятельность: привлечено более 8 млн ₽ на модернизацию лабораторий.',
        want_to_know:
          'Цифровая трансформация школ: эффективные AI-инструменты для управленческого учёта.\nКак выстроить систему проектного обучения, интегрированную с региональными предприятиями.\nПрактики ментального здоровья педагогов: программы профилактики выгорания.\nКейсы по созданию автономии школы и внебюджетной деятельности.',
      },
      profile: {
        is_mentor: 1,
        experience:
          'Руководитель пилотного проекта «Школа полного дня» в Химках (охват 780 учеников).\nФиналист Всероссийского конкурса «Директор года – 2024».\nРазработала и внедрила систему «Цифровой помощник классного руководителя».',
        interests:
          'Современная педагогическая литература\nМедитация и осознанность для педагогов\nГрафический дизайн\nВелотуризм\nВолонтёрство в просветительских проектах',
        strengths: [
          { name: 'Стратегическое планирование', val: 9.5 },
          { name: 'Управление персоналом и мотивация', val: 9.2 },
          { name: 'Финансовая эффективность / фандрайзинг', val: 8.8 },
          { name: 'Коммуникация с родительским сообществом', val: 9.7 },
          { name: 'Развитие инклюзивной среды', val: 8.4 },
        ],
        skills: [
          { name: 'Цифровая трансформация образования', level: 'Эксперт' },
          { name: 'Проектный менеджмент (гранты, дорожные карты)', level: 'Эксперт' },
          { name: 'Управление изменениями / конфликтология', level: 'Продвинутый' },
          { name: 'Бюджетирование и внебюджетная деятельность', level: 'Продвинутый' },
          { name: 'Публичные выступления / образовательная аналитика', level: 'Эксперт' },
        ],
        tags: [
          '#Стратегическое_планирование',
          '#Наставничество_педагогов',
          '#IT_класс',
          '#Гранты_образование',
          '#Школьное_лидерство',
          '#Инклюзия',
        ],
      },
      rating: 87,
    },
    {
      name: 'Анна Сергеевна Воронцова',
      email: 'anna@school3.ru',
      phone: '+7 (999) 222-22-22',
      city: 'Красногорск',
      school: {
        name: 'Гимназия №3',
        address: 'Красногорск, ул. Школьная, 3',
        students: 850,
        teachers: 60,
        type: 'Гимназия',
        building_count: 1,
        useful_experience:
          'Опыт внедрения инклюзивного образования, успешное прохождение аккредитации.\nСоздание ресурсного класса для детей с ОВЗ.\nВзаимодействие с родительским сообществом и общественными организациями.',
        want_to_know:
          'Цифровые платформы для управления школой, методики работы с молодыми педагогами.\nЭффективное наставничество для начинающих директоров.',
      },
      profile: {
        is_mentor: 1,
        experience:
          'Успешно прошла 2 аккредитации, создала ресурсный класс для детей с ОВЗ.\nРуководитель муниципальной инновационной площадки по инклюзии.',
        interests: 'Психология\nЧтение\nСадоводство',
        strengths: [
          { name: 'Стратегическое планирование', val: 8 },
          { name: 'Работа с родителями', val: 9 },
          { name: 'Инклюзивное образование', val: 9.2 },
        ],
        skills: [
          { name: 'Управление персоналом', level: 'Продвинутый' },
          { name: 'Фандрайзинг', level: 'Средний' },
          { name: 'Аккредитация и лицензирование', level: 'Эксперт' },
        ],
        tags: ['#Инклюзия', '#Аккредитация', '#Родительский_комитет'],
      },
      rating: 64,
    },
    {
      name: 'Дмитрий Павлович Громов',
      email: 'dmitry@licey10.ru',
      phone: '+7 (999) 333-33-33',
      city: 'Долгопрудный',
      school: {
        name: 'Лицей №10',
        address: 'Долгопрудный, ул. Науки, 10',
        students: 700,
        teachers: 55,
        type: 'Лицей',
        building_count: 1,
        useful_experience:
          'Построение IT-лицея с нуля, привлечение грантов.\nОрганизация IT-классов и инженерных лабораторий.\nЦифровая трансформация образовательного процесса.',
        want_to_know:
          'Организация профильных классов, мотивация педагогов.\nСовременные методы проектного обучения и стартап-культуры в школе.',
      },
      profile: {
        is_mentor: 0,
        experience:
          'Создал IT-лицей с нуля, выиграл грант на оборудование лабораторий.\nПобедитель конкурса инновационных школ Московской области.',
        interests: 'Программирование\nШахм��ты\nРобототехника',
        strengths: [
          { name: 'Цифровая трансформация', val: 9 },
          { name: 'Лидерство', val: 8.5 },
          { name: 'Управление проектами', val: 9 },
        ],
        skills: [
          { name: 'Проектный менеджмент', level: 'Эксперт' },
          { name: 'IT-инфраструктура', level: 'Эксперт' },
          { name: 'Грантрайтинг', level: 'Продвинутый' },
        ],
        tags: ['#IT_лицей', '#Гранты', '#Цифровизация'],
      },
      rating: 52,
    },
    {
      name: 'Екатерина Викторовна Морозова',
      email: 'ekaterina@school22.ru',
      phone: '+7 (999) 444-44-44',
      city: 'Одинцово',
      school: {
        name: 'СОШ №22',
        address: 'Одинцово, ул. Центральная, 22',
        students: 950,
        teachers: 65,
        type: 'Средняя общеобразовательная',
        building_count: 1,
        useful_experience:
          'Создание школьного медиацентра, развитие волонтёрства.\nОрганизация школьного телевидения и медиаобразования.\nПривлечение волонтёров к социальным проектам.',
        want_to_know:
          'Эффективное наставничество для молодых директоров.\nСовременные инструменты медиапродвижения школы.',
      },
      profile: {
        is_mentor: 1,
        experience:
          'Запустила школьное телевидение, привлекла волонтёров к социальным проектам.\nЛауреат премии «Лучший медиапроект школы».',
        interests: 'Журналистика\nВолонтёрство\nФотография',
        strengths: [
          { name: 'Коммуникабельность', val: 9 },
          { name: 'Креативность', val: 8 },
          { name: 'Организация мероприятий', val: 8.5 },
        ],
        skills: [
          { name: 'Медиа', level: 'Продвинутый' },
          { name: 'Организация мероприятий', level: 'Продвинутый' },
          { name: 'SMM и PR', level: 'Средний' },
        ],
        tags: ['#Медиа', '#Волонтёрство', '#Школьное_ТВ'],
      },
      rating: 41,
    },
  ];

  const tx = db.transaction(async (trx) => {
    const insertUser = trx.prepare(
      `INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, 'director') RETURNING id`
    );
    const insertProfile = trx.prepare(
      `INSERT INTO profiles (user_id, experience, interests, is_mentor, consent, city)
       VALUES (?, ?, ?, ?, 1, ?)`
    );
    const insertStrength = trx.prepare('INSERT INTO profile_strengths (user_id, name, value) VALUES (?, ?, ?)');
    const insertSkill = trx.prepare('INSERT INTO profile_skills (user_id, name, level) VALUES (?, ?, ?)');
    const insertTag = trx.prepare('INSERT INTO profile_tags (user_id, tag) VALUES (?, ?)');
    const insertSchool = trx.prepare(
      `INSERT INTO schools (user_id, name, address, students, teachers, type, building_count, useful_experience, want_to_know)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertRating = trx.prepare(`INSERT INTO ratings (user_id, total_score, is_public) VALUES (?, ?, 1)`);

    const hash = bcrypt.hashSync('demo1234', 10);
    for (const d of demos) {
      const info = await insertUser.run(d.email, hash, d.name, d.phone);
      const uid = info.lastInsertRowid;
      await insertProfile.run(uid, d.profile.experience, d.profile.interests, d.profile.is_mentor, d.city);
      for (var sgi = 0; sgi < d.profile.strengths.length; sgi++) {
        var sg = d.profile.strengths[sgi];
        await insertStrength.run(uid, sg.name, sg.val);
      }
      for (var ski = 0; ski < d.profile.skills.length; ski++) {
        var sk = d.profile.skills[ski];
        await insertSkill.run(uid, sk.name, sk.level);
      }
      for (var tgi = 0; tgi < d.profile.tags.length; tgi++) {
        await insertTag.run(uid, d.profile.tags[tgi]);
      }
      await insertSchool.run(
        uid,
        d.school.name,
        d.school.address,
        d.school.students,
        d.school.teachers,
        d.school.type,
        d.school.building_count,
        d.school.useful_experience,
        d.school.want_to_know
      );
      await insertRating.run(uid, d.rating);
    }
  });
  await tx();
  logger.info('db.demo_seeded', { directors: demos.length });
}

async function init() {
  const { migrateUp } = require('./migrate');
  await migrateUp();
  await ensureAdmin();
  await seedDemoDirectors();
}

function checkWeakAdminPassword() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (process.env.ADMIN_PASSWORD) {
    return;
  }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var newPw = '';
  for (var i = 0; i < 16; i++) {
    newPw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  process.env.ADMIN_PASSWORD = newPw;
  logger.warn('config.admin_password_generated', {
    generated: true,
    hint: 'Set ADMIN_PASSWORD in .env for a stable dev admin password (not written to disk)',
  });
}

if (require.main === module) {
  init()
    .then(() => {
      console.log('[db] Инициализация завершена');
      return pool.end();
    })
    .catch((err) => {
      console.error('[db] init failed:', err.message);
      process.exit(1);
    });
}

module.exports = { db, init, checkWeakAdminPassword, pool };
