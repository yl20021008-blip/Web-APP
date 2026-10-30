// Limited orthographic inflections; this does not validate the meaning or grammar.
export function targetPattern(word: string): string {
  const base = word.trim().toLowerCase().replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ');
  const forms = new Set([base]);
  if (/^[a-z]{3,}$/.test(base)) {
    const irregular: Record<string,string[]> = {go:['went','gone'],be:['is','are','was','were','been'],have:['has','had'],make:['made','makes','making'],take:['took','taken','takes','taking'],write:['wrote','written','writes','writing'],child:['children'],person:['people'],foot:['feet']};
    (irregular[base] || []).forEach(f=>forms.add(f));
    if (/[^aeiou]y$/.test(base)) {forms.add(base.slice(0,-1)+'ies');forms.add(base.slice(0,-1)+'ied');}
    else { forms.add(base+(/(?:s|x|z|ch|sh)$/.test(base)?'es':'s'));forms.add(base+(base.endsWith('e')?'d':'ed')); }
    if (!base.endsWith('y')) forms.add((base.endsWith('e') && !base.endsWith('ee') ? base.slice(0,-1) : base)+'ing');
  }
  return [...forms].sort((a,b)=>b.length-a.length).map(f=>f.split(/[\s-]+/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s-]+')).join('|');
}
export function containsTarget(text: string,word: string): boolean {
  return new RegExp(`(?:^|[^a-zA-Z])(?:${targetPattern(word)})(?=$|[^a-zA-Z])`,'i').test(text);
}
