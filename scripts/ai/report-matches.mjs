// Summarize a metered local/Jev development batch without claiming readiness.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{run:{type:'string'}}});
if(!v.run)throw Error('Use --run batch-directory');
const read=async name=>JSON.parse(await fs.readFile(`${v.run}/${name}`,'utf8'));
const p=await read('provenance.json'),summary=await read('summary.json');
if(p.mode!=='local-vs-jev')throw Error('Not a local/Jev batch');
const events=gunzipSync(await fs.readFile(`${v.run}/decisions.jsonl.gz`)).toString().trim().split('\n').map(JSON.parse);
const results=events.filter(e=>e.kind==='result').map(e=>{const i=Number(e.gameId.slice(e.gameId.lastIndexOf(':')+1)),localColor=Math.floor(i/5)%2===0?'blue':'red';return {gameId:e.gameId,strategy:p.matchups[i][localColor],localColor,...e.result,points:e.result.status==='completed'?(e.result.winner===localColor?1:e.result.winner===null?.5:0):null};});
const stats=rows=>{const done=rows.filter(r=>r.status==='completed'),n=done.length,points=done.reduce((s,r)=>s+r.points,0),score=n?points/n:null,delta=n?Math.sqrt(Math.log(40)/(2*n)):null;return {completed:n,aborted:rows.filter(r=>r.status==='aborted').length,truncated:rows.filter(r=>r.status==='truncated').length,wins:done.filter(r=>r.points===1).length,draws:done.filter(r=>r.points===.5).length,losses:done.filter(r=>r.points===0).length,score,conservative95ScoreInterval:n?[Math.max(0,score-delta),Math.min(1,score+delta)]:null,meanTurns:n?done.reduce((s,r)=>s+r.turns,0)/n:null,repetitionEnds:done.filter(r=>r.reason==='repetition').length};};
const strategies=['Aggressive','Cautious','Expansive','Fluid','Balanced'];
const report={purpose:'Development evidence only, not the independently seeded acceptance suite',modelSha256:p.modelSha256,seed:p.seed,epsilon:p.epsilon,costUpperNano:summary.spentUpperNano,requestedGames:summary.requestedGames,unstartedGames:summary.requestedGames-results.length,failure:summary.failure,overall:stats(results),byStrategy:Object.fromEntries(strategies.map(s=>[s,stats(results.filter(r=>r.strategy===s))])),byLocalColor:Object.fromEntries(['blue','red'].map(c=>[c,stats(results.filter(r=>r.localColor===c))])),intervalMethod:'Two-sided Hoeffding bound for a mean reward in [0,1]: mean ± sqrt(log(2/0.05)/(2n)), clipped to [0,1]; assumes independent runs, deliberately conservative. No strength claim from this small selected-model sample.',results};
await atomicJSON(`${v.run}/evaluation.json`,report);console.log(JSON.stringify(report.overall));
