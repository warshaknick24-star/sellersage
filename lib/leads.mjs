import {appendFile, mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function validateLead(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected inquiry details.');
  const text = (key, max, required = true) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Please provide a valid ${key} (up to ${max} characters).`);
    return value.trim();
  };
  const lead = {name:text('name',100), email:text('email',254), business:text('business',160), channel:text('channel',80), shopUrl:text('shopUrl',2000,false), service:text('service',160), challenge:text('challenge',3000,false)};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) throw new Error('Please provide a valid email address.');
  if (lead.shopUrl) {
    let url;
    try {url = new URL(lead.shopUrl);} catch {throw new Error('Shop link must be a valid http or https URL.');}
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Shop link must be a valid http or https URL without credentials.');
  }
  if (input.consent !== true) throw new Error('Please agree to using these details to respond to your inquiry.');
  return {...lead, consent:true};
}

export function createLeadStore(directory) {
  const file = join(directory, 'leads.jsonl');
  let pending = Promise.resolve();
  return {
    async save(input) {
      const record = {...validateLead(input), id:randomUUID(), createdAt:new Date().toISOString()};
      const write = pending.then(async () => {
        await mkdir(directory, {recursive:true});
        await appendFile(file, `${JSON.stringify(record)}\n`, {encoding:'utf8', flush:true});
      });
      pending = write.catch(() => {});
      await write;
      return record;
    },
    async list() {
      await pending;
      let content;
      try {content = await readFile(file, 'utf8');} catch (error) {if (error.code === 'ENOENT') return []; throw error;}
      return content.split('\n').filter(line => line.trim()).map(line => {
        const record = JSON.parse(line);
        const lead = validateLead(record);
        if (typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(record.id) || typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid saved inquiry.');
        return {...lead, id:record.id, createdAt:record.createdAt};
      });
    }
  };
}
