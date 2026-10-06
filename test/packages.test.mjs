import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {packages, packageCost, findPackage, acquisitionCost} from '../lib/packages.mjs';

test('unit economics match the Week 5 pricing worksheet', () => {
  assert.equal(acquisitionCost, 80);
  assert.equal(packageCost(findPackage('Free shop audit')), 20);
  assert.equal(packageCost(findPackage('Shop Refresh ($300)')), 215);
  assert.equal(packageCost(findPackage('Refresh + 1 month ($550)')), 290);
  assert.equal(packageCost(findPackage('Refresh + 3 months ($600)')), 440);
  assert.equal(packageCost(findPackage('Full Brand Build ($1,500)')), null);
  for (const pkg of packages.filter(pkg => pkg.price > 0 && packageCost(pkg) !== null)) assert.ok(pkg.price > packageCost(pkg), pkg.label + ' is profitable');
});

test('customer form offers exactly the defined packages', async () => {
  const html = await readFile(new URL('../public/site.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="lead-service"[^>]*>(.*?)<\/select>/s)[1];
  const options = [...select.matchAll(/<option>(.*?)<\/option>/g)].map(match => match[1].replace(/&amp;/g, '&'));
  assert.deepEqual(options, packages.map(pkg => pkg.label));
  for (const [, label] of html.matchAll(/data-service="([^"]+)"/g)) assert.ok(findPackage(label), 'CTA targets a real package: ' + label);
});
