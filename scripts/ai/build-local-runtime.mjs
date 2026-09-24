// Reproducible standalone client bundle measurement, NOT the final app delta.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['out','positions','policy','style'].map(k=>[k,{type:'string'}]))});
if(!v.out||!v.positions||!v.policy||!v.style)throw Error('Use --out DIR --positions JSON.GZ --policy MODEL --style MODEL');
await fs.mkdir(v.out,{recursive:true});
const hashes={},hash=b=>createHash('sha256').update(b).digest('hex');
async function read(p){const b=await fs.readFile(p);hashes[p]=hash(b);return b;}
const bundles={};
for(const [kind,entry] of Object.entries({linear:'lib/ai/policy.ts',hybrid:'lib/ai/intent.ts'})){
 const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:'esbuild',lib:{entry,formats:['es'],fileName:kind},rollupOptions:{external:[]}}});
 const chunks=(Array.isArray(result)?result:[result]).flatMap(r=>r.output);assert.equal(chunks.length,1);const chunk=chunks[0];assert.equal(chunk.type,'chunk');assert.deepEqual(chunk.imports,[]);assert.deepEqual(chunk.dynamicImports,[]);
 const bytes=Buffer.from(chunk.code),filename=`${v.out}/${kind}.mjs`;await fs.writeFile(filename,bytes);
 bundles[kind]={file:filename,bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:hash(bytes),externalImports:0,dynamicImports:0};
}
const pb=await read(v.policy),sb=await read(v.style),positions=JSON.parse(gunzipSync(await read(v.positions))),policy=JSON.parse(pb),style=JSON.parse(sb);
const load=await loadModules(),{chooseIntentMove}=await load('ai/intent'),{STRATEGIES}=await load('game/strategies'),{moveId}=await load('game/rules');
const bundled=await import(pathToFileURL(path.resolve(bundles.hybrid.file))),selected=positions.filter((_,i)=>i%13===0);let compared=0;
for(const p of selected)for(const strategy of Object.keys(STRATEGIES)){assert.equal(moveId(bundled.chooseIntentMove(p.state,strategy,policy,style,{strength:1,margin:1})),moveId(chooseIntentMove(p.state,strategy,policy,style,{strength:1,margin:1})));compared++;}
hashes['scripts/ai/build-local-runtime.mjs']=hash(await fs.readFile('scripts/ai/build-local-runtime.mjs'));
const report={purpose:'Standalone ESM build/Node parity, NOT browser/mobile or actual application bundle delta',tool:'Existing Vite dependency, configFile:false, ES library mode, esbuild minification',newDependencies:0,bundles,modelAssets:{policyGzipBytes:gzipSync(pb).length,styleGzipBytes:gzipSync(sb).length,totalGzipBytes:gzipSync(pb).length+gzipSync(sb).length},standaloneCodeGzipDelta:bundles.hybrid.gzipBytes-bundles.linear.gzipBytes,independentlyCompressedHybridCodeAndModelsBytes:bundles.hybrid.gzipBytes+gzipSync(pb).length+gzipSync(sb).length,parity:{states:selected.length,choices:compared,allMatch:true,environment:'Node, not a browser'},hashes};await atomicJSON(`${v.out}/bundle-report.json`,report);console.log(JSON.stringify(report));
