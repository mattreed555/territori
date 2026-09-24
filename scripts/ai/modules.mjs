// Compile the same pure TS modules used by the browser. TypeScript is already a dev dependency.
import ts from 'typescript';
import fs from 'node:fs/promises';
import {rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const git=promisify(execFile);
export const root=fileURLToPath(new URL('../../',import.meta.url));
export async function loadModules({ref}={}) {
 if(ref && !/^[a-f0-9]{40}$/.test(ref))throw Error('Reference source must be a full local Git commit SHA');
 await fs.mkdir(path.join(root,'.sites-runtime'),{recursive:true});
 const dir=await fs.mkdtemp(path.join(root,'.sites-runtime/ai-'));
 process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
 for(const group of ['game','ai']) {
  await fs.mkdir(path.join(dir,group),{recursive:true});
  const names=ref?(await git('git',['ls-tree','--name-only',`${ref}:lib/${group}`],{cwd:root})).stdout.trim().split('\n'):await fs.readdir(path.join(root,'lib',group));
  for(const name of names) if(name.endsWith('.ts') && name!=='browser.ts') {
   const source=ref?(await git('git',['show',`${ref}:lib/${group}/${name}`],{cwd:root,maxBuffer:2**22})).stdout:await fs.readFile(path.join(root,'lib',group,name),'utf8');
   const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,'$1$2.mjs$3').replace(/(import\(['"])(\.[^'"]+)(['"]\))/g,'$1$2.mjs$3');
   await fs.writeFile(path.join(dir,group,name.replace(/\.ts$/,'.mjs')),js);
  }
 }
 return async name=>import(pathToFileURL(path.join(dir,name+'.mjs')));
}
