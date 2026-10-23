// Isolated UI fixture: no real authentication or session changes are performed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-account-menu-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import { PublicHeader } from '@/components/PublicHeader';
    window.logoutCalls = 0;
    createRoot(document.getElementById('fixture')).render(<PublicHeader initialAuth={window.fixtureAuth} showBentoMenu onStartReport={() => {}} />);
  `);
  const mocks = {
    'next/navigation': `const router = { push: path => { window.pushedPath = path; }, prefetch() {}, refresh() {} }; export const useRouter = () => router; export const usePathname = () => '/'; export const useSearchParams = () => new URLSearchParams();`,
    'next/image': `import React from 'react'; export default function Image({priority, fill, unoptimized, ...props}) { return React.createElement('img', props); }`,
    'next/link': `import React from 'react'; export default function Link({prefetch, ...props}) { return React.createElement('a', props); }`,
    '@/lib/supabase/client': `export const authHeaders = async () => ({}); export const createClient = () => ({ auth: {
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: callback => { queueMicrotask(() => callback('INITIAL_SESSION', null)); return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => { window.logoutCalls++; return { error: null }; }
    } });`,
  };
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error', esbuild: { jsx: 'automatic' },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    resolve: { alias: { '@': root, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
    plugins: [{ name: 'public-menu-ui-mocks', enforce: 'pre',
      resolveId(id) {
        if (mocks[id]) return '\0public-menu:' + id;
        if (id.replaceAll('\\', '/').endsWith('/lib/supabase/client')) return '\0public-menu:@/lib/supabase/client';
      },
      load(id) { if (id.startsWith('\0public-menu:')) return mocks[id.slice('\0public-menu:'.length)]; },
    }],
    build: { write: false, lib: { entry, formats: ['iife'], name: 'PublicAccountFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('Fixture page error:', error.message));
    await page.route('**/api/v1/weather/alerts/active', route => route.fulfill({ json: [] }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.href));
    await page.route('**/__account-menu-fixture', route => route.fulfill({ contentType: 'text/html',
      body: styles.map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '<div id="fixture"></div>',
    }));
    for (const width of [390, 1440]) for (const role of [null, 'staff', 'admin']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/__account-menu-fixture');
      await page.evaluate(role => { window.fixtureAuth = { role, name: role ? 'Fixture user' : null, email: role ? 'fixture@example.test' : null }; }, role);
      await page.addScriptTag({ content: bundle });
      const menu = page.getByRole('button', { name: 'Open menu', exact: true }).filter({ visible: true });
      await menu.click();
      assert.equal(await page.getByRole('button', { name: 'Account menu', exact: true }).count(), 0);
      const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
      if (!role) {
        assert.equal(await signOut.count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Login', exact: true }).count(), 1);
      } else {
        await signOut.click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await page.evaluate(() => window.logoutCalls), 0);
        await menu.click();
        await signOut.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.waitForFunction(() => window.logoutCalls === 1 && window.pushedPath === '/login');
      }
      console.log('Public Menu ' + width + 'px ' + (role || 'guest') + ': no account button; Login/sign-out visibility and confirmation passed');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
