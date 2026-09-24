import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame}=await load('game/rules'),{recordRepeatedCounterfactual}=await load('ai/repeated-probe');
test('repeated labels preserve null outcomes and source identity without colliding',()=>{
 const p={id:'state',groupId:'trace',origin:'test trace',category:'test',state:newGame()},t={model:'fixture',answer:null},m={type:'place',to:0};
 const a=recordRepeatedCounterfactual(p,'Fluid',m,t,0),b=recordRepeatedCounterfactual(p,'Fluid',m,t,1);
 assert.notEqual(a.id,b.id);assert.deepEqual(a.label,b.label);assert.equal(a.label.groupId,'trace');assert.equal(a.label.decision.finalResult,null);
 for(const repeat of [-1,2,NaN,.5])assert.throws(()=>recordRepeatedCounterfactual(p,'Fluid',m,t,repeat));
 assert.throws(()=>recordRepeatedCounterfactual(p,'Fluid',{type:'shift',from:0,to:1},t,0));
});
