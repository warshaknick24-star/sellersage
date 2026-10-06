// Builds the static GitHub Pages site into docs/ from public/ and lib/.
import {cp, mkdir, readdir, rm, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('docs/', root);
await mkdir(out, {recursive: true});
// Clear the contents rather than the folder itself, so a server running inside docs/ doesn't block the build.
for (const entry of await readdir(out)) await rm(new URL(entry, out), {recursive: true, force: true});
await mkdir(new URL('assets/', out), {recursive: true});
const copies = [
  ['public/site.html', 'index.html'],
  ['public/site.css', 'site.css'],
  ['public/site.js', 'site.js'],
  ['lib/listing.mjs', 'listing.js'],
  ['public/assets/sellersage-mark.svg', 'assets/sellersage-mark.svg'],
  ['brand/sellersage-logo.png', 'assets/sellersage-logo.png']
];
for (const [from, to] of copies) await cp(new URL(from, root), new URL(to, out));
await writeFile(new URL('.nojekyll', out), '');
console.log('Built docs/ for GitHub Pages:', copies.map(([, to]) => to).join(', '));
