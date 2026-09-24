import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{splitByGameIds,trainPolicy}=await load('ai/training'),{newGame}=await load('game/rules'),{recordDecision}=await load('ai/dataset');
test('explicit holdout stays fixed when student-state games are added',()=>{
 const rows=['train','holdout','student'].map(id=>recordDecision(id,newGame(),'Balanced',{type:'place',to:27},'jev'));
 const split=splitByGameIds(rows,['holdout']);assert.deepEqual(split.trainGameIds,['student','train']);assert.deepEqual(split.testGameIds,['holdout']);
 for(const ids of [[],['missing'],['holdout','holdout'],['train','holdout','student']])assert.throws(()=>splitByGameIds(rows,ids));
 const options={epochs:2,testGameIds:['holdout'],sharedPriorStrength:.1};
 const fit=trainPolicy(rows,options);rows[1].chosenMove={type:'place',to:0};
 assert.deepEqual(fit.model,trainPolicy(rows,options).model);
 assert.deepEqual(fit.model.training.testGameIds,['holdout']);assert.equal(fit.model.strategies.Balanced.samples,2);
});
