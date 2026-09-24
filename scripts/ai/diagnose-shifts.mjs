// Separate root-beam omissions from tactical/learned-score rejection. No API.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['positions','policy','style','out'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==4)throw Error('Use --positions FILE --policy MODEL --style MODEL --out FILE');
const load=await loadModules(),{rankSearchMoves}=await load('ai/search'),{rankStyledMoves,styleScore}=await load('ai/style'),{moveId}=await load('game/rules');
const hashes={},read=async f=>{const b=await fs.readFile(f);hashes[f]=createHash('sha256').update(b).digest('hex');return JSON.parse(b);};
const {positions}=await read(v.positions),policy=await read(v.policy),style=await read(v.style),rows=[];
for(const p of positions){
 const strategy='Fluid',normal=rankSearchMoves(p.state,strategy,policy),full=rankSearchMoves(p.state,strategy,policy,{policyBeam:0}),styled=rankStyledMoves(p.state,strategy,policy,style,{weight:.5,margin:1}),bestValue=Math.max(...full.ranked.map(r=>r.searchValue));
 const shifts=full.ranked.filter(r=>r.move.type==='shift').sort((a,b)=>b.searchValue-a.searchValue||b.score-a.score);
 const detail=r=>({move:moveId(r.move),searchValue:r.searchValue,prior:r.prior,score:r.score,styleScore:styleScore(p.state,r.move,strategy,style),inNormalBeam:normal.ranked.some(n=>moveId(n.move)===moveId(r.move)),gapToFullBest:r.searchValue-bestValue});
 rows.push({positionId:p.id,groupId:p.groupId,normal:detail(normal.ranked[0]),styledChoice:moveId(styled.ranked[0].move),full:detail(full.ranked[0]),bestShift:detail(shifts[0]),nearBestShifts:shifts.filter(r=>r.searchValue>=bestValue-1).map(detail),legalRoots:full.legalRootCount,normalRoots:normal.ranked.length});
}
const summary={positions:rows.length,bestShiftOmitted:rows.filter(r=>!r.bestShift.inNormalBeam).length,allNearBestShiftsOmitted:rows.filter(r=>r.nearBestShifts.length&&!r.nearBestShifts.some(s=>s.inNormalBeam)).length,normalShiftChoices:rows.filter(r=>r.normal.move.startsWith('shift_')).length,fullShiftChoices:rows.filter(r=>r.full.move.startsWith('shift_')).length,styledShiftChoices:rows.filter(r=>r.styledChoice.startsWith('shift_')).length};
await atomicJSON(v.out,{purpose:'Fluid development root-beam diagnostic, not strength or acceptance',hashes,summary,rows});console.log(JSON.stringify(summary));
