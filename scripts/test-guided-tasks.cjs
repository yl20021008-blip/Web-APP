const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('app/api/study/today/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let queries=0;
const deps={
 '@/app/api/_helpers':{ok:data=>({ok:true,data}),fail:()=>({ok:false}),serviceFailure:()=>({ok:false,status:503})},
 '@/lib/auth':{requireSession:async()=>({userId:42})},
 '@/lib/db':{query:async(sql,params)=>{queries++;assert.equal(params[0],42);return {rows:sql.includes("ls.status = 'new'") ? [{id:2,task_type:'new'}] : [{id:1,task_type:'review'}]}}}
};
const ctx={exports:{},require:id=>deps[id],URL};vm.runInNewContext(code,ctx);
(async()=>{const review=await ctx.exports.GET({url:'https://example.com/api/study/today?mode=review&target=5'});const fresh=await ctx.exports.GET({url:'https://example.com/api/study/today?mode=new&target=5'});assert.equal(review.data.length,1);assert.equal(review.data[0].id,1);assert.equal(fresh.data.length,1);assert.equal(fresh.data[0].id,2);assert.equal(queries,2);console.log('PASS: guided review/new stages return distinct authenticated tasks');})().catch(e=>{console.error(e);process.exitCode=1});
