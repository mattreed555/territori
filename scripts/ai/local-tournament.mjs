// Free local-vs-local development comparison, not evidence of Jev strength.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['candidate','baseline','out','pairs','seed','search','baseline-search','style','style-options','intent'].map(k=>[k,{type:'string'}]))});
if(!v.candidate||!v.baseline||!v.out)throw Error('Use --candidate model --baseline model --out prefix');
await fs.mkdir(path.dirname(v.out),{recursive:true});
const load=await loadModules(),{validateModel,chooseLocalMove,seededRandom}=await load('ai/policy'),{STRATEGIES}=await load('game/strategies'),{simulateGame}=await load('ai/simulator');
const {chooseSearchMove,DEFAULT_SEARCH,SEARCH_VERSION}=await load('ai/search');
const {chooseStyledMove,validateStyleModel}=await load('ai/style');
const {chooseIntentMove,INTENT_VERSION}=await load('ai/intent');
const styleBytes=v.style?await fs.readFile(v.style):null,style=styleBytes?validateStyleModel(JSON.parse(styleBytes)):null;
const styleOptions=v['style-options']?JSON.parse(v['style-options']):{};
if(v['style-options']&&!style)throw Error('Style options require --style');
if(Object.hasOwn(styleOptions,'search'))throw Error('Use --search for search settings');
const intent=v.intent?JSON.parse(v.intent):null;
if(intent&&(!style||v['style-options']||Object.hasOwn(intent,'search')))throw Error('Intent requires --style, fixed learned weight .5, and separate --search');
const search=v.search?JSON.parse(v.search):style?{}:null;
const baselineSearch=v['baseline-search']?JSON.parse(v['baseline-search']):null;
const candidateBytes=await fs.readFile(v.candidate),baselineBytes=await fs.readFile(v.baseline),candidate=validateModel(JSON.parse(candidateBytes)),baseline=validateModel(JSON.parse(baselineBytes));
const seed=Number(v.seed||954),pairs=Number(v.pairs||4),epsilon=.03,maxTurns=160;
if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(pairs)||pairs<2)throw Error('Need an integer seed and at least two color-paired seeds');
const events=[],results=[];
for(const [s,strategy] of Object.keys(STRATEGIES).entries())for(let pair=0;pair<pairs;pair++)for(const candidateColor of ['blue','red']){
 const gameId=`${v.out.split('/').at(-1)}:${s}:${pair}:${candidateColor}`,agents={};
 for(const [c,color] of ['blue','red'].entries()){
  const random=seededRandom(seed+pair*101+s*10007+c*37),model=color===candidateColor?candidate:baseline;
  const options=color===candidateColor?search:baselineSearch;
  agents[color]={source:'local',choose:async game=>({move:color===candidateColor&&style?(intent?chooseIntentMove(game,strategy,model,style,{...intent,search:options||{}},epsilon,random):chooseStyledMove(game,strategy,model,style,{...styleOptions,search:options||{}},epsilon,random)):options?chooseSearchMove(game,strategy,model,options,epsilon,random):chooseLocalMove(game,strategy,model,epsilon,random)})};
 }
 try{
  const end=await simulateGame({gameId,players:{blue:strategy,red:strategy},agents,maxTurns,write:async e=>{events.push(e);}});
  results.push({strategy,pair,candidateColor,gameId,...end.result,points:end.result.status==='completed'?(end.result.winner===candidateColor?1:end.result.winner===null?.5:0):null});
 }catch(error){results.push({strategy,pair,candidateColor,gameId,status:'aborted',points:null,error:error.message});}
}
const summarize=rows=>{
 const completed=rows.filter(r=>r.status==='completed'),wins=completed.filter(r=>r.points===1).length,draws=completed.filter(r=>r.points===.5).length;
 // Paired-color cluster bootstrap preserves the dependence between color swaps.
 const blocks=Object.values(completed.reduce((o,r)=>{(o[r.strategy+':'+r.pair]??=[]).push(r.points);return o;},{})),random=seededRandom(seed),scores=[];
 if(blocks.length>=2)for(let b=0;b<2000;b++){let sum=0,n=0;for(let i=0;i<blocks.length;i++)for(const p of blocks[Math.floor(random()*blocks.length)]){sum+=p;n++;}scores.push(sum/n);}scores.sort((a,b)=>a-b);
 // Bootstrap degenerates at all wins/losses; retain a conservative bounded-
 // reward interval over color-pair clusters as well (independent seed assumption).
 const mean=blocks.length?blocks.reduce((s,b)=>s+b.reduce((a,x)=>a+x,0)/b.length,0)/blocks.length:null;
 const radius=blocks.length?Math.sqrt(Math.log(40)/(2*blocks.length)):null;
 return {completed:completed.length,aborted:rows.filter(r=>r.status==='aborted').length,truncated:rows.filter(r=>r.status==='truncated').length,wins,draws,losses:completed.length-wins-draws,score:completed.length?(wins+draws*.5)/completed.length:null,pairedBootstrap95:scores.length?[scores[50],scores[1949]]:null,pairedHoeffding95:mean===null?null:[Math.max(0,mean-radius),Math.min(1,mean+radius)],meanTurns:completed.length?completed.reduce((s,r)=>s+r.turns,0)/completed.length:null,repetitionEnds:completed.filter(r=>r.reason!=='supply').length};
};
const report={purpose:'Local-vs-local development tournament only; not acceptance evaluation or Jev strength',style:style?{modelSha256:createHash('sha256').update(styleBytes).digest('hex'),options:styleOptions}:null,search:search?{version:SEARCH_VERSION,...DEFAULT_SEARCH,...search}:null,baselineSearch:baselineSearch?{version:SEARCH_VERSION,...DEFAULT_SEARCH,...baselineSearch}:null,candidateSha256:createHash('sha256').update(candidateBytes).digest('hex'),baselineSha256:createHash('sha256').update(baselineBytes).digest('hex'),seed,pairs,epsilon,maxTurns,overall:summarize(results),byStrategy:Object.fromEntries(Object.keys(STRATEGIES).map(s=>[s,summarize(results.filter(r=>r.strategy===s))])),results};
if(intent)report.intent={version:INTENT_VERSION,options:intent,sourceSha256:createHash('sha256').update(await fs.readFile('lib/ai/intent.ts')).digest('hex')};
await atomicJSON(v.out+'.json',report);await fs.writeFile(v.out+'.jsonl.gz',gzipSync(events.map(e=>JSON.stringify(e)).join('\n')+'\n'));
console.log(JSON.stringify({candidate:v.candidate,...report.overall}));
