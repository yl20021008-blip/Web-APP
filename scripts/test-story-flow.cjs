const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const route=ts.transpileModule(fs.readFileSync('app/api/stories/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const wordList=['core','crust','mantle','oxygen','latitude'].map((word,i)=>({id:i+1,word,annotation:'meaning'}));
let calls=0,committed=false,rolledBack=false,storedTip;
class StoryError extends Error {constructor(message,status=502){super(message);this.status=status}}
let failAI=false;
const client={release(){},async query(sql,params){
 if(sql==='COMMIT'){committed=true;return {rows:[]}}
 if(sql==='ROLLBACK'){rolledBack=true;return {rows:[]}}
 if(sql.includes('COUNT(*)')){assert.match(sql,/provider = 'ai_chat_completions'/);return {rows:[{count:0}]}}
 if(sql.includes('SELECT memory_tip'))return {rows:[{memory_tip:'old template tip'}]};
 if(sql.includes('SELECT w.word FROM story_group_items'))return {rows:wordList};
 if(sql.includes('FROM learning_status ls')){assert.ok(!sql.includes('NOT EXISTS'));return {rows:wordList}}
 if(sql.includes('MAX(group_number)'))return {rows:[{next_no:2}]};
 if(sql.includes('INSERT INTO story_groups(')){storedTip=JSON.parse(params[6]);return {rows:[{id:2}]}}
 return {rows:[]};
}};
const deps={
 '@/lib/story-rag':{retrieveSources:words=>words.map(w=>({id:'word-'+w.id,title:w.word,text:w.annotation,source:'wordbook'}))},
 '@/app/api/_helpers':{ok:data=>({ok:true,data}),fail:(error,status)=>({ok:false,error,status}),readJson:async r=>r.json(),serviceFailure:()=>({ok:false,status:503})},
 '@/lib/auth':{requireSession:async()=>({userId:1})},
 '@/lib/db':{getPool:()=>({connect:async()=>client}),query:async()=>({rows:[]})},
 '@/lib/story-ai':{StoryError,generateStory:async()=>{calls++;if(failAI)throw new StoryError('mock API error');return {titleEn:'Title',titleZh:'标题',storyEn:'core crust mantle oxygen latitude',storyZh:'翻译',memoryTip:'tip'}}}
};
const ctx={exports:{},require:id=>deps[id],process:{env:{STORY_API_KEY:'fake',STORY_MODEL:'mock-model'}}};vm.runInNewContext(route,ctx);
(async()=>{
 const first=await ctx.exports.POST({json:async()=>({storyId:1,size:10})});
 assert.equal(first.ok,true);assert.equal(calls,1);assert.equal(committed,true);assert.equal(storedTip.words.length,5);assert.equal(storedTip.model,'mock-model');
 committed=false;failAI=true;
 const second=await ctx.exports.POST({json:async()=>({size:10})});assert.equal(second.ok,false);assert.equal(rolledBack,true);assert.equal(committed,false);
 delete ctx.process.env.STORY_API_KEY;const before=calls;const third=await ctx.exports.POST({json:async()=>({size:10})});assert.equal(third.status,503);assert.equal(calls,before);
 console.log('PASS: old-template words reach AI, quota excludes templates, metadata saved, API errors rollback, missing key diagnosed');
})().catch(e=>{console.error(e);process.exitCode=1});
