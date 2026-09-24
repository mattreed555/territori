import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame}=await load('game/rules'),{finalizedDecisions}=await load('ai/dataset'),{recordCounterfactual}=await load('ai/counterfactual');
test('counterfactual labels preserve source grouping but invent no played result',()=>{
 const position={id:'p1',groupId:'source-game',origin:'saved',category:'test',state:newGame()};
 const a=recordCounterfactual(position,'Fluid',{type:'place',to:27},{model:'test',answer:null}),b=recordCounterfactual(position,'Cautious',{type:'place',to:28},{model:'test',answer:null});
 assert.equal(a.groupId,b.groupId);assert.notEqual(a.decision.id,b.decision.id);assert.equal(a.decision.finalResult,null);
 assert.deepEqual(finalizedDecisions([a,b]),[]);assert.equal(position.state.ply,0);
 assert.throws(()=>recordCounterfactual({...position,groupId:''},'Fluid',{type:'place',to:0},{model:'test',answer:null}));
 assert.throws(()=>recordCounterfactual(position,'Fluid',{type:'remove',to:0},{model:'test',answer:null}));
});
