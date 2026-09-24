import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame}=await load('game/rules'),{recordDecision}=await load('ai/dataset'),{recordCounterfactual}=await load('ai/counterfactual'),{trainingDecisions,trainingGroup}=await load('ai/training-data'),{splitGames,splitByGameIds,trainPolicy}=await load('ai/training');
const metadata={model:'test',answer:null};
const probe=(group,strategy='Fluid',to=27)=>recordCounterfactual({id:group+'-position',groupId:group,origin:'fixture',category:'test',state:newGame()},strategy,{type:'place',to},metadata);
test('counterfactual and ordinary decisions share a source-game fold without rewriting identities',()=>{
 const p=probe('source'),q=probe('source','Cautious');
 const ordinary=recordDecision('source',newGame(),'Balanced',{type:'place',to:28},'jev',metadata);
 const rows=trainingDecisions([ordinary],[p,q,p,probe('other')]);
 assert.equal(rows.length,4);assert.equal(rows[1].id,p.decision.id);assert.equal(rows[1].finalResult,null);
 const split=splitByGameIds(rows,['source']);assert.equal(split.test.length,3);assert.equal(split.train.length,1);
 assert.ok(split.test.every(r=>trainingGroup(r)==='source'));
 for(let seed=1;seed<10;seed++){
  const s=splitGames(rows,seed,.5),train=new Set(s.train.map(trainingGroup));
  assert.ok(s.test.every(r=>!train.has(trainingGroup(r))));
 }
 assert.deepEqual(p,probe('source'));
});
test('counterfactual adapter rejects invented outcomes, conflicting labels and forged legality',()=>{
 const p=probe('source');
 assert.throws(()=>trainingDecisions([],[p,probe('source','Fluid',28)]));
 assert.throws(()=>trainingDecisions([],[{...p,decision:{...p.decision,finalResult:{winner:'blue'}}}]));
 assert.throws(()=>trainingDecisions([],[{...p,decision:{...p.decision,legalMoves:[]}}]));
 assert.throws(()=>trainingDecisions([],[{...p,decision:{...p.decision,gameId:'forged'}}]));
});
test('held-out counterfactual labels cannot change fitted weights or scaling',()=>{
 const a=trainingDecisions([],[probe('train'),probe('test')]);
 const b=trainingDecisions([],[probe('train'),probe('test','Fluid',0)]);
 const options={testGameIds:['test'],epochs:2,features:['territoryGain','place','remove','shift']};
 const first=trainPolicy(a,options),second=trainPolicy(b,options);
 assert.deepEqual(first.model,second.model);assert.deepEqual(first.model.training.trainGameIds,['train']);
});
