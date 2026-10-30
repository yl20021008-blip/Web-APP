const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
function compile(file,deps={},extra={}){const ctx={exports:{},require:id=>deps[id]||require(id),...extra};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const match=compile('lib/word-match.ts');
assert.ok(match.containsTarget('The carbon-dioxide level fell.','carbon dioxide'));assert.ok(match.containsTarget('She studies birds.','study'));assert.ok(!match.containsTarget('A party was held.','art'));
let calls=0;
const base={titleEn:'A Goal',titleZh:'目标',storyEn:'We found a place.',storyZh:'翻译',memoryTip:'联想'};
const ai=compile('lib/story-ai.ts',{'@/lib/word-match':match},{URL,AbortSignal,process:{env:{STORY_API_KEY:'fake',STORY_MODEL:'mock'}},fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...base,storyEn:++calls===1?'We found a place.':'The oxygen level dropped.'})}}]})})});
(async()=>{
 await ai.generateStory([{id:1,word:'oxygen',annotation:'氧气'}]);assert.equal(calls,2);
 const fail=compile('lib/story-ai.ts',{'@/lib/word-match':match},{URL,AbortSignal,process:{env:{STORY_API_KEY:'fake',STORY_MODEL:'mock'}},fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(base)}}]})})});
 await assert.rejects(fail.generateStory([{id:1,word:'oxygen',annotation:'氧气'}]),/oxygen/);
 let cache=null,generated=0;
 const deps={
 '@/app/api/_helpers':{ok:data=>({ok:true,data}),fail:(error,status)=>({ok:false,error,status}),readJson:async r=>r.json(),serviceFailure:()=>({ok:false,status:503})},
 '@/lib/auth':{requireSession:async()=>({userId:1})},
 '@/lib/story-rag':{retrieveSources:()=>[]},
 '@/lib/story-ai':{StoryError:class extends Error{},modelJson:async()=>{generated++;return JSON.stringify({sentence:'The atmosphere in the meeting room became tense after the announcement.',translation:'消息宣布后会议室气氛紧张。',contextualMeaning:'气氛',explanation:'atmosphere指现场气氛。'})}},
 '@/lib/db':{query:async(sql,params)=>{
 if(sql.includes('SELECT w.id'))return {rows:[{id:1,word:'atmosphere',annotation:'气氛',chapter:'Chapter 1'}]};
 if(sql.includes('SELECT setting_value'))return {rows:cache?[{setting_value:cache}]:[]};
 if(sql.includes('RETURNING setting_value'))return {rows:[{setting_value:'1'}]};
 if(sql.includes('INSERT INTO app_settings')){cache=params[1];return {rows:[]}};throw Error(sql);
 }}
 };
 const route=compile('app/api/examples/route.ts',deps,{process:{env:{STORY_MODEL:'mock'}},Date});
 const req={json:async()=>({wordId:1})};const first=await route.POST(req);assert.ok(first.ok);assert.ok(first.data.blank.includes('______'));assert.ok(!first.data.blank.includes('atmosphere'));assert.equal(first.data.cached,false);
 const second=await route.POST(req);assert.ok(second.ok);assert.equal(second.data.cached,true);assert.equal(generated,1);
 console.log('PASS: inflections, phrase spacing, no substring false match, one story repair, named missing words, generated cloze and persistent cache reuse');
})().catch(e=>{console.error(e);process.exitCode=1});
