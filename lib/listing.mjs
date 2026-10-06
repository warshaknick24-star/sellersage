export const splitTags = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(x => String(x).trim()).filter(Boolean);
export function validateInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Please provide listing details.');
  const result = {};
  for (const key of ['title','description','tags','keyword','voice','details']) {
    if (data[key] !== undefined && typeof data[key] !== 'string') throw new Error(`${key} must be text.`);
    result[key] = (data[key] || '').trim();
    if (result[key].length > (key === 'description' ? 12000 : 2000)) throw new Error(`${key} is too long.`);
  }
  if (!result.title && !result.description) throw new Error('Add a title or a description first.');
  return result;
}
export function audit(data) {
  const tags = splitTags(data.tags), unique = new Set(tags.map(x=>x.toLowerCase()));
  const keyword = (data.keyword || '').toLowerCase();
  const checks = [
    {name:'Clear listing title',pass:!!data.title && data.title.length <= 140,tip:'Add a readable title, up to 140 characters, that names the product.'},
    {name:'Product description',pass:data.description.trim().length >= 80,tip:'Describe what the buyer receives, using specific product facts. Our 80-character check is a basic completeness heuristic.'},
    {name:'Tag coverage',pass:unique.size === 13 && tags.length === 13,tip:`You have ${unique.size} distinct tags. Review up to 13 relevant phrases; never pad with unrelated terms.`},
    {name:'Tag length',pass:tags.length > 0 && tags.every(t=>t.length <= 20),tip:'Keep each tag within 20 characters.'},
    {name:'No repeated tags',pass:tags.length > 0 && unique.size === tags.length,tip:'Replace repeated tags with distinct, accurate search phrases.'},
    {name:'Search phrase in title',pass:!!keyword && data.title.toLowerCase().includes(keyword),tip:'Choose an accurate buyer search phrase and include it naturally in the title.'},
    {name:'Search phrase in description',pass:!!keyword && data.description.toLowerCase().includes(keyword),tip:'Use your chosen search phrase naturally in the description.'},
    {name:'Product facts supplied',pass:!!data.details?.trim(),tip:'Add material, size, care, or processing details you can verify.'}
  ];
  return {score:Math.round(checks.filter(c=>c.pass).length/checks.length*100),checks,note:'A completeness checklist, not an Etsy ranking or sales prediction. Photo quality needs your visual review.'};
}
export function localDraft(data) {
  const title = (data.title || data.description.split(/[.!?\n]/)[0]).slice(0,140);
  const tags = [...new Set([data.keyword,...splitTags(data.tags)].filter(Boolean).map(t=>t.toLowerCase()))].filter(t=>t.length<=20).slice(0,13);
  return {title,tags,description:[data.description,data.details].filter(Boolean).join('\n\n'),notes:['Local draft: organizes your existing words; no AI or keyword-volume research was used.','Check every product claim and add more relevant tags if needed.'],mode:'local'};
}
export function validateDraft(draft) {
  if (!draft || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length>140 || typeof draft.description !== 'string' || !draft.description.trim() || draft.description.length>16000 || !Array.isArray(draft.tags) || draft.tags.length>13 || draft.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>20) || new Set(draft.tags.map(t=>t.trim().toLowerCase())).size!==draft.tags.length || !Array.isArray(draft.notes) || draft.notes.some(t=>typeof t!=='string')) throw new Error('The generated draft was invalid. Please try again.');
  return draft;
}
