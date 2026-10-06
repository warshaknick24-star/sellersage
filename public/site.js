import {audit, validateInput} from './listing.js';

const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
const submitButton = document.querySelector('#submit-lead');
const downloadButton = document.querySelector('#download-brief');
const sampleButtons = [...document.querySelectorAll('[data-sample]')];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
// On the local dev server, requests go to the operator desk. On the live site, they're emailed via FormSubmit.
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const leadEndpoint = isLocal ? '/api/leads' : 'https://formsubmit.co/ajax/warshaknick24@gmail.com';
let submitting = false;
let savedFingerprint = '';
const activeAnimations = new Set();

function showSample(name) {
  for (const button of sampleButtons) {
    const selected = button.dataset.sample === name;
    button.setAttribute('aria-pressed', String(selected));
    document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
  }
}
document.querySelector('.sample-controls').hidden = false;
showSample('etsy');
for (const button of sampleButtons) button.addEventListener('click', () => showSample(button.dataset.sample));

for (const link of document.querySelectorAll('[data-service]')) {
  link.addEventListener('click', () => {
    if (submitting) return;
    const selection = document.querySelector('#lead-service');
    selection.value = link.dataset.service;
    selection.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

function formData() {
  const data = Object.fromEntries(new FormData(form));
  delete data._honey;
  data.consent = document.querySelector('#lead-consent').checked;
  return data;
}
function announce(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}
async function sendLead(payload) {
  if (isLocal) {
    const response = await fetch(leadEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save your request.');
    return 'Saved to the local operator desk.';
  }
  const response = await fetch(leadEndpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify({
      _subject: `SellerSage: ${payload.service} for ${payload.business}`,
      _template: 'table',
      _replyto: payload.email,
      Name: payload.name, Email: payload.email, Shop: payload.business, 'Sells on': payload.channel,
      'Interested in': payload.service, 'Shop link': payload.shopUrl || 'Not given', 'Biggest headache': payload.challenge || 'Not given'
    }),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json().catch(() => ({}));
  // Before the inbox is activated, FormSubmit replies with an activation notice instead of success; that still counts as received.
  const awaitingActivation = /activat/i.test(result.message || '');
  if (!response.ok || (String(result.success) !== 'true' && !awaitingActivation)) throw new Error(result.message || 'Could not send your request.');
  return `Thanks, ${payload.name.split(' ')[0]}! Your request is on its way to Nick, and he’ll reply to ${payload.email}.`;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  if (form.elements._honey.value) return;
  submitting = true;
  submitButton.disabled = true;
  downloadButton.disabled = true;
  announce('Sending…');
  const payload = formData();
  const controls = [...form.querySelectorAll('input, textarea, select')];
  controls.forEach(control => { control.disabled = true; });
  try {
    announce(await sendLead(payload));
    savedFingerprint = JSON.stringify(payload);
  } catch {
    announce('That didn’t go through. Your answers are still here, so please try again in a minute.', true);
  } finally {
    controls.forEach(control => { control.disabled = false; });
    submitButton.disabled = savedFingerprint === JSON.stringify(formData());
    downloadButton.disabled = false;
    submitting = false;
  }
});
form.addEventListener('input', () => {
  if (!submitting) submitButton.disabled = savedFingerprint === JSON.stringify(formData());
});
downloadButton.addEventListener('click', () => {
  const data = formData();
  const brief = [
    'SELLERSAGE: SHOP AUDIT REQUEST',
    'A copy of what you filled in. Downloading this does not send it.',
    '', 'Name: ' + (data.name || ''), 'Email: ' + (data.email || ''),
    'Shop: ' + (data.business || ''), 'Sells on: ' + data.channel,
    'Interested in: ' + data.service, 'Shop link: ' + (data.shopUrl || ''),
    '', 'Biggest headache:', data.challenge || ''
  ].join('\n');
  const url = URL.createObjectURL(new Blob([brief], {type: 'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sellersage-audit-request.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Downloaded a copy. It hasn’t been sent yet.');
});
downloadButton.disabled = false;

// Listing check runs entirely in the browser using the same checklist as the audit.
const checkForm = document.querySelector('#check-form');
const checkSubmit = document.querySelector('#check-submit');
const checkStatus = document.querySelector('#check-status');
const checkResult = document.querySelector('#check-result');
function scoreSummary(score) {
  if (score >= 85) return 'In good shape. Just a little polishing left.';
  if (score >= 60) return 'A decent start, with a few easy wins.';
  if (score >= 35) return 'A few gaps that are probably costing you clicks.';
  return 'Plenty of room to improve, and that’s good news.';
}
const friendlyNames = {
  'Clear listing title': 'Title is clear and the right length',
  'Product description': 'Description has enough detail',
  'Tag coverage': 'Using all 13 tags',
  'Tag length': 'Tags fit Etsy’s 20-character limit',
  'No repeated tags': 'No repeated tags',
  'Search phrase in title': 'Search phrase is in the title',
  'Search phrase in description': 'Search phrase is in the description',
  'Product facts supplied': 'Product facts are included'
};
checkForm.addEventListener('submit', event => {
  event.preventDefault();
  checkStatus.textContent = '';
  let result;
  try {
    result = audit(validateInput(Object.fromEntries(new FormData(checkForm))));
  } catch {
    checkStatus.textContent = 'Add at least a title or a description first.';
    document.querySelector('#check-title-input').focus();
    return;
  }
  const ring = document.querySelector('#check-ring');
  ring.style.setProperty('--pct', result.score);
  ring.style.setProperty('--ring-color', result.score >= 60 ? 'var(--sage)' : 'var(--gold)');
  document.querySelector('#check-score').textContent = result.score;
  document.querySelector('#check-summary').textContent = scoreSummary(result.score);
  document.querySelector('#check-list').replaceChildren(...[...result.checks].sort((a, b) => a.pass - b.pass).map(check => {
    const item = document.createElement('li');
    item.className = check.pass ? 'pass' : 'fail';
    const icon = document.createElement('span');
    icon.textContent = check.pass ? '✓' : '✗';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = friendlyNames[check.name] || check.name;
    text.append(name);
    if (!check.pass) {
      const tip = document.createElement('small');
      tip.textContent = check.tip;
      text.append(tip);
    }
    item.setAttribute('aria-label', (check.pass ? 'Passed: ' : 'Needs work: ') + name.textContent);
    item.append(icon, text);
    return item;
  }));
  document.querySelector('#check-disclaimer').textContent = 'This checks the basics only. It can’t predict your Etsy ranking or judge your photos.';
  checkResult.hidden = false;
  checkResult.focus({preventScroll: true});
  checkResult.scrollIntoView({behavior: motionPreference.matches ? 'auto' : 'smooth', block: 'nearest'});
});
checkSubmit.disabled = false;

// Essential content starts visible. Motion is a one-time enhancement, never a visibility gate.
if ('IntersectionObserver' in window && Element.prototype.animate) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (motionPreference.matches) continue;
      const animation = entry.target.animate(
        [{transform: 'translateY(14px)', opacity: .8}, {transform: 'translateY(0)', opacity: 1}],
        {duration: 450, easing: 'cubic-bezier(.2,.65,.3,1)'}
      );
      activeAnimations.add(animation);
      animation.finished.then(() => activeAnimations.delete(animation)).catch(() => activeAnimations.delete(animation));
    }
  }, {threshold: 0, rootMargin: '0px 0px -30px 0px'});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
motionPreference.addEventListener('change', event => {
  if (event.matches) {
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
  }
});
