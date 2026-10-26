// Run against localhost Next dev; set GAKIT_PLAYWRIGHT_MODULE if Playwright is external.
// Synthetic data only. The temporary route mirrors the monitoring shell's dimensions.
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Preview must run on localhost');
const routeDir = path.join(process.env.GAKIT_PREVIEW_ROOT || root, 'app', 'dashboard-preview-test');
assert(!fs.existsSync(routeDir), 'Refusing to overwrite an existing preview route');
const output = process.env.GAKIT_SCREENSHOT_DIR || path.join(os.tmpdir(), 'gakit-dashboard-review');
const now = new Date();
const stamp = hours => new Date(+now + hours * 3600000).toISOString();
const manilaDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const today = manilaDate(now);
const calendarYear = Number(today.slice(0, 4));
const calendarMonth = Number(today.slice(5, 7));
const hourly = [1, 2, 0, 1, 0, 2, 3, 2, 1, 3, 4, 3, 5, 6, 7, 19, 11, 14, 16, 18, 12, 10, 8, 4, 1].map((count, index) => {
  const verified = Math.floor(count * 0.6), pending = Math.floor(count * 0.2), flagged = Math.floor(count * 0.1);
  return { at: new Date(Math.floor(+now / 3600000) * 3600000 - (24 - index) * 3600000).toISOString(), count,
    verified, pending, flagged, rejected: count - verified - pending - flagged };
});
const area = (name, total, verified, pending, flagged, maxDepthCm) => ({
  id: name, name, total, verified, pending, flagged, maxDepthCm, latestObservedAt: stamp(-0.3),
});
const report = (id, address, status, code, depthCm, hours = -0.5) => ({
  id, location: { address, latitude: 8.24, longitude: 124.25 }, status,
  depth: { code, label: code, approximateCm: depthCm }, depthCm,
  observedAt: stamp(hours), createdAt: stamp(hours), updatedAt: stamp(-0.2), decisionSource: 'automated',
});
const total = hourly.reduce((sum, hour) => sum + hour.count, 0);
const normal = { asOf: stamp(0), windowStart: stamp(-24),
  totals: { submissions: total, previousSubmissions: 94, lastHourSubmissions: 3, highSeverity: 3,
    recentObservations: 18, verifiedObservations: 10, barangays: 3, unlocated: 1, needsReview: 9, olderReviews: 2, pending: 6, flagged: 3 },
  hourly, barangays: [area('Tibanga', 8, 6, 1, 1, 165), area('Pala-o', 6, 3, 2, 1, 95), area('Tambacan', 4, 1, 2, 1, 45)],
  priorityReports: [
    { ...report('severe', 'Tibanga · National Highway', 'VERIFIED', 'head', 165), priorityReason: 'high_severity' },
    { ...report('pending', 'Pala-o · Market access road', 'UNVERIFIED', 'knee', 45), priorityReason: 'needs_review' },
    { ...report('older', 'Mahayahay · Community road', 'UNVERIFIED', 'knee', 45, -30), priorityReason: 'older_review' },
    { ...report('conflict', 'Tambacan · Riverside', 'ANOMALY', 'waist', 95), priorityReason: 'conflicting_evidence' },
  ],
  automation: { enabled: true, queued: 3, failed: 1, oldestQueuedAt: stamp(-0.8), firstFailedReportId: 'conflict' },
};
let snapshot = normal, reportsFail = false, advisoryFailure = false, alerts = [];
let archiveFails = false, archiveEmpty = false, archiveFetches = 0;
const archiveData = year => {
  const counts = new Map();
  const windowDay = manilaDate(stamp(-24));
  for (let month = 0; month < 12; month++) {
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let day = 1; day <= length; day++) {
      const date = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
      if (date > today || (year === calendarYear && date >= windowDay)) continue;
      const count = day % 13 === 0 ? 12 : day % 7 === 0 ? 6 : day % 4 === 0 ? 2 : day % 3 === 0 ? 1 : 0;
      if (count) counts.set(date, count);
    }
  }
  if (year === calendarYear) for (const hour of hourly) {
    const date = manilaDate(hour.at);
    counts.set(date, (counts.get(date) || 0) + hour.count);
  }
  const days = archiveEmpty ? [] : Array.from(counts, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  return { year, timeZone: 'Asia/Manila', asOf: stamp(0), today, total: days.reduce((sum, day) => sum + day.count, 0), days };
};
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const navigation = page => page.locator('[data-testid="dashboard-navigation"]');
const attachRoutes = async page => {
  await page.route('**/api/v1/reports/archive**', route => {
    archiveFetches++;
    const year = Number(new URL(route.request().url()).searchParams.get('year'));
    return route.fulfill({ status: archiveFails ? 503 : 200, headers: cors,
      json: archiveFails ? { detail: 'Archive fixture unavailable' } : archiveData(year) });
  });
  await page.route('**/api/v1/reports/dashboard', route => route.fulfill({ status: reportsFail ? 503 : 200, headers: cors,
    json: reportsFail ? { detail: 'Fixture outage' } : snapshot }));
  await page.route('**/api/v1/reports/stats', route => route.fulfill({ headers: cors, json: {
    total: 200, reportsToday: 40, pendingCount: 6, verifiedCount: 180, criticalCount: 3,
    years: [calendarYear, calendarYear - 1], monthly: [calendarYear, calendarYear - 1].flatMap(year =>
      Array.from({ length: 12 }, (_, index) => ({ year, month: index + 1,
        reports: archiveData(year).days.filter(day => Number(day.date.slice(5, 7)) === index + 1).reduce((sum, day) => sum + day.count, 0) }))),
  } }));
  await page.route('**/api/v1/weather/current', route => route.fulfill({ headers: cors,
    json: { temperature: 28, precipitation: 0.8, conditionCode: 63, observedAt: stamp(-0.2) } }));
  await page.route('**/api/v1/weather/alerts/active', route => route.fulfill({ status: advisoryFailure ? 503 : 200, headers: cors,
    json: advisoryFailure ? { detail: 'Fixture advisory outage' } : alerts }));
};
const height = page => page.locator('[data-testid="preview-scroll"]').evaluate(element => ({
  content: element.scrollHeight, available: element.clientHeight, excess: element.scrollHeight - element.clientHeight,
}));

(async () => {
  let browser;
  fs.mkdirSync(routeDir);
  fs.writeFileSync(path.join(routeDir, 'page.tsx'), `'use client';
import { useState } from 'react';
import { DashboardOverview } from '../monitoring/features/dashboard/DashboardOverview';
export default function Preview() {
 const [navigation, setNavigation] = useState('');
 return <div className="flex h-screen overflow-hidden bg-slate-50">
 <aside className="hidden w-60 shrink-0 border-r border-slate-200 p-6 lg:block"><p className="text-xl font-bold text-gakit-maroon">GAKIT</p><p className="mt-2 text-xs text-slate-500">Monitoring Portal</p><p className="mt-10 rounded-lg bg-maroon-50 p-3 text-sm font-semibold text-gakit-maroon">Dashboard</p></aside>
 <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white lg:rounded-l-[2.75rem]">
 <header className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-slate-50 px-4 md:h-24 md:px-9"><div><h1 className="text-xl font-bold text-slate-900">Monitoring Dashboard</h1><p className="mt-1 text-[10px] text-slate-500">Design preview · synthetic data</p></div></header>
 <main data-testid="preview-scroll" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 md:px-7 md:py-4 lg:px-8 lg:pb-4">
 <DashboardOverview onReviewReports={options => setNavigation(JSON.stringify(options))} />
 <output data-testid="dashboard-navigation" className="sr-only">{navigation}</output>
 </main></div></div>;
}`);
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await attachRoutes(page);
    await page.goto(`${base}/dashboard-preview-test`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: 'Report Inflow', exact: true }).waitFor();
    await page.getByText('No active official advisories', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Submission Archive/ }).waitFor();
    assert.equal(archiveFetches, 0, 'Collapsed archive must not fetch daily data');
    assert.equal(await page.getByRole('heading', { name: 'Situation map' }).count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Priority reports', exact: true }).getByRole('button').count(), 5, 'Three entries and two browse actions');
    const region = page.getByRole('region', { name: 'Report inflow', exact: true });
    assert.equal(await region.locator('strong').first().textContent(), String(total));
    await page.getByRole('button', { name: /View pending · All time \(6\)/ }).click();
    assert.deepEqual(JSON.parse(await navigation(page).textContent()), { status: 'UNVERIFIED', time: 'all' });
    await page.getByRole('button').filter({ hasText: 'Mahayahay · Community road' }).click();
    assert.deepEqual(JSON.parse(await navigation(page).textContent()), { reportId: 'older' });
    await page.getByRole('button').filter({ hasText: 'Tibanga · National Highway' }).click();
    assert.equal(JSON.parse(await navigation(page).textContent()).reportId, 'severe');
    await page.getByRole('button', { name: '1 failed assessment', exact: true }).click();
    assert.equal(JSON.parse(await navigation(page).textContent()).reportId, 'conflict');
    await page.getByRole('button', { name: 'View reports ↗', exact: true }).click();
    assert.deepEqual(JSON.parse(await navigation(page).textContent()), { time: '24h' });
    const zeroBar = region.getByRole('button', { name: /: 0 received;/ }).first();
    await zeroBar.click();
    assert.equal(await zeroBar.locator('span').first().evaluate(element => element.style.height), '0%');
    await page.getByRole('button', { name: /Submission Archive/ }).click();
    const archiveRegion = page.getByRole('region', { name: 'Submission archive', exact: true });
    const monthPicker = page.getByRole('combobox', { name: 'Select month', exact: true });
    const yearPicker = page.getByRole('combobox', { name: 'Select year', exact: true });
    await monthPicker.waitFor();
    const calendar = archiveRegion.getByRole('group', { name: /Daily submissions in/ });
    const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
    assert.equal(await calendar.getByRole('button').count(), daysInMonth);
    const desktopDaySquares = await calendar.getByRole('button').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }));
    assert(Math.max(...desktopDaySquares.map(square => square.y)) - Math.min(...desktopDaySquares.map(square => square.y)) > 1, 'Desktop days retain the compact calendar layout');
    const calendarBounds = await calendar.boundingBox();
    assert(calendarBounds.width <= 225, 'Daily calendar remains compact');
    assert(desktopDaySquares.every(square => Math.abs(square.width - square.height) <= 1), 'Daily cells should remain square');
    const firstDate = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-01`;
    await archiveRegion.locator(`[data-date="${firstDate}"]`).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(':focus').getAttribute('data-date'), firstDate.slice(0, -2) + '02');
    const archiveCalls = archiveFetches;
    const annualChart = archiveRegion.getByRole('group', { name: `Monthly submission totals in ${calendarYear}` });
    assert.equal(await annualChart.getByRole('button').count(), 12);
    await annualChart.getByRole('button', { name: /^Feb / }).click();
    assert.equal(await monthPicker.inputValue(), '2', 'Annual chart selects the daily archive month');
    assert.equal(await calendar.getByRole('button').count(), new Date(Date.UTC(calendarYear, 2, 0)).getUTCDate());
    assert.equal(archiveFetches, archiveCalls, 'Month changes reuse the complete daily year payload');
    await yearPicker.selectOption(String(calendarYear - 1));
    await page.getByRole('group', { name: new RegExp(`Daily submissions in February ${calendarYear - 1}`) }).waitFor();
    await yearPicker.selectOption(String(calendarYear));
    await page.getByRole('group', { name: new RegExp(`Daily submissions in February ${calendarYear}`) }).waitFor();
    if (calendarMonth < 12) {
      await monthPicker.selectOption('12');
      await archiveRegion.getByText('Upcoming month', { exact: true }).waitFor();
      assert.equal(await calendar.getByRole('button', { disabled: false }).count(), 0);
    }
    await monthPicker.selectOption(String(calendarMonth));
    archiveFails = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText(/Archive refresh failed/).waitFor();
    assert.equal(await calendar.getByRole('button').count(), daysInMonth, 'Keep last good archive on refresh failure');
    archiveFails = false;
    await page.getByRole('button', { name: 'Retry archive', exact: true }).click();
    await page.getByText(/Archive refresh failed/).waitFor({ state: 'hidden' });
    fs.mkdirSync(output, { recursive: true });
    await archiveRegion.screenshot({ path: path.join(output, 'submission-archive-desktop.png') });
    await page.getByRole('button', { name: /Submission Archive/ }).click();
    const emptyAdvisoryHeight = await height(page);
    assert(emptyAdvisoryHeight.excess <= 1, `1440x900 should fit: ${JSON.stringify(emptyAdvisoryHeight)}`);
    alerts = ['heavy_rain', 'thunderstorm'].map((type, index) => ({ id: `fixture-${index}`, alertType: type, severity: 'warning',
      createdAt: stamp(-0.1), validFrom: stamp(-1), validTo: stamp(2), data: { source: 'DOST-PAGASA', title: index ? 'Thunderstorm Advisory No. 2' : 'Yellow Rainfall Advisory', issuedAt: stamp(-0.1) } }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Yellow Rainfall Advisory', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Report Inflow', exact: true }).waitFor();
    const desktopHeight = await height(page);
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'dashboard-desktop.png'), fullPage: true });
    console.log(JSON.stringify({ desktopHeight, panels: await page.locator('[data-testid="compact-dashboard"]').evaluate(element => Array.from(element.children, child => ({ label: child.textContent.slice(0, 45), height: child.getBoundingClientRect().height }))) }));
    assert(desktopHeight.excess <= 1, `1440x900 with two advisories should fit: ${JSON.stringify(desktopHeight)}`);
    await page.setViewportSize({ width: 1366, height: 768 });
    const shortHeight = await height(page);
    assert(shortHeight.excess <= 100, `Short desktop must need minimal scrolling: ${JSON.stringify(shortHeight)}`);
    await page.screenshot({ path: path.join(output, 'dashboard-desktop-1366.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Submission Archive/ }).click();
    await monthPicker.waitFor();
    await archiveRegion.screenshot({ path: path.join(output, 'submission-archive-mobile.png') });
    const archiveWidth = await archiveRegion.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    assert(archiveWidth.scroll <= archiveWidth.width + 1, 'Monthly calendar must fit mobile without horizontal scrolling');
    await page.getByRole('button', { name: /Submission Archive/ }).click();
    await page.screenshot({ path: path.join(output, 'dashboard-mobile.png') });
    await region.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'dashboard-mobile-inflow.png') });
    const width = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert(width.body <= width.viewport + 1, `Mobile page overflows: ${JSON.stringify(width)}`);
    const mobilePanels = await page.getByRole('region', { name: /Report inflow|Peak flood depths|Report hotspots/ }).evaluateAll(elements => elements.map(element => ({ width: element.clientWidth, scroll: element.scrollWidth })));
    assert(mobilePanels.every(panel => panel.scroll <= panel.width + 1), `Mobile panels overflow: ${JSON.stringify(mobilePanels)}`);
    reportsFail = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText(/Report refresh failed/).waitFor();
    assert.equal(await region.locator('strong').first().textContent(), String(total), 'Keep last good snapshot');
    reportsFail = false;
    snapshot = { ...normal, totals: Object.fromEntries(Object.keys(normal.totals).map(key => [key, 0])),
      hourly: hourly.map(hour => ({ ...hour, count: 0, verified: 0, pending: 0, flagged: 0, rejected: 0 })), barangays: [], priorityReports: [] };
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('No recent severe observations or unresolved reviews.', { exact: true }).waitFor();
    assert.equal(await region.locator('strong').first().textContent(), '0');
    assert((await region.getByRole('button', { name: /: 0 received;/ }).count()) === 25);
    archiveEmpty = true;
    await page.getByRole('button', { name: /Submission Archive/ }).click();
    await archiveRegion.getByText('submissions across 0 days', { exact: true }).waitFor();
    assert.equal(await calendar.getByRole('button').filter({ hasText: /./ }).count(), daysInMonth);
    archiveFails = true;
    advisoryFailure = true;
    const unavailable = await browser.newPage();
    await attachRoutes(unavailable);
    await unavailable.goto(`${base}/dashboard-preview-test`, { waitUntil: 'domcontentloaded' });
    await unavailable.getByText('Advisory data unavailable', { exact: true }).waitFor();
    assert.equal(await unavailable.getByText(/All Clear|Normal Conditions/).count(), 0);
    await unavailable.getByRole('button', { name: /Submission Archive/ }).click();
    await unavailable.getByText('Daily submission archive could not load.', { exact: true }).waitFor();
    assert.equal(await unavailable.getByRole('group', { name: /Daily submissions in/ }).count(), 0, 'An initial archive failure must not display zero activity');
    assert.deepEqual(errors, [], 'Dashboard must not raise browser exceptions');
    console.log(JSON.stringify({ desktop1440: desktopHeight, desktop1366: shortHeight, mobile: 'no horizontal overflow',
      navigation: 'passed', archive: 'monthly, keyboard, year switching, future dates, zero activity, failures and mobile checked',
      zeroIntake: 'passed', refreshFailure: 'retains snapshot', advisoryFailure: 'unknown', screenshots: output }));
  } finally {
    await browser?.close();
    fs.unlinkSync(path.join(routeDir, 'page.tsx'));
    fs.rmdirSync(routeDir);
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
