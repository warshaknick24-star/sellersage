import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createServer} from '../server.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = resolve('artifacts');
await mkdir(artifacts, {recursive: true});
const leadDirectory = await mkdtemp(join(artifacts, 'test-inquiries-'));
const server = createServer({apiKey: '', leadDirectory});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
const failures = [];
const reports = [];
function monitor(page) {
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if(message.type() === 'error') failures.push(message.text()); });
}
async function checkBounds(page) {
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => {
    const css = getComputedStyle(element);
    if(css.display === 'none' || css.position === 'absolute' || !element.getClientRects().length) return false;
    const bounds = element.getBoundingClientRect();
    return bounds.right > innerWidth + 1 || bounds.left < -1;
  }).map(element => element.tagName + '.' + element.className));
  assert.deepEqual(overflow, [], 'elements overflow viewport');
}
async function revealAll(page) {
  for(const section of await page.locator('main > section').all()) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    assert.equal(await section.evaluate(el => getComputedStyle(el).opacity), '1');
  }
  await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
}
try {
  browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage(); monitor(page);
  await page.goto(base);
  assert.match(await page.locator('h1').textContent(), /More sales, less guesswork\./);
  assert.match(await page.title(), /SellerSage/);
  assert.equal(await page.locator('a[href="/operator"]').count(), 0);
  assert.ok(await page.locator('#sample-etsy').isVisible());
  await page.getByRole('button', {name: 'Fiverr · design gig'}).click();
  assert.ok(await page.locator('#sample-fiverr').isVisible());
  assert.ok(await page.locator('#sample-etsy').isHidden());
  await page.getByRole('button', {name: 'Etsy · pottery listing'}).click();
  await page.locator('summary').first().click();
  assert.ok(await page.locator('details').first().evaluate(el => el.open));
  await page.fill('#check-title-input', 'blue mug');
  await page.fill('#check-tags', 'mug, mug');
  await page.click('#check-submit');
  await page.waitForFunction(() => !document.querySelector('#check-result').hidden);
  assert.match(await page.locator('#check-score').textContent(), /^\d+$/);
  assert.ok(await page.locator('#check-list .fail').count() > 0);
  reports.push('Instant listing check returns a score and fix list.');
  await page.locator('#pricing [data-service="Shop Refresh ($300)"]').click();
  assert.equal(await page.inputValue('#lead-service'), 'Shop Refresh ($300)');
  await page.fill('#lead-name', 'Browser review');
  await page.fill('#lead-email', 'review@example.com');
  await page.fill('#lead-business', 'Sample shop <script>');
  await page.fill('#lead-url', 'https://example.com/shop');
  await page.check('#lead-consent');
  const response = page.waitForResponse(r => r.url().endsWith('/api/leads') && r.request().method() === 'POST');
  await page.click('#submit-lead');
  assert.equal((await response).status(), 201);
  await page.waitForFunction(() => document.querySelector('#form-status').textContent.includes('local operator desk'));
  assert.ok(await page.locator('#submit-lead').isDisabled(), 'identical request cannot be resubmitted');
  const records = await (await context.request.get(base + '/api/leads')).json();
  assert.equal(records.length, 1); assert.equal(records[0].business, 'Sample shop <script>');
  assert.equal(records[0].challenge, '');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#download-brief');
  const download = await downloadPromise;
  const contents = await readFile(await download.path(), 'utf8');
  assert.match(contents, /review@example.com/); assert.match(contents, /Shop Refresh \(\$300\)/); assert.match(contents, /SELLERSAGE/);
  await page.locator('#pricing [data-service="Refresh + 3 months ($600)"]').click();
  assert.ok(await page.locator('#submit-lead').isEnabled(), 'service CTA enables a changed request');
  await page.locator('#pricing [data-service="Shop Refresh ($300)"]').click();
  assert.ok(await page.locator('#submit-lead').isDisabled(), 'returning to identical request restores duplicate gate');
  await page.goto(base + '/operator');
  await page.waitForFunction(() => document.querySelectorAll('.inquiry-record').length === 1);
  assert.match(await page.locator('.inquiry-record').textContent(), /Sample shop <script>/);
  assert.equal(await page.locator('#stat-packages').textContent(), '1');
  assert.equal(await page.locator('#stat-value').textContent(), '$300');
  assert.equal(await page.locator('#economics-rows tr').count(), 5);
  assert.equal(await page.locator('.inquiry-record script').count(), 0);
  reports.push('Actual POST → disk → operator inbox; optional notes; download contents; duplicate-submit gate; safe text rendering.');

  await page.goto(base);
  await revealAll(page);
  await checkBounds(page);
  await page.screenshot({path: join(artifacts, 'customer-desktop.png'), fullPage: true});
  await page.locator('[data-sample="fiverr"]').click();
  await page.locator('#examples').screenshot({path: join(artifacts, 'fiverr-sample.png')});

  for(const width of [390, 320, 768, 1024]) {
    await page.setViewportSize({width, height: 844});
    await page.goto(base);
    await revealAll(page);
    await checkBounds(page);
    assert.ok(await page.locator('.site-header nav a[href="#services"]').isVisible());
    if(width === 390) await page.screenshot({path: join(artifacts, 'customer-mobile.png'), fullPage: true});
  }
  reports.push('1440, 1024, 768, 390 and 320px layout; actual element bounds; readable visible sections after scrolling.');

  const nojs = await browser.newContext({javaScriptEnabled: false, viewport:{width:390,height:844}});
  const plain = await nojs.newPage(); monitor(plain); await plain.goto(base);
  for(const selector of ['#services','#sample-etsy','#sample-fiverr','#pricing','#process','#about','#inquiry']) {
    assert.ok(await plain.locator(selector).isVisible());
    assert.equal(await plain.locator(selector).evaluate(el => getComputedStyle(el).opacity), '1');
  }
  assert.equal(await plain.locator('#lead-form').getAttribute('method'), 'post');
  assert.match(await plain.locator('#lead-form').getAttribute('action'), /^https:\/\/formsubmit\.co\//);
  await checkBounds(plain);
  reports.push('No-JS essential content and both samples visible; form falls back to a POST to FormSubmit, never a GET.');

  const reduced = await browser.newContext({reducedMotion:'reduce'});
  const calm = await reduced.newPage(); monitor(calm); await calm.goto(base); await revealAll(calm);
  assert.equal(await calm.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').length), 0);
  await calm.goto(base); await calm.keyboard.press('Tab');
  assert.equal(await calm.evaluate(() => document.activeElement.className), 'skip-link');
  await calm.keyboard.press('Enter');
  assert.equal(new URL(calm.url()).hash, '#main');
  reports.push('Reduced motion has no running animations; keyboard skip link works.');

  const errorContext = await browser.newContext();
  const errorPage = await errorContext.newPage();
  errorPage.on('pageerror', error => failures.push(error.message));
  await errorPage.goto(base);
  await errorPage.fill('#lead-name','Retained');
  await errorPage.fill('#lead-email','retained@example.com');
  await errorPage.fill('#lead-business','Retained shop');
  await errorPage.check('#lead-consent');
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  await errorPage.route('**/api/leads', async route => { await gate; await route.fulfill({status:500,contentType:'application/json',body:'{"error":"Test failure"}'}); });
  await errorPage.click('#submit-lead');
  await errorPage.waitForFunction(() => document.querySelector('#download-brief').disabled);
  assert.ok(await errorPage.locator('#download-brief').isDisabled());
  release();
  await errorPage.waitForFunction(() => document.querySelector('#form-status').classList.contains('error'));
  assert.equal(await errorPage.inputValue('#lead-name'),'Retained');
  assert.ok(await errorPage.locator('#submit-lead').isEnabled());
  assert.ok(await errorPage.locator('#download-brief').isEnabled());
  reports.push('Failed POST preserves entries, enables retry/download; download disabled during pending save.');

  assert.deepEqual(failures, []);
  console.log(reports.join('\n'));
  console.log('Browser checks passed. No page errors or unexpected console/CSP errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
}
