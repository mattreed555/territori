import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
const {positionals,values:v}=parseArgs({allowPositionals:true,options:Object.fromEntries(['out','data','model','report','games','seed','teal','apricot','max-turns','epochs','epsilon','mode','teacher-url','test-fraction','run-id'].map(k=>[k,{type:'string'}]).concat([['random-matchups',{type:'boolean'}]]))});
const load=await loadModules(),{STRATEGIES}=await load('game/strategies'),{askJev}=await load('ai/teacher'),{simulateGame}=await load('ai/simulator'),{seededRandom,chooseLocalMove,validateModel}=await load('ai/policy'),{finalizedDecisions}=await load('ai/dataset'),{trainPolicy,evaluatePolicy}=await load('ai/training');
const num=(k,fallback)=>{const n=Number(v[k]??fallback);if(!Number.isFinite(n))throw Error(`Invalid --${k}`);return n;};
const seed=num('seed',1),random=seededRandom(seed);
async function save(file,obj){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(obj,null,2)+'\n');}
async function readRows(file){if(!file)throw Error('--data is required');const text=await fs.readFile(file,'utf8');return finalizedDecisions(text.split('\n').filter(s=>s.trim()).map((s,i)=>{try{return JSON.parse(s);}catch{throw Error(`Invalid JSONL at line ${i+1}`);}}));}
const strategies=Object.keys(STRATEGIES),strategy=(s)=>{if(!strategies.includes(s))throw Error(`Unknown strategy: ${s}`);return s;};
try {
 switch(positionals[0]) {
 case 'simulate': {
  const mode=v.mode||'jev-vs-jev';if(!['jev-vs-jev','local-vs-jev','local-vs-local'].includes(mode))throw Error('Unknown mode');
  const games=num('games',1),maxTurns=num('max-turns',300),epsilon=num('epsilon',.03);
  if(!Number.isInteger(games)||games<1||games>10000)throw Error('--games must be 1–10000');
  if(epsilon<0||epsilon>1)throw Error('--epsilon must be 0–1');
  const model=mode==='jev-vs-jev'?null:validateModel(JSON.parse(await fs.readFile(v.model,'utf8')));
  if(mode!=='local-vs-local'&&!v['teacher-url']&&!process.env.TYPESAFE_API_KEY)throw Error('Set TYPESAFE_API_KEY or --teacher-url to a Territori /api/robot endpoint');
  const teacher={source:'jev',choose:async(game,s)=>{
   if(!v['teacher-url'])return askJev(game,s,process.env.TYPESAFE_API_KEY);
   const {legalMoves,moveId,nextPositionKey}=await load('game/rules');
   const r=await fetch(v['teacher-url'],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({board:game.board,turn:game.turn,supply:game.supply,captured:game.captured,finalRound:game.finalRound,last:game.last,strategy:s,repetitionCounts:Object.fromEntries(legalMoves(game).map(m=>[moveId(m),game.positions[nextPositionKey(game,m)]||0]))}),signal:AbortSignal.timeout(30000)});
   const data=await r.json();if(!r.ok)throw Error(data.error||`Teacher HTTP ${r.status}`);return data;
  }};
  const local={source:'local',choose:async(game,s)=>({move:chooseLocalMove(game,s,model,epsilon,random)})};
  const out=v.out||'data/decisions.jsonl',runId=v['run-id']||randomUUID(),results=[];
  await fs.mkdir(path.dirname(out),{recursive:true});
  const file=await fs.open(out,'a');
  try { for(let i=0;i<games;i++) {
   const pick=()=>strategies[Math.floor(random()*strategies.length)];
   const players={blue:strategy(v['random-matchups']?pick():v.teal||'Balanced'),red:strategy(v['random-matchups']?pick():v.apricot||'Balanced')};
   const localColor=i%2===0?'blue':'red';
   const agents=mode==='jev-vs-jev'?{blue:teacher,red:teacher}:mode==='local-vs-local'?{blue:local,red:local}:{blue:localColor==='blue'?local:teacher,red:localColor==='red'?local:teacher};
   const result=await simulateGame({gameId:`${runId}:${i}`,players,agents,maxTurns,write:async e=>{await file.write(JSON.stringify(e)+'\n');await file.sync();}});
   results.push({gameId:result.gameId,players,localColor:mode==='local-vs-jev'?localColor:null,...result.result});
   console.log(`Game ${i+1}/${games}: ${result.result.status}, winner ${result.result.winner||'none'}, ${result.result.turns} turns`);
  }} finally {await file.close();}
  const completed=results.filter(r=>r.status==='completed');
  const report={mode,seed,games,epsilon,completed:completed.length,truncated:results.filter(r=>r.status==='truncated').length,localWins:mode==='local-vs-jev'?completed.filter(r=>r.winner===r.localColor).length:null,jevWins:mode==='local-vs-jev'?completed.filter(r=>r.winner&&r.winner!==r.localColor).length:null,draws:completed.filter(r=>!r.winner).length,results};
  await save(v.report||out+'.report.json',report);break;
 }
 case 'train': {
  const rows=await readRows(v.data),result=trainPolicy(rows,{seed,epochs:num('epochs',60),testFraction:num('test-fraction',.2)});
  await save(v.out||'data/policy.json',result.model);await save(v.report||'data/evaluation.json',{...result.split,...result.report});console.log(JSON.stringify({...result.split,...result.report},null,2));break;
 }
 case 'evaluate': {
  const rows=await readRows(v.data),model=validateModel(JSON.parse(await fs.readFile(v.model,'utf8')));
  const trainingIds=new Set(model.training?.trainGameIds||[]),heldOut=rows.filter(r=>!trainingIds.has(r.gameId));
  if(!heldOut.length)throw Error('No held-out decisions; training games are excluded');
  const report={excludedTrainingStates:rows.length-heldOut.length,...evaluatePolicy(heldOut,model)};await save(v.report||'data/evaluation.json',report);console.log(JSON.stringify(report,null,2));break;
 }
 case 'finalize': {const rows=await readRows(v.data);if(!v.out||v.out===v.data)throw Error('Use a separate --out path');await fs.writeFile(v.out,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');break;}
 default:console.log('Commands: simulate, train, evaluate, finalize. See docs/bootstrap.md.');
 }
} catch(e){console.error(e.message);process.exitCode=1;}
