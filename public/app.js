import {packages, packageCost, findPackage, economics, acquisitionCost, supportMonthCost} from '/lib/packages.mjs';

const $ = id => document.getElementById(id);
const money = value => '$' + value.toLocaleString('en-US', {maximumFractionDigits: 0});
let inquiries = [];

const now = new Date();
$('today').textContent = now.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'}).toUpperCase();
$('greeting').firstChild.textContent = (now.getHours() < 12 ? 'Good morning, ' : now.getHours() < 18 ? 'Good afternoon, ' : 'Good evening, ');

for (const pkg of packages) $('inquiry-filter').append(new Option(pkg.label, pkg.label));
$('inquiry-filter').addEventListener('change', renderInquiries);

function summarize() {
  const matched = inquiries.map(inquiry => findPackage(inquiry.service));
  const audits = matched.filter(pkg => pkg?.id === 'audit').length;
  const paid = matched.filter(pkg => pkg?.price > 0);
  const loyal = paid.filter(pkg => pkg.supportMonths > 0).length;
  $('stat-total').textContent = inquiries.length;
  $('nav-count').textContent = inquiries.length;
  $('stat-audits').textContent = audits;
  $('stat-packages').textContent = paid.length;
  $('stat-value').textContent = money(paid.reduce((sum, pkg) => sum + pkg.price, 0));
  $('funnel-audit').textContent = audits;
  $('funnel-convert').textContent = paid.length;
  $('funnel-loyal').textContent = loyal;
}

function renderInquiries() {
  const filter = $('inquiry-filter').value;
  const list = $('inquiry-list');
  list.replaceChildren();
  for (const inquiry of [...inquiries].reverse()) {
    if (filter !== 'all' && inquiry.service !== filter) continue;
    const article = document.createElement('article');
    article.className = 'inquiry-record';
    const head = document.createElement('div');
    head.className = 'record-head';
    const title = document.createElement('h3');
    title.textContent = inquiry.business;
    const badge = document.createElement('span');
    const pkg = findPackage(inquiry.service);
    badge.className = 'pill ' + (pkg?.id === 'audit' ? 'audit' : pkg?.price ? 'paid' : 'other');
    badge.textContent = inquiry.service;
    head.append(title, badge);
    const details = document.createElement('p');
    details.textContent = inquiry.name + ' · ' + inquiry.email + ' · ' + inquiry.channel;
    const notes = document.createElement('p');
    notes.textContent = inquiry.challenge || 'No additional notes.';
    const source = document.createElement('p');
    source.textContent = 'Shop: ' + (inquiry.shopUrl || 'Not supplied');
    const date = document.createElement('small');
    date.textContent = new Date(inquiry.createdAt).toLocaleString();
    article.append(head, details, notes, source, date);
    list.append(article);
  }
}

async function loadInquiries() {
  const status = $('inquiry-status');
  const refresh = $('refresh-inquiries');
  refresh.disabled = true;
  status.textContent = 'Loading locally saved inquiries…';
  try {
    const response = await fetch('/api/leads', {cache: 'no-store'});
    if (!response.ok) throw new Error();
    inquiries = await response.json();
    summarize();
    renderInquiries();
    status.textContent = inquiries.length ? inquiries.length + ' request(s) saved on this computer. No email notifications are connected.' : 'No requests yet. Free audit and package requests from the customer site will appear here.';
  } catch {
    status.textContent = 'Could not load the inbox. Use Refresh inbox to retry.';
  } finally {
    refresh.disabled = false;
  }
}
$('refresh-inquiries').addEventListener('click', loadInquiries);
loadInquiries();

// Offer ladder with Week 5 unit economics.
const roles = {audit: 'Free first fix: lead magnet and trust builder', refresh: 'Entry package', 'refresh-1': 'Decoy: makes 3 months look obvious', 'refresh-3': 'Recommended: best value', 'brand-build': 'Price anchor, scoped per client'};
$('economics-basis').textContent = `Based on ${money(economics.hourlyRate)}/hour of your time, ${money(economics.toolsPerMonth)}/month tooling per customer, and 1 in ${1 / economics.auditConversion} free audits converting (${money(acquisitionCost)} acquisition cost per customer). One support month costs about ${money(supportMonthCost)} to deliver.`;
for (const pkg of packages.filter(pkg => roles[pkg.id])) {
  const cost = packageCost(pkg);
  const row = document.createElement('tr');
  if (pkg.id === 'refresh-3') row.className = 'highlight';
  const margin = cost === null ? 'Track hours' : pkg.price === 0 ? 'Acquisition cost' : money(pkg.price - cost) + ' (' + Math.round((pkg.price - cost) / pkg.price * 100) + '%)';
  for (const value of [pkg.label.replace(/ \(.*\)$/, ''), pkg.price === 0 ? 'Free' : money(pkg.price), cost === null ? 'Scoped' : money(cost), margin, roles[pkg.id]]) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  $('economics-rows').append(row);
}

// Listing workbench: score + draft for operator review only.
const output = $('wb-output');
const wbStatus = $('wb-status');
const workbenchData = () => Object.fromEntries(new FormData($('workbench-form')));
async function call(path, body) {
  const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function busy(state) {
  for (const id of ['wb-audit', 'wb-local', 'wb-ai']) $(id).disabled = state;
}
$('wb-audit').addEventListener('click', async () => {
  busy(true); wbStatus.textContent = 'Scoring…';
  try {
    const result = await call('/api/audit', workbenchData());
    const heading = document.createElement('h3');
    heading.textContent = 'Listing check: ' + result.score + '/100';
    const list = document.createElement('ul');
    list.className = 'audit-list';
    for (const check of result.checks) {
      const item = document.createElement('li');
      item.className = check.pass ? 'pass' : 'fail';
      item.textContent = (check.pass ? '✓ ' : '✗ ') + check.name + (check.pass ? '' : ': ' + check.tip);
      list.append(item);
    }
    const note = document.createElement('p');
    note.className = 'sub';
    note.textContent = result.note;
    output.replaceChildren(heading, list, note);
    wbStatus.textContent = '';
  } catch (error) { wbStatus.textContent = error.message; }
  finally { busy(false); }
});
async function draft(mode) {
  busy(true); wbStatus.textContent = mode === 'ai' ? 'Preparing AI draft…' : 'Preparing local draft…';
  try {
    const result = await call('/api/draft', {...workbenchData(), mode, consent: $('wb-consent').checked});
    const heading = document.createElement('h3');
    heading.textContent = (result.mode === 'ai' ? 'AI draft' : 'Local draft') + ': review before sharing';
    const fields = [['Title', result.title], ['Tags', result.tags.join(', ')], ['Description', result.description]].map(([label, value]) => {
      const wrap = document.createElement('label');
      wrap.textContent = label;
      const area = document.createElement('textarea');
      area.value = value;
      area.rows = label === 'Description' ? 6 : 2;
      wrap.append(area);
      return wrap;
    });
    const notes = document.createElement('ul');
    notes.className = 'audit-list';
    for (const text of result.notes) { const item = document.createElement('li'); item.textContent = text; notes.append(item); }
    output.replaceChildren(heading, ...fields, notes);
    wbStatus.textContent = '';
  } catch (error) { wbStatus.textContent = error.message; }
  finally { busy(false); }
}
$('wb-local').addEventListener('click', () => draft('local'));
$('wb-ai').addEventListener('click', () => draft('ai'));
fetch('/api/config').then(r => r.json()).then(config => {
  $('wb-ai').hidden = !config.aiEnabled;
  $('wb-consent-row').hidden = !config.aiEnabled;
}).catch(() => {});
