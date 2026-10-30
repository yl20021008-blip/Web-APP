"use client";
import { useState } from 'react';
type Example={sentence:string;translation:string;contextualMeaning:string;explanation:string;blank:string;answer:string;source:string;model:string;cached:boolean};
export default function AIExample({wordId,fillBlank=false}:{wordId:number;fillBlank?:boolean}) {
 const [data,setData]=useState<Example|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[typed,setTyped]=useState(''),[revealed,setRevealed]=useState(false);
 async function generate(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/examples',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wordId}),signal:AbortSignal.timeout(40000)});
   const body=await response.json();if(!response.ok || !body.ok)throw Error(body.error || '例句生成失败');
   setData(body.data);setTyped('');setRevealed(false);
  }catch(e){setError(e instanceof Error && (e.name==='TimeoutError'||e.name==='AbortError')?'例句请求超时，请重试。':e instanceof Error?e.message:'例句生成失败');}finally{setBusy(false);}
 }
 const correct=data && typed.trim().toLowerCase()===data.answer.toLowerCase().trim();
 return <div className="ai-example">
  {!data && <><p>{fillBlank ? '点击生成语境填空题，已有AI例句会直接复用。' : '需要更多语境？生成一条例句和用法解释。'}</p><button className="primary" disabled={busy} onClick={generate}>{busy?'正在生成例句…':'生成 / 获取AI例句'}</button></>}
  {error && <div className="notice error" role="alert">{error}</div>}
  {data && <><small>{data.source} · {data.model} · {data.cached?'已缓存，无需重复生成':'本次生成'}</small><div className="sentence-blank">{fillBlank && !revealed ? data.blank : data.sentence}</div>
   {fillBlank && <div className="spelling-box"><input aria-label="填写目标词" value={typed} onChange={e=>setTyped(e.target.value)} placeholder="填写空缺单词" onKeyDown={e=>{if(e.key==='Enter')setRevealed(true);}}/><button onClick={()=>setRevealed(true)}>检查并查看解释</button></div>}
   {(!fillBlank || revealed) && <><p>{data.translation}</p><p><strong>语境词义：</strong>{data.contextualMeaning}</p><p><strong>用法：</strong>{data.explanation}</p>{fillBlank && <div className={correct?'notice success':'notice'}>{correct?'目标词拼写正确。':`参考答案：${data.answer}。其他表达可能也通顺，本题按目标词核对。`}</div>}</>}
  </>}
 </div>;
}
