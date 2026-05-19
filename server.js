// Загружаем .env, если есть (без зависимости dotenv)
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
  }
} catch {}

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cors = require('cors');

const { init: initDb } = require('./server/db');
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", "'unsafe-inline'", "blob:"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'worker-src': ["'self'", 'blob:']
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/profile', require('./server/routes/profile'));
app.use('/api/directors', require('./server/routes/directors'));
app.use('/api/events', require('./server/routes/events'));
app.use('/api/extras', require('./server/routes/extras'));
app.use('/api/ratings', require('./server/routes/ratings'));
app.use('/api/admin', require('./server/routes/admin'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка' });
});

app.listen(PORT, () => {
  console.log(`Гравитация NEO запущена на http://localhost:${PORT}`);
});
