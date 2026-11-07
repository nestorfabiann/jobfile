// Smoke test for the live site. Opens the pages a visitor can reach and fails on any broken one.
// Run: SITE_URL=https://jobfile-rosy.vercel.app node tests/smoke.mjs   (needs: npm i --no-save playwright)
import { chromium } from 'playwright';

const SITE = (process.env.SITE_URL || 'https://jobfile-rosy.vercel.app').replace(/\/$/, '');
const problems = [];
const note = (m) => { problems.push(m); console.log('FAIL', m); };
const ok = (m) => console.log('ok  ', m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'JobfileSmokeTest/1.0' });

async function visit(path, check) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`script error: ${String(e.message).slice(0, 160)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(401|403|404)/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });
  try {
    const r = await page.goto(SITE + path, { waitUntil: 'networkidle', timeout: 45000 });
    if (!r || r.status() >= 400) note(`${path} answered ${r ? r.status() : 'nothing'}`);
    else {
      const text = (await page.locator('body').innerText()).trim();
      if (/application error|something went wrong|internal server error/i.test(text)) note(`${path} shows an error page`);
      else if (text.length < 40) note(`${path} is nearly empty`);
      else if (check) { const msg = await check(page, text); if (msg) note(`${path}: ${msg}`); else ok(path); }
      else ok(path);
    }
    errors.forEach((e) => note(`${path} ${e}`));
  } catch (e) {
    note(`${path} did not load: ${String(e.message).slice(0, 140)}`);
  }
  await page.close();
}

await visit('/', (_p, t) => (/Jobfile/i.test(t) ? '' : 'Jobfile name missing'));
await visit('/jobs', (_p, t) => (/open|project|job/i.test(t) ? '' : 'job list text missing'));
await visit('/login', async (p) => ((await p.locator('input[type="email"], input[name="email"]').count()) ? '' : 'email field missing'));
await visit('/help');

// A signed-out visitor who opens a private page must be sent to the login page.
{
  const page = await ctx.newPage();
  try {
    await page.goto(SITE + '/projects', { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!/\/login/.test(page.url())) note(`/projects did not send a signed-out visitor to login (ended at ${page.url()})`); else ok('/projects redirects to login');
  } catch (e) { note(`/projects check failed: ${String(e.message).slice(0, 120)}`); }
  await page.close();
}

// The app can reach its database.
{
  try {
    const r = await ctx.request.get(SITE + '/api/health', { timeout: 30000 });
    const j = await r.json().catch(() => ({}));
    if (r.status() === 404) console.log('skip /api/health is not deployed yet');
    else if (!r.ok() || !j.ok) note(`/api/health says the database is not reachable (status ${r.status()})`); else ok(`/api/health (${j.ms} ms)`);
  } catch (e) { note(`/api/health failed: ${String(e.message).slice(0, 120)}`); }
}

await browser.close();
if (problems.length) { console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log('\nAll checks passed');
