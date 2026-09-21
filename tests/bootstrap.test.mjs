import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules();
const {newGame,applyMove,legalMoves,moveId}=await load('game/rules');
const {recordDecision,recordResult,finalizedDecisions}=await load('ai/dataset');
const {moveFeatures,FEATURE_NAMES}=await load('ai/features');
const {trainPolicy,splitGames,evaluatePolicy}=await load('ai/training');
const {validateModel,chooseLocalMove,seededRandom}=await load('ai/policy');
const {simulateGame}=await load('ai/simulator');
const {askJev}=await load('ai/teacher');
test('features represent board consequences and move types',()=>{
 const g=newGame(),m={type:'place',to:27},f=Object.fromEntries(FEATURE_NAMES.map((n,i)=>[n,moveFeatures(g,m)[i]]));
 assert.equal(f.territoryGain,5);assert.equal(f.opponentTerritoryLost,0);assert.equal(f.place,1);assert.equal(f.ownGroupChange,1);assert.equal(f.ownPiecesRemaining,24);assert.equal(f.centerDistance,1);
 let c=applyMove(g,m);c=applyMove(c,{type:'place',to:28});
 const capture=Object.fromEntries(FEATURE_NAMES.map((n,i)=>[n,moveFeatures(c,{type:'remove',to:28})[i]]));
 assert.equal(capture.remove,1);assert.ok(capture.opponentTerritoryLost>0);assert.ok(capture.ownExposureChange<0);
});
test('JSONL records join final outcomes and reject corrupt choices',()=>{
 const g=newGame(),d=recordDecision('one',g,'Balanced',{type:'place',to:0},'jev',{model:'test',answer:{choice:'place_0',probability:.8}});
 assert.equal(d.turnNumber,1);assert.equal(d.legalMoves.length,64);g.board[0]='red';assert.equal(d.state.board[0],null);
 const event=recordResult('one',newGame(),'aborted','test');const rows=finalizedDecisions([d,event]);assert.equal(rows[0].finalResult.status,'aborted');assert.equal(rows[0].teacher.answer.probability,.8);
 assert.throws(()=>finalizedDecisions([{...d,chosenMove:{type:'remove',to:0}}]));
});
function samples(){const rows=[];for(let i=0;i<10;i++){let g=newGame();for(let turn=0;turn<5;turn++){const moves=legalMoves(g),best=moves.map(m=>({m,f:moveFeatures(g,m)})).sort((a,b)=>b.f[0]-a.f[0]||a.f[9]-b.f[9]||moveId(a.m).localeCompare(moveId(b.m)))[0].m;rows.push(recordDecision('synthetic-'+i,g,'Balanced',best,'jev'));g=applyMove(g,best);}}return rows;}
test('whole-game holdout, deterministic training, interpretable model and metrics',()=>{
 const rows=samples(),s=splitGames(rows,42);assert.ok(s.train.every(r=>!s.testGameIds.includes(r.gameId)));assert.throws(()=>splitGames(rows.filter(r=>r.gameId==='synthetic-0')));
 const a=trainPolicy(rows,{seed:42,epochs:12}),b=trainPolicy(rows,{seed:42,epochs:12});assert.deepEqual(a.model,b.model);validateModel(a.model);
 assert.ok(a.report.overall.agreementPercent>0);assert.ok(a.report.overall.averageTeacherRank>=1);assert.equal(a.report.overall.states,s.test.length);assert.ok(!a.model.strategies.Fluid);
 assert.throws(()=>chooseLocalMove(newGame(),'Fluid',a.model));
 const r1=seededRandom(7),r2=seededRandom(7);for(let i=0;i<10;i++)assert.deepEqual(chooseLocalMove(newGame(),'Balanced',a.model,.2,r1),chooseLocalMove(newGame(),'Balanced',a.model,.2,r2));
 assert.throws(()=>validateModel({...a.model,featureVersion:999}));
 assert.equal(evaluatePolicy(rows.map(r=>({...r,source:'local'})),a.model).overall.states,0);
});
test('headless games log all decisions; turn limits never claim winners',async()=>{
 const events=[],agent={source:'local',choose:async g=>({move:legalMoves(g).find(m=>m.type==='place')})};
 const end=await simulateGame({gameId:'complete',players:{blue:'Balanced',red:'Balanced'},agents:{blue:agent,red:agent},write:async e=>{events.push(e);}});
 assert.equal(end.result.status,'completed');assert.equal(end.result.turns,50);assert.equal(finalizedDecisions(events).length,50);assert.ok(finalizedDecisions(events).every(r=>r.finalResult.status==='completed'));
 const limited=await simulateGame({gameId:'short',players:{blue:'Balanced',red:'Balanced'},agents:{blue:agent,red:agent},maxTurns:2,write:async()=>{}});assert.equal(limited.result.status,'truncated');assert.equal(limited.result.winner,null);
});
test('teacher preserves optional response metadata and rejects illegal answers',async()=>{
 const fetchOriginal=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({model:'jev-test',answers:{move:{choice:'place_0',probability:.73}},usage:{tokens:1}});const result=await askJev(newGame(),'Balanced','dummy');assert.equal(result.teacher.answer.probability,.73);assert.equal(result.teacher.model,'jev-test');globalThis.fetch=async()=>Response.json({answers:{move:{choice:'remove_0'}}});await assert.rejects(()=>askJev(newGame(),'Balanced','dummy'),/illegal/);}finally{globalThis.fetch=fetchOriginal;}
});
