// Service worker: офлайн-доступ к оболочке приложения. Данные хранятся в IndexedDB, API не кэшируется.
const VERSION = 'lifeos-v3.3.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/util.js', './js/engine.js', './js/store.js', './js/sync.js', './js/data.js', './js/ui.js', './js/charts.js', './js/demo.js',
  './js/views/comp.js', './js/views/today.js', './js/views/plan.js', './js/views/health.js', './js/views/learn.js',
  './js/views/habits.js', './js/views/rest.js', './js/views/assistant.js', './js/views/analytics.js', './js/views/settings.js', './js/views/profile.js', './js/views/money.js', './js/views/body.js', './js/views/mind.js', './js/views/deeds.js', './js/views/me.js', './art/analytics-s.webp', './art/analytics.webp', './art/assistant-s.webp', './art/assistant.webp', './art/body-s.webp', './art/body.webp', './art/deeds-s.webp', './art/deeds.webp', './art/habits-s.webp', './art/habits.webp', './art/me-s.webp', './art/me.webp', './art/medal.webp', './art/mind-s.webp', './art/mind.webp', './art/money-s.webp', './art/money.webp', './art/rest-s.webp', './art/rest.webp', './art/settings-s.webp', './art/settings.webp', './art/splash.webp', './art/today-s.webp', './art/today.webp', './js/seed.js', './js/content/curriculum.js', './js/content/nutrition.js', './js/content/training.js', './js/content/strategy.js',
  './fonts/alegreya-sans-latin-700-normal.woff2', './fonts/alegreya-sans-latin-400-normal.woff2', './fonts/alegreya-sans-cyrillic-700-normal.woff2', './fonts/alegreya-sans-latin-500-normal.woff2', './fonts/alegreya-sans-cyrillic-500-normal.woff2', './fonts/alegreya-sans-cyrillic-400-normal.woff2', './fonts/alegreya-sans-sc-latin-500-normal.woff2', './fonts/cormorant-garamond-cyrillic-700-normal.woff2', './fonts/alegreya-sans-sc-cyrillic-500-normal.woff2', './fonts/cormorant-garamond-cyrillic-600-normal.woff2', './fonts/cormorant-garamond-latin-600-normal.woff2', './fonts/cormorant-garamond-cyrillic-500-italic.woff2', './fonts/ruslan-display-cyrillic-400-normal.woff2', './fonts/ruslan-display-latin-400-normal.woff2', './fonts/cormorant-garamond-latin-700-normal.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase и Anthropic API идут напрямую в сеть
  // сеть в приоритете (свежая версия), кэш как запасной вариант без интернета
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
