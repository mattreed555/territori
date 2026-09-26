import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules();
const {prepareLocalPlayer}=await load('ai/local-player'),{createCandidate,CANDIDATE_ID}=await load('ai/candidate');
const {candidateAssets}=await load('ai/candidate-assets'),{DEFAULT_SETTINGS,migrateSettings,validateSettings}=await load('ai/settings');
const {seededRandom,chooseLocalMove}=await load('ai/policy'),{chooseHandcraftedMove}=await load('ai/handcrafted');
const {newGame,applyMove,legalMoves,moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const names=Object.keys(STRATEGIES),settings={engine:'candidate',epsilon:.03,model:null};

test('local candidate is default; all saved Jev selections migrate',()=>{
 assert.equal(DEFAULT_SETTINGS.engine,'candidate');
 assert.equal(migrateSettings({engine:'jev',epsilon:.03,model:null}).engine,'candidate');
 assert.equal(migrateSettings({engine:'jev',epsilon:.03,model:null,version:2}).engine,'candidate');
 assert.equal(migrateSettings({engine:'local',epsilon:.03,model:candidateAssets.policy}).engine,'local');
 assert.deepEqual(validateSettings({engine:'local',epsilon:.03,model:candidateAssets.policy}).model,candidateAssets.policy);
 assert.deepEqual(validateSettings(settings),settings);
 for(const bad of [null,{}, {...settings,engine:'unknown'},{...settings,epsilon:NaN},{...settings,epsilon:-.1},{...settings,model:{}}])assert.throws(()=>validateSettings(bad));
});
test('historical assets remain archived; normal candidate needs none',async()=>{
 const read=async p=>JSON.parse(await fs.readFile(new URL(p,import.meta.url)));
 assert.deepEqual(candidateAssets.policy,await read('../experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json'));
 assert.deepEqual(candidateAssets.style,await read('../experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json'));
 assert.deepEqual(Object.keys(candidateAssets.policy.strategies).sort(),names.sort());
 assert.equal(createCandidate().id,CANDIDATE_ID);
 assert.equal(createCandidate().choose(newGame(),'Balanced',0,seededRandom(2)).type,'place');
});
test('uploaded model errors and candidate chunk failures are clear',async()=>{
 const partial=structuredClone(candidateAssets);delete partial.policy.strategies.Fluid;
 assert.equal(createCandidate(partial).id,CANDIDATE_ID,'normal bot ignores archival model assets');
 await assert.rejects(prepareLocalPlayer({...settings,engine:'local'},names),/does not cover/);
 await assert.rejects(prepareLocalPlayer({...settings,engine:'local',model:partial.policy},names),/does not cover/);
 await assert.rejects(prepareLocalPlayer({...DEFAULT_SETTINGS,engine:'invalid'},names),/Invalid AI settings/);
 await assert.rejects(prepareLocalPlayer(settings,names,async()=>{throw Error('chunk unavailable');}),/No API fallback.*chunk unavailable/);
});
test('local-only boundary makes no fetch calls, including failures and seeded choices',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=()=>{calls++;throw Error('Network must not be used');};
 try{
  const local=await prepareLocalPlayer(settings,names),a=seededRandom(2415),b=seededRandom(2415);
  let g=newGame();
  for(let i=0;i<30&&!g.ended;i++){
   const strategy=names[i%names.length],m=local.choose(g,strategy,a);
   assert.deepEqual(m,chooseHandcraftedMove(g,strategy,.03,b));
   assert.ok(legalMoves(g).some(x=>moveId(x)===moveId(m)));g=applyMove(g,m);
  }
  await assert.rejects(prepareLocalPlayer(settings,names,async()=>{throw Error('missing');}));
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test('uploaded linear policy retains its seeded behavior',async()=>{
 const s={engine:'local',model:candidateAssets.policy,epsilon:.15},local=await prepareLocalPlayer(s,names);
 for(const strategy of names)assert.deepEqual(local.choose(newGame(),strategy,seededRandom(9)),chooseLocalMove(newGame(),strategy,s.model,s.epsilon,seededRandom(9)));
});
test('both controllers use the candidate in seeded bot/bot and simulated human/bot games',async()=>{
 const bot=await prepareLocalPlayer(settings,names);let games=0,decisions=0;
 for(const strategy of names)for(const mode of ['bots','human']){
  let g=newGame();const random=seededRandom(241500+games),humanRandom=seededRandom(912+games);
  while(!g.ended&&g.ply<160){
   const moves=legalMoves(g);
   const m=mode==='human'&&g.turn==='blue'?moves[Math.floor(humanRandom()*moves.length)]:bot.choose(g,strategy,random);
   assert.ok(moves.some(x=>moveId(x)===moveId(m)));g=applyMove(g,m);decisions++;
  }
  assert.ok(g.ended,'game must finish');games++;
 }
 assert.equal(games,10);assert.ok(decisions>100);
});
