import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{score,positionKey,neighbors}=await load('game/rules'),{seededRandom}=await load('ai/policy');
// Preserved allocation-heavy reference, independent of the optimized traversal.
function reference(board,size){
 const land=board.map((piece,i)=>{if(piece)return piece;const reach=new Set(neighbors(i,size).map(n=>board[n]).filter(Boolean));return reach.size===1?[...reach][0]:null;});
 const totals={blue:0,red:0},largest={blue:0,red:0},seen=new Set();
 land.forEach((c,i)=>{if(!c)return;totals[c]++;if(seen.has(i))return;const stack=[i];seen.add(i);let count=0;
  while(stack.length){const n=stack.pop();count++;neighbors(n,size).forEach(j=>{if(!seen.has(j)&&land[j]===c){seen.add(j);stack.push(j);}});}largest[c]=Math.max(largest[c],count);
 });const delta=totals.blue-totals.red||largest.blue-largest.red;
 return {land,totals,largest,winner:delta>0?'blue':delta<0?'red':null};
}
test('allocation-light control, connected scoring and keys equal the reference on 2000 varied boards',()=>{
 const random=seededRandom(2416),values=[null,'blue','red'];
 for(const size of [3,5,8,10])for(let trial=0;trial<500;trial++){
  const board=Array.from({length:size*size},()=>values[Math.floor(random()*3)]);
  const before=JSON.stringify(board);assert.deepEqual(score(board,size),reference(board,size));assert.equal(JSON.stringify(board),before);
  for(const turn of ['blue','red']){const supply={blue:Math.floor(random()*26),red:Math.floor(random()*26)};
   assert.equal(positionKey(board,turn,supply),`${turn}:${supply.blue}:${supply.red}:`+board.map(c=>c==='blue'?'B':c==='red'?'R':'.').join(''));
  }
 }
});
