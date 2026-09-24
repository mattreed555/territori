// Teacher-blind selection of legal, nonterminal shift opportunities.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{out:{type:'string'},seed:{type:'string'}}});
if(!v.out)throw Error('Use --out DIRECTORY [--seed 2410]');
const seed=Number(v.seed||2410);if(!Number.isSafeInteger(seed))throw Error('Invalid seed');
const load=await loadModules(),{newGame,applyMove,legalMoves,legalSuccessors,legalValueSuccessors,moveId}=await load('game/rules'),{seededRandom}=await load('ai/policy'),{searchValue}=await load('ai/search');
const random=seededRandom(seed),traces=[],shortlist=[];
for(let run=0;run<512;run++){
 const groupId=`shift-probe:${seed}:${run}`,moves=[],candidates=[];let game=newGame();
 while(!game.ended&&game.ply<88){
  const legal=legalMoves(game),p=random(),placeRate=[.9,.6,.4][run%3],type=p<placeRate?'place':p<placeRate+.05?'remove':'shift',pool=legal.filter(m=>m.type===type),available=pool.length?pool:legal;
  const move=available[Math.floor(random()*available.length)];moves.push(move);game=applyMove(game,move);
  if(game.ended||game.ply<16||game.ply%8!==(run%2)||Math.min(...Object.values(game.supply))<2)continue;
  const values=[...legalSuccessors(game)].map(s=>({type:s.move.type,value:searchValue(s.game,game.turn)}));
  const shift=Math.max(...values.filter(r=>r.type==='shift').map(r=>r.value)),other=Math.max(...values.filter(r=>r.type!=='shift').map(r=>r.value));
  if(Number.isFinite(shift)&&Number.isFinite(other))candidates.push({id:`${groupId}:${game.ply}`,groupId,origin:'seeded legal random-play trace',category:'two-ply-shift-opportunity',state:game,proxyGap:shift-other});
 }
 traces.push({id:groupId,seed,moves,ended:game.ended});
 shortlist.push(...candidates.sort((a,b)=>b.proxyGap-a.proxyGap||a.id.localeCompare(b.id)).slice(0,3));
}
for(const p of shortlist){
 const values=[...legalSuccessors(p.state)].map(s=>{
  const replies=[...legalValueSuccessors(s.game)];return {move:moveId(s.move),type:s.move.type,value:replies.length?Math.min(...replies.map(r=>searchValue(r.state,p.state.turn))):searchValue(s.game,p.state.turn)};
 });
 const best=type=>values.filter(r=>(r.type==='shift')===type).sort((a,b)=>b.value-a.value||a.move.localeCompare(b.move))[0];
 p.bestShift=best(true);p.bestOther=best(false);p.gap=p.bestShift.value-p.bestOther.value;
}
const positions=[],groups=new Set();
console.log(JSON.stringify({candidateGroups:Object.fromEntries(['blue','red'].map(color=>[color,[...new Set(shortlist.filter(p=>p.state.turn===color&&p.gap>=-1).map(p=>p.groupId))].length])),topGaps:shortlist.map(p=>p.gap).sort((a,b)=>b-a).slice(0,24)}));
for(const color of ['blue','red']){
 const choices=shortlist.filter(p=>p.state.turn===color&&p.gap>=-1&&Math.abs(p.bestShift.value)<100&&Math.abs(p.bestOther.value)<100).sort((a,b)=>b.gap-a.gap||a.id.localeCompare(b.id));
 let count=0;for(const p of choices){if(groups.has(p.groupId))continue;groups.add(p.groupId);positions.push(p);if(++count===6)break;}
 if(count!==6)throw Error('Insufficient independent groups for '+color);
}
const testGroupIds=positions.filter((_,i)=>i%3===2).map(p=>p.groupId);
await fs.mkdir(v.out,{recursive:true});
await atomicJSON(`${v.out}/positions.json`,{purpose:'DEVELOPMENT targeted shift states; selected before teacher responses; no acceptance games',seed,selection:'512 legal random traces with three placement rates (0.9,0.6,0.4), top three one-ply candidates each, full two-ply ranking, six unique source groups per color; no terminal roots or supply below two',repeats:2,testGroupIds,positions});
await fs.writeFile(`${v.out}/random-traces.jsonl.gz`,gzipSync(traces.map(t=>JSON.stringify(t)).join('\n')+'\n'));
console.log(JSON.stringify({positions:positions.length,testGroupIds,gaps:positions.map(p=>p.gap),plies:positions.map(p=>p.state.ply)}));
