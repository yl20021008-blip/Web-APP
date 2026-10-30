const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const ctx={exports:{},require:id=>{if(id==='@/data/learning-notes.json')return JSON.parse(fs.readFileSync('data/learning-notes.json','utf8'));throw Error(id)}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/story-rag.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,ctx);
const rows=[{id:1,word:'core',annotation:'果核',chapter:'Earth',example_sentence:'The core of the Earth is hot.'}];
const sources=ctx.exports.retrieveSources(rows);
assert.ok(sources.some(s=>s.id==='note-earth-layers' && s.text.includes('地核')));
assert.ok(sources.some(s=>s.id==='word-1' && s.text.includes('Earth is hot')));
assert.ok(!sources.some(s=>s.id==='note-map-coordinates'));
assert.equal(ctx.exports.retrieveSources([{id:2,word:'apple',annotation:null}]).length,0);
const ai={exports:{},process:{env:{STORY_API_KEY:'fake',STORY_MODEL:'mock',STORY_API_BASE_URL:'https://example.com/v1'}},URL,AbortSignal,fetch:async(url,opts)=>{
 const body=JSON.parse(opts.body);const data=JSON.parse(body.messages[1].content);assert.equal(data.retrievedReferences[0].id,'note-earth-layers');
 return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({titleEn:'The Core',titleZh:'地核',storyEn:'We studied the core.',storyZh:'研究地核',memoryTip:'联想'})}}]})};
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/story-ai.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ai);
ai.exports.generateStory(rows,sources).then(()=>console.log('PASS: relevant retrieval, irrelevant exclusion, empty knowledge, source injection into AI request')).catch(e=>{console.error(e);process.exitCode=1});
