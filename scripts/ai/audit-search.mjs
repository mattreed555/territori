// Offline development diagnostics; never contacts a teacher or production endpoint.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['data','model','out','search'].map(k=>[k,{type:'string'}]))});
if(!v.data||!v.model||!v.out)throw Error('Use --data decisions.jsonl.gz --model weights.json --out report.json [--search JSON]');
await fs.mkdir(path.dirname(v.out),{recursive:true});
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{validateModel,rankMoves}=await load('ai/policy'),{rankSearchMoves,searchValue,SEARCH_VERSION,DEFAULT_SEARCH}=await load('ai/search'),{moveId,applyMove,legalSuccessors}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const {moveFeatures}=await load('ai/features');
const bytes=await fs.readFile(v.data),modelBytes=await fs.readFile(v.model),model=validateModel(JSON.parse(modelBytes)),options=v.search?JSON.parse(v.search):{};
const rows=finalizedDecisions((v.data.endsWith('.gz')?gunzipSync(bytes):bytes).toString().trim().split('\n').map(JSON.parse)).filter(r=>!model.training.trainGameIds.includes(r.gameId));
const measured=[],latencies=[];
for(const row of rows.slice(0,10))rankSearchMoves(row.state,row.strategy,model,options);
for(const row of rows){
 const start=performance.now(),r=rankSearchMoves(row.state,row.strategy,model,options);latencies.push(performance.now()-start);
 const chosen=r.ranked[0],id=moveId(row.chosenMove),rank=r.ranked.findIndex(x=>moveId(x.move)===id),prior=rankMoves(row.state,row.strategy,model)[0];
 const policyRank=r.policyOrder.findIndex(move=>moveId(move)===id)+1;
 if(!policyRank)throw Error('Teacher move missing from complete policy order');
 const next=applyMove(row.state,row.chosenMove),replies=[...legalSuccessors(next)];
 const recordedValue=replies.length?Math.min(...replies.map(r=>searchValue(r.game,row.state.turn))):searchValue(next,row.state.turn);
 measured.push({id:row.id,source:row.source,strategy:row.strategy,type:row.chosenMove.type,ply:row.state.ply,recorded:id,selected:moveId(chosen.move),prior:moveId(prior.move),same:moveId(chosen.move)===id,priorSame:moveId(prior.move)===id,rank:rank<0?null:rank+1,policyRank,selectedType:chosen.move.type,searchValue:chosen.searchValue,recordedSearchValue:recordedValue,worstReply:chosen.worstReply?moveId(chosen.worstReply):null,nodes:r.nodes,legal:r.legalRootCount,searched:r.ranked.length,result:row.finalResult});
}
const summarize=rs=>{const ranked=rs.filter(r=>r.rank!==null);return {states:rs.length,agreement:rs.length?rs.filter(r=>r.same).length/rs.length:null,priorAgreement:rs.length?rs.filter(r=>r.priorSame).length/rs.length:null,teacherMoveIncluded:ranked.length,averageRankWithinSearchedCandidates:ranked.length?ranked.reduce((s,r)=>s+r.rank,0)/ranked.length:null,averageCompletePolicyRank:rs.length?rs.reduce((s,r)=>s+r.policyRank,0)/rs.length:null,visibleTwoPlyLossesAvoided:rs.filter(r=>r.recordedSearchValue===-10000&&r.searchValue>-10000).length,moveTypes:Object.fromEntries(['place','remove','shift'].map(t=>[t,rs.filter(r=>r.selectedType===t).length]))};};
const teacher=measured.filter(r=>r.source==='jev'),local=measured.filter(r=>r.source==='local');
// Comparable-state styles: all five policies see the SAME sampled boards.
const styleRows=rows.filter((_,i)=>i%10===0),styles=[],pairwise=[];
const styleFeatures=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','centerDistance'];
for(const strategy of Object.keys(STRATEGIES)){
 const decisions=styleRows.map(row=>{const r=rankSearchMoves(row.state,strategy,model,options).ranked[0];return {id:row.id,move:moveId(r.move),type:r.move.type,value:r.searchValue,features:moveFeatures(row.state,r.move,styleFeatures)};});
 styles.push({strategy,states:decisions.length,moves:Object.fromEntries(['place','remove','shift'].map(t=>[t,decisions.filter(d=>d.type===t).length])),meanFeatures:Object.fromEntries(styleFeatures.map((name,i)=>[name,decisions.reduce((s,d)=>s+d.features[i],0)/decisions.length])),decisions});
}
for(let a=0;a<styles.length;a++)for(let b=a+1;b<styles.length;b++)pairwise.push({a:styles[a].strategy,b:styles[b].strategy,different:styles[a].decisions.filter((d,i)=>d.move!==styles[b].decisions[i].move).length,states:styleRows.length});
latencies.sort((a,b)=>a-b);
const report={purpose:'DEVELOPMENT only: saved states, no independent Jev matches; beam ranks are conditional, NOT full-legal-move ranks',search:{version:SEARCH_VERSION,...DEFAULT_SEARCH,...options},datasetSha256:createHash('sha256').update(bytes).digest('hex'),modelSha256:createHash('sha256').update(modelBytes).digest('hex'),teacher:summarize(teacher),byStrategy:Object.fromEntries(Object.keys(STRATEGIES).map(s=>[s,summarize(teacher.filter(r=>r.strategy===s))])),byMoveType:Object.fromEntries(['place','remove','shift'].map(t=>[t,summarize(teacher.filter(r=>r.type===t))])),localRecordedStates:summarize(local),latency:{environment:'Node '+process.version+' on unthrottled server; not mobile gate',samples:latencies.length,p50:latencies[Math.floor(latencies.length*.5)],p95:latencies[Math.floor(latencies.length*.95)],max:latencies.at(-1)},styleComparisons:{styles,pairwise,note:'Differences are diagnostic only, not proof of recognizable strategy intent.'},decisions:measured};
report.completePolicyRankConvention='One-based order: all searched roots by search score, then unsearched roots by learned-prior rank. Not full-width minimax values. Top choice unchanged.';
await atomicJSON(v.out,report);console.log(JSON.stringify({teacher:report.teacher,latency:report.latency}));
