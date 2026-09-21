import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateLease,chargeForUsage,openMeter,REQUEST_BOUND_NANO} from '../scripts/ai/budget.mjs';
const fixture=()=>({version:1,allowanceNano:4250000000,evaluationReserveNano:2750000000,spentUpperNano:0,pricing:{verifiedAt:new Date().toISOString(),nanoPerInputToken:42,nanoPerOutputToken:0,maxInputTokens:65536},sessions:[{id:'test',status:'reserved',capNano:10000000,expiresAt:new Date(Date.now()+3600000).toISOString(),purpose:'training'}]});
test('cumulative budget protects evaluation, stale leases, pricing and overlap',()=>{
 const b=fixture();validateLease(b,'test');b.spentUpperNano=1495000000;assert.throws(()=>validateLease(b,'test'),/exceeds/);
 b.spentUpperNano=0;b.sessions.push({...b.sessions[0],id:'other'});assert.throws(()=>validateLease(b,'test'),/another/);b.sessions.pop();
 assert.throws(()=>validateLease(b,'test',Date.now()+86400001),/Expired/);
 b.pricing.verifiedAt='invalid';assert.throws(()=>validateLease(b,'test'),/pricing/);
});
test('usage is priced exactly and unknown models or malformed usage stop paid work',()=>{
 const t={model:'jev-1.13.0',usage:{input_tokens:11135,output_tokens:649}};
 assert.equal(chargeForUsage(t),467670);
 for(const teacher of [{}, {...t,model:'jev-latest'}, {...t,usage:{input_tokens:65537,output_tokens:1}}, {...t,usage:{input_tokens:1.2,output_tokens:1}}])assert.throws(()=>chargeForUsage(teacher));
});
test('meter journals before calls, refuses reuse and retains timeout bounds',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'territori-budget-'));
 try{
  const ledgerFile=path.join(dir,'budget.json'),journalFile=path.join(dir,'usage.jsonl');await fs.writeFile(ledgerFile,JSON.stringify(fixture()));
  const meter=await openMeter({ledgerFile,journalFile,runId:'test'});
  await assert.rejects(()=>openMeter({ledgerFile,journalFile,runId:'test'}),/EEXIST/);
  await meter.request(async()=>{assert.match(await fs.readFile(journalFile,'utf8'),/reservedNano/);return {teacher:{model:'jev-1.13.0',usage:{input_tokens:100,output_tokens:1}}};},{});
  await assert.rejects(()=>meter.request(async()=>{throw Error('timeout');},{}),/timeout/);
  await assert.rejects(()=>meter.request(async()=>{assert.fail('must not call');},{}),/stopped/);
  const summary=await meter.close();assert.equal(summary.spentUpperNano,4200+REQUEST_BOUND_NANO);assert.equal(summary.calls,2);
  const saved=JSON.parse(await fs.readFile(ledgerFile,'utf8'));assert.equal(saved.spentUpperNano,summary.spentUpperNano);assert.equal(saved.sessions[0].status,'closed-with-uncertainty');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
