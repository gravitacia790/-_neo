const path = require('path');
const { defineConfig } = require('vite');

// Собираем единый бандл фронтенда из ES-модулей public/src в public/js/app.bundle.js.
// Express продолжает раздавать public/ как есть; меняется только index.html (один тег).
module.exports = defineConfig({
  // Express сам раздаёт public/; Vite не должен копировать его как статику.
  publicDir: false,
  build: {
    outDir: path.join(__dirname, 'public', 'js'),
    emptyOutDir: false,
    target: 'es2019',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: path.join(__dirname, 'public', 'src', 'main.js'),
      output: {
        format: 'iife',
        entryFileNames: 'app.bundle.js',
      },
    },
  },
});
