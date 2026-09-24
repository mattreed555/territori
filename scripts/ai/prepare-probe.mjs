// Preselect common boards without consulting new teacher labels. No paid calls.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{data:{type:'string'},extra:{type:'string'},out:{type:'string'},seed:{type:'string'}}});
if(!v.data||!v.out)throw Error('Use --data saved.jsonl.gz --out directory [--seed 2406]');
const seed=Number(v.seed||2406);if(!Number.isSafeInteger(seed))throw Error('Invalid seed');
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{seededRandom}=await load('ai/policy'),{newGame,legalMoves,legalSuccessors,applyMove}=await load('game/rules'),{searchValue}=await load('ai/search');
const bytes=await fs.readFile(v.data),rows=finalizedDecisions(gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse)),random=seededRandom(seed);
const selected=[],seen=new Set(),key=g=>JSON.stringify([g.board,g.turn,g.supply,g.finalRound]),shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
for(const [phase,min,max] of [['early',4,16],['middle',17,40],['late',41,1000]])for(const color of ['blue','red']){
 const groups=new Set();let count=0;
 for(const row of shuffle(rows.filter(r=>r.state.turn===color&&r.turnNumber>=min&&r.turnNumber<=max))){
  if(seen.has(key(row.state))||groups.has(row.gameId))continue;
  selected.push({id:`saved:${row.id}`,groupId:row.gameId,origin:v.data,category:`saved-${phase}-${color}`,state:row.state});seen.add(key(row.state));groups.add(row.gameId);if(++count===2)break;
 }
 if(count!==2)throw Error('Insufficient saved phase/color coverage');
}
let extraSha256=null;
if(v.extra){
 const bytes=await fs.readFile(v.extra);extraSha256=createHash('sha256').update(bytes).digest('hex');
 const extra=finalizedDecisions(gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse));
 for(const row of extra.filter(r=>r.state.turn==='blue'&&r.state.supply.blue===1&&!r.state.finalRound)){
  const values=[...legalSuccessors(row.state)].map(a=>{const replies=[...legalSuccessors(a.game)];return {move:a.move,value:replies.length?Math.min(...replies.map(b=>searchValue(b.game,row.state.turn))):searchValue(a.game,row.state.turn)};});
  const shift=Math.max(...values.filter(r=>r.move.type==='shift').map(r=>r.value)),other=Math.max(...values.filter(r=>r.move.type!=='shift').map(r=>r.value));
  if(shift>other&&other===-10000&&!seen.has(key(row.state))){selected.push({id:`saved:${row.id}`,groupId:row.gameId,origin:v.extra,category:'shift-defers-visible-terminal-loss',state:row.state,shiftValue:shift,otherValue:other});seen.add(key(row.state));break;}
 }
}
const randomNeeded=20-selected.length,trajectories=[],candidates=[];
for(let i=0;i<16;i++){
 const id=`probe-random:${seed}:${i}`,moves=[];let game=newGame();
 while(!game.ended&&game.ply<80){
  const legal=legalMoves(game),p=random(),type=p<.6?'place':p<.8?'remove':'shift',pool=legal.filter(m=>m.type===type),available=pool.length?pool:legal;
  const move=available[Math.floor(random()*available.length)];moves.push(move);game=applyMove(game,move);
  if(!game.ended&&game.ply>=16&&game.ply%4===0){
   const scored=legalMoves(game).map(move=>({move,value:searchValue(applyMove(game,move),game.turn)})),shift=scored.filter(r=>r.move.type==='shift'),rest=scored.filter(r=>r.move.type!=='shift');
   if(shift.length&&rest.length){const bestShift=Math.max(...shift.map(r=>r.value)),bestOther=Math.max(...rest.map(r=>r.value));candidates.push({id:`${id}:${game.ply}`,groupId:id,origin:'seeded legal random-play trace',category:'shift-opportunity-proxy',state:game,shiftValue:bestShift,otherValue:bestOther,gap:bestShift-bestOther});}
  }
 }
 trajectories.push({id,seed,moves,ended:game.ended});
}
// At most one random position per source game. Single-ply value is a sampling
// proxy, not a claim that a shift is objectively best or that Jev will choose it.
const groups=new Set();for(const row of candidates.sort((a,b)=>b.gap-a.gap||a.id.localeCompare(b.id))){if(groups.has(row.groupId)||seen.has(key(row.state)))continue;selected.push(row);groups.add(row.groupId);seen.add(key(row.state));if(groups.size===randomNeeded)break;}
if(selected.length!==20)throw Error('Could not select twenty varied positions');
await fs.mkdir(v.out,{recursive:true});
await atomicJSON(`${v.out}/positions.json`,{purpose:'Development counterfactual common-state probe; no acceptance outcomes',seed,inputSha256:createHash('sha256').update(bytes).digest('hex'),extraSha256,positions:selected});
await fs.writeFile(`${v.out}/random-traces.jsonl.gz`,gzipSync(trajectories.map(t=>JSON.stringify(t)).join('\n')+'\n'));
console.log(JSON.stringify({positions:selected.length,randomShiftGaps:selected.filter(p=>p.gap!==undefined).map(p=>p.gap)}));
