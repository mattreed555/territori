// Fixed-candidate audit on reproducible synthetic legal traces, no teacher/API.
import fs from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{...Object.fromEntries(['policy','style','out','seed'].map(k=>[k,{type:'string'}])),verify:{type:'boolean'}}});
if(!v.policy||!v.style||!v.out)throw Error('Use --policy MODEL --style MODEL --out DIRECTORY [--seed 2413] [--verify]');
const load=await loadModules(),{newGame,applyMove,legalMoves,moveId}=await load('game/rules'),{seededRandom}=await load('ai/policy'),{rankIntentMoves}=await load('ai/intent'),{moveFeatures}=await load('ai/features'),{STRATEGIES}=await load('game/strategies');
const hash=b=>createHash('sha256').update(b).digest('hex'),pb=await fs.readFile(v.policy),sb=await fs.readFile(v.style),policy=JSON.parse(pb),style=JSON.parse(sb),source=await fs.readFile('lib/ai/intent.ts');
const features=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift','repetitionCount'];
const plies=[12,25,38,51],profiles=[{name:'place-heavy',place:.85,remove:.10},{name:'mixed',place:.6,remove:.2},{name:'shift-heavy',place:.35,remove:.15},{name:'noisy-territory',greedy:.65}];
const seed=Number(v.seed||2413);if(!Number.isSafeInteger(seed))throw Error('Invalid seed');
function trace(index){
 const profile=profiles[index%4],random=seededRandom(seed+index*10007),moves=[],states=[];let game=newGame();
 while(!game.ended&&game.ply<64){
  const legal=legalMoves(game);let choices;
  if(profile.greedy){
   if(random()<profile.greedy){const scored=legal.map(m=>({m,value:moveFeatures(game,m,['territoryGain','opponentTerritoryLost']).reduce((a,b)=>a+b,0)})),best=Math.max(...scored.map(s=>s.value));choices=scored.filter(s=>s.value===best).map(s=>s.m);}else choices=legal;
  }else{const p=random(),type=p<profile.place?'place':p<profile.place+profile.remove?'remove':'shift',pool=legal.filter(m=>m.type===type);choices=pool.length?pool:legal;}
  const move=choices[Math.floor(random()*choices.length)];moves.push(move);game=applyMove(game,move);
  if(!game.ended&&plies.includes(game.ply))states.push({id:`varied:${seed}:${index}:${game.ply}`,groupId:`varied:${seed}:${index}`,profile:profile.name,state:game});
 }
 return {id:`varied:${seed}:${index}`,profile:profile.name,index,moves,ended:game.ended,states};
}
await fs.mkdir(v.out,{recursive:true});
if(v.verify){
 const traces=JSON.parse(gunzipSync(await fs.readFile(`${v.out}/traces.json.gz`))),positions=JSON.parse(gunzipSync(await fs.readFile(`${v.out}/positions.json.gz`))),rows=JSON.parse(gunzipSync(await fs.readFile(`${v.out}/choices.json.gz`))),report=JSON.parse(await fs.readFile(`${v.out}/report.json`));
 assert.equal(report.seed,seed);assert.equal(report.policySha256,hash(pb));assert.equal(report.styleSha256,hash(sb));assert.equal(report.intentSha256,hash(source));
 let moves=0;const regenerated=traces.flatMap(t=>{const again=trace(t.index);assert.deepEqual(again,t);moves+=t.moves.length;return again.states;});assert.deepEqual(regenerated,positions);
 for(const row of rows){const p=positions.find(p=>p.id===row.positionId),rank=rankIntentMoves(p.state,row.strategy,policy,style,{strength:row.strength,margin:1});assert.equal(moveId(rank.ranked[0].move),row.move);assert.deepEqual(moveFeatures(p.state,rank.ranked[0].move,features),row.features);}
 const result={traces:traces.length,traceMoves:moves,positions:positions.length,choices:rows.length,allTracesStatesAndGreedyChoicesReproduced:true,paidCalls:0};await atomicJSON(`${v.out}/integrity.json`,result);console.log(JSON.stringify(result));
}else{
 // No selection by policy outputs or outcomes; every scheduled nonterminal ply.
 const traces=Array.from({length:80},(_,i)=>trace(i)),positions=traces.flatMap(t=>t.states),rows=[];
 for(const p of positions)for(const strategy of Object.keys(STRATEGIES))for(const strength of [0,1]){
  const t=performance.now(),rank=rankIntentMoves(p.state,strategy,policy,style,{strength,margin:1}),ms=performance.now()-t,choice=rank.ranked[0];
  assert.ok(legalMoves(p.state).some(m=>moveId(m)===moveId(choice.move)));
  const best=Math.max(...rank.ranked.map(r=>r.searchValue)),concession=best-choice.searchValue;assert.ok(concession<=1+1e-9);if(best===10000)assert.equal(choice.searchValue,10000);
  rows.push({positionId:p.id,groupId:p.groupId,profile:p.profile,ply:p.state.ply,player:p.state.turn,strategy,strength,move:moveId(choice.move),type:choice.move.type,concession,eligibleUsefulShiftOptions:strategy==='Fluid'&&strength===1?rank.ranked.filter(r=>r.intentEligible&&r.move.type==='shift'&&r.intentScore===1).length:null,selectedUsefulShift:strategy==='Fluid'&&strength===1&&choice.move.type==='shift'&&choice.intentScore===1,features:moveFeatures(p.state,choice.move,features),ms});
 }
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 function summary(subset){return Object.fromEntries(Object.keys(STRATEGIES).map(strategy=>[strategy,Object.fromEntries([0,1].map(strength=>{const rs=subset.filter(r=>r.strategy===strategy&&r.strength===strength),eligible=rs.filter(r=>r.eligibleUsefulShiftOptions>0);return [strength,{positions:rs.length,features:Object.fromEntries(features.map((f,i)=>[f,mean(rs.map(r=>r.features[i]))])),meanConcession:mean(rs.map(r=>r.concession)),usefulShiftOpportunityStates:strength===1&&strategy==='Fluid'?eligible.length:null,conditionalUsefulShiftRate:eligible.length?mean(eligible.map(r=>Number(r.selectedUsefulShift))):null,selectedUsefulShifts:rs.filter(r=>r.selectedUsefulShift).length}];}))]));}
 const pairs=[];const strategies=Object.keys(STRATEGIES);for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)pairs.push({a:strategies[a],b:strategies[b],different:positions.filter(p=>rows.find(r=>r.positionId===p.id&&r.strategy===strategies[a]&&r.strength===1).move!==rows.find(r=>r.positionId===p.id&&r.strategy===strategies[b]&&r.strength===1).move).length,positions:positions.length});
 const times=rows.filter(r=>r.strength===1).map(r=>r.ms).sort((a,b)=>a-b),result={purpose:'Fixed intent11 candidate on synthetic legal random/greedy traces; not human data, teacher imitation or acceptance matches',seed,profiles,scheduledPlies:plies,traceCount:traces.length,positions:positions.length,choices:rows.length,policySha256:hash(pb),styleSha256:hash(sb),intentSha256:hash(source),scriptSha256:hash(await fs.readFile('scripts/ai/audit-varied.mjs')),summary:summary(rows),byProfile:Object.fromEntries(profiles.map(p=>[p.name,summary(rows.filter(r=>r.profile===p.name))])),pairs,latency:{environment:`${process.version}, unthrottled shared-host Node, NOT mobile gate`,p95ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1)},paidCalls:0};
 await atomicJSON(`${v.out}/report.json`,result);for(const [name,data] of Object.entries({traces,positions,choices:rows}))await fs.writeFile(`${v.out}/${name}.json.gz`,gzipSync(JSON.stringify(data)));
 console.log(JSON.stringify({positions:result.positions,choices:result.choices,summary:result.summary,pairs,latency:result.latency}));
}
