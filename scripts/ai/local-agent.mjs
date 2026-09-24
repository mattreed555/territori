// Exact offline policy selection for the metered collector and its replay.
// Construction validates every strategy BEFORE a usage journal or paid request.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadModules} from './modules.mjs';
export async function prepareLocalAgent({modelPath,stylePath,search=null,intent=null,epsilon=.03}){
 if(!modelPath)throw Error('Local agent requires a model');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid epsilon');
 const object=(value,name)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`${name} must be an options object`);};
 if(search!==null)object(search,'Search');if(intent!==null)object(intent,'Intent');
 if(intent!==null&&!stylePath)throw Error('Intent requires an explicit learned style model');
 if(stylePath&&intent===null)throw Error('Collector style requires an explicit intent configuration; strength0 selects learned style only');
 if(intent&&Object.hasOwn(intent,'search'))throw Error('Use separate search options');
 const load=await loadModules(),{validateModel,chooseLocalMove}=await load('ai/policy'),{STRATEGIES}=await load('game/strategies'),{newGame}=await load('game/rules'),{chooseSearchMove,DEFAULT_SEARCH,SEARCH_VERSION}=await load('ai/search'),{validateStyleModel}=await load('ai/style'),{chooseIntentMove,INTENT_VERSION}=await load('ai/intent');
 const hash=b=>createHash('sha256').update(b).digest('hex'),modelBytes=await fs.readFile(modelPath),model=validateModel(JSON.parse(modelBytes));
 if(Object.keys(STRATEGIES).some(s=>!model.strategies[s]))throw Error('Model must support all five strategies before paid work');
 const styleBytes=stylePath?await fs.readFile(stylePath):null,style=styleBytes?validateStyleModel(JSON.parse(styleBytes)):null;
 const actualSearch=intent!==null?(search||{}):search;
 const choose=(game,strategy,random)=>intent!==null?chooseIntentMove(game,strategy,model,style,{...intent,search:actualSearch},epsilon,random):actualSearch!==null?chooseSearchMove(game,strategy,model,actualSearch,epsilon,random):chooseLocalMove(game,strategy,model,epsilon,random);
 for(const strategy of Object.keys(STRATEGIES))choose(newGame(),strategy,()=>.9);
 const sourceFiles=['lib/game/rules.ts','lib/ai/policy.ts','lib/ai/features.ts'];
 if(actualSearch!==null)sourceFiles.push('lib/ai/search.ts');
 if(intent!==null)sourceFiles.push('lib/ai/style.ts','lib/ai/intent.ts');
 const sourceHashes={};for(const p of sourceFiles)sourceHashes[p]=hash(await fs.readFile(p));
 const metadata={kind:intent!==null?'learned-search-style-authored-intent':actualSearch!==null?'learned-search':'linear',modelSha256:hash(modelBytes),styleSha256:styleBytes?hash(styleBytes):null,epsilon,search:actualSearch!==null?{version:SEARCH_VERSION,...DEFAULT_SEARCH,...actualSearch}:null,intent:intent!==null?{version:INTENT_VERSION,strength:intent.strength??1,margin:intent.margin??1,learnedStyleWeight:.5,authored:true}:null,sourceHashes};
 return {choose,metadata};
}
