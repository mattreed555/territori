// New shared states from all-pairing self-play, with no teacher labels or fitting.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run','policy','style','out'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==4)throw Error('Use --run PREFIX --policy MODEL --style MODEL --out DIR');
const load=await loadModules(),{rankIntentMoves}=await load('ai/intent'),{moveFeatures}=await load('ai/features'),{moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const b=await fs.readFile(v.run+'.jsonl.gz'),events=gunzipSync(b).toString().trim().split('\n').map(JSON.parse),gameIds=[...new Set(events.map(e=>e.gameId))],policy=JSON.parse(await fs.readFile(v.policy)),style=JSON.parse(await fs.readFile(v.style)),hash=b=>createHash('sha256').update(b).digest('hex');
const positions=gameIds.map((id,i)=>{const ply=19+(i%3)*10+i%2,e=events.find(e=>e.kind==='decision'&&e.gameId===id&&e.state.ply===ply);if(!e)throw Error('Missing predeclared sampling ply');return {id:e.id,groupId:id,origin:v.run+'.jsonl.gz',category:'new-local-cross-strategy-state',state:e.state};});
if(positions.length!==25)throw Error('Expected every ordered strategy pairing');
const strategies=Object.keys(STRATEGIES),features=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift','repetitionCount'],rows=[],reports=[];
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
for(const strength of [0,1]){
 const selected=[];for(const p of positions)for(const strategy of strategies){const r=rankIntentMoves(p.state,strategy,policy,style,{strength,margin:1}),choice=r.ranked[0];selected.push({strength,positionId:p.id,strategy,move:moveId(choice.move),type:choice.move.type,concession:Math.max(...r.ranked.map(r=>r.searchValue))-choice.searchValue,intentScore:choice.intentScore,eligibleUsefulShiftOptions:strategy==='Fluid'&&strength>0?r.ranked.filter(x=>x.move.type==='shift'&&x.intentScore===1&&x.intentEligible).length:null,features:moveFeatures(p.state,choice.move,features)});}
 const pairs=[];for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)pairs.push({a:strategies[a],b:strategies[b],different:positions.filter(p=>selected.find(r=>r.positionId===p.id&&r.strategy===strategies[a]).move!==selected.find(r=>r.positionId===p.id&&r.strategy===strategies[b]).move).length,positions:positions.length});
 reports.push({strength,pairs,byStrategy:Object.fromEntries(strategies.map(s=>{const rs=selected.filter(r=>r.strategy===s);return [s,{states:rs.length,features:Object.fromEntries(features.map((f,j)=>[f,mean(rs.map(r=>r.features[j]))])),meanTacticalConcession:mean(rs.map(r=>r.concession)),positionsWithEligibleUsefulShifts:s==='Fluid'&&strength>0?rs.filter(r=>r.eligibleUsefulShiftOptions>0).length:null,usefulFluidShifts:rs.filter(r=>s==='Fluid'&&r.type==='shift'&&r.intentScore===1).length}];}))});rows.push(...selected);
}
await fs.mkdir(v.out,{recursive:true});
await atomicJSON(`${v.out}/fresh-common-state-audit.json`,{purpose:'New shared local-selfplay states, not Jev labels or independent acceptance',sampling:'One state per ordered pairing; ply 19+(index%3)*10+index%2, fixed before inspection; no outcome filtering',sourceDatasetSha256:hash(b),policySha256:hash(await fs.readFile(v.policy)),styleSha256:hash(await fs.readFile(v.style)),intentSourceSha256:hash(await fs.readFile('lib/ai/intent.ts')),reports});
await fs.writeFile(`${v.out}/fresh-positions.json.gz`,gzipSync(JSON.stringify({positions})));await fs.writeFile(`${v.out}/fresh-choices.json.gz`,gzipSync(JSON.stringify(rows)));
console.log(JSON.stringify(reports));
