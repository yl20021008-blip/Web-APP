import notes from '@/data/learning-notes.json';
export type Source = { id: string; title: string; text: string; source: string };
type Entry = { id: number; word: string; annotation: string | null; example_sentence?: string | null; collocation?: string | null; chapter?: string | null };
export function retrieveSources(words: Entry[]): Source[] {
  const terms = words.map(w => w.word.toLowerCase().trim());
  const ranked = notes.map(note => ({note, score: note.keywords.filter(k => terms.includes(k)).length})).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).slice(0,3);
  const domain: Source[] = ranked.map(({note}) => ({id:note.id,title:note.title,text:note.text,source:note.source}));
  const dictionary = words.slice(0,10).map(w => ({
    id:`word-${w.id}`,title:w.word,
    text:[w.annotation && `Meaning: ${w.annotation}`,w.example_sentence && `Example: ${w.example_sentence}`,w.collocation && `Collocation: ${w.collocation}`].filter(Boolean).join('\n').slice(0,900),
    source:`已导入词库${w.chapter ? ` · ${w.chapter}` : ''}；内容未独立核验`
  })).filter(w => w.text);
  return [...domain,...dictionary];
}
