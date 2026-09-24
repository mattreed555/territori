import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {validateProtocol,checkAcceptance,summarizeAcceptance,sha256} from './acceptance.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['protocol','runs','model','style','out'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==5)throw Error('Use --protocol FILE --runs DIR --model FILE --style FILE --out FILE');
const bytes=await fs.readFile(v.protocol),protocol=validateProtocol(JSON.parse(bytes)),batches=[],run=promisify(execFile);
for(const batch of protocol.batches){
 const directory=path.join(v.runs,batch.runId);
 try{await fs.stat(directory);}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const item={runId:batch.runId,verified:false,results:[],failure:null};
 try{
  const read=async file=>JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
  const p=await read('provenance.json'),summary=await read('summary.json');
  const checked=await checkAcceptance(v.protocol,p);if(checked.metadata.sha256!==p.acceptance?.sha256)throw Error('Protocol digest mismatch');
  item.failure=summary.failure;item.costUpperNano=summary.spentUpperNano;
  const events=gunzipSync(await fs.readFile(path.join(directory,'decisions.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
  item.observedStatuses=events.filter(e=>e.kind==='result').map(e=>({gameId:e.gameId,status:e.result.status,reason:e.result.reason}));
  // Recompute, do not simply trust a stale integrity.json file.
  await run(process.execPath,['scripts/ai/verify-session.mjs','--run',directory,'--model',v.model,'--style',v.style,'--protocol',v.protocol],{maxBuffer:2**20});
  item.results=events.filter(e=>e.kind==='result').map(e=>{const index=Number(e.gameId.slice(p.runId.length+1)),localColor=Math.floor(index/5)%2===0?'blue':'red';return {gameId:e.gameId,strategy:p.matchups[index][localColor],localColor,...e.result};});
  item.verified=true;
 }catch(e){item.error=e.message;}
 batches.push(item);
}
const report={...summarizeAcceptance(protocol,batches),protocolSha256:sha256(bytes)};
await atomicJSON(v.out,report);console.log(JSON.stringify({batches:report.batchesPresent,complete:report.complete,strengthPass:report.strengthPass,readyForDeployment:false}));
