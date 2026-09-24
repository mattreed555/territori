// Report reuse of earlier paid-development inputs; never calls a provider.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{run:{type:'string'}}});if(!v.run)throw Error('Use --run varied-audit-directory');
const files=['experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz','experiments/jev-replacement/20260921-shared-03/dev-matches/decisions.jsonl.gz','experiments/jev-replacement/20260924-search-05/dev-matches/decisions.jsonl.gz','experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz','experiments/jev-replacement/20260924-shift-10/probe/labels.jsonl.gz'];
const strategies=['Aggressive','Cautious','Expansive','Fluid','Balanced'],hash=b=>createHash('sha256').update(b).digest('hex'),bytes=await fs.readFile(v.run+'/positions.json.gz'),positions=JSON.parse(gunzipSync(bytes));
const boardKey=g=>JSON.stringify([g.board,g.turn,g.supply]);
const context=(g,s)=>JSON.stringify([s,g.board,g.turn,g.supply,g.captured,g.finalRound,g.last,Object.entries(g.positions).sort(([a],[b])=>a.localeCompare(b))]);
const allBoards=new Set(),allContexts=new Set(),inputs=[];
for(const file of files){const b=await fs.readFile(file),rows=gunzipSync(b).toString().trim().split('\n').map(JSON.parse).map(e=>e.label?.decision??e.decision??e).filter(e=>e.kind==='decision');const boards=new Set(rows.map(r=>boardKey(r.state))),contexts=new Set(rows.map(r=>context(r.state,r.strategy)));for(const k of boards)allBoards.add(k);for(const k of contexts)allContexts.add(k);inputs.push({file,sha256:hash(b),loggedDecisions:rows.length,boardMatches:positions.filter(p=>boards.has(boardKey(p.state))).length,contextMatches:positions.reduce((n,p)=>n+strategies.filter(s=>contexts.has(context(p.state,s))).length,0)});}
const report={purpose:'Overlap against all earlier paid-development game and counterfactual inputs, including local turns and repeats; no teacher labels on new positions',positionDatasetSha256:hash(bytes),positions:positions.length,decisionContexts:positions.length*5,boardSupplyTurnMatches:positions.filter(p=>allBoards.has(boardKey(p.state))).length,fullContextMatches:positions.reduce((n,p)=>n+strategies.filter(s=>allContexts.has(context(p.state,s))).length,0),fullContextIncludes:'strategy, board, turn, supplies, captured, finalRound, last, sorted full repetition history; ignores ply',inputs};await atomicJSON(v.run+'/overlap.json',report);console.log(JSON.stringify(report));
