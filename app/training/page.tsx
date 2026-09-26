'use client';
import { useEffect, useState } from 'react';
import { exportDataset, readSettings, writeSettings, type Settings } from '@/lib/ai/browser';
import { validateModel } from '@/lib/ai/policy';
import { prepareLocalPlayer } from '@/lib/ai/local-player';
import { STRATEGIES, type Strategy } from '@/lib/game/strategies';
import { DEFAULT_SETTINGS } from '@/lib/ai/settings';

export default function Training() {
 const [settings,setSettings]=useState<Settings>({...DEFAULT_SETTINGS});
 const [message,setMessage]=useState(''),[downloadUrl,setDownloadUrl]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{try{setSettings(readSettings());}catch{setMessage('Saved settings could not be read. Save below to reset them.');}},[]);
 useEffect(()=>()=>{if(downloadUrl)URL.revokeObjectURL(downloadUrl);},[downloadUrl]);
 async function download(){
  try{const text=await exportDataset();const url=URL.createObjectURL(new Blob([text],{type:'application/x-ndjson'}));setDownloadUrl(url);setMessage('Dataset ready to download.');}catch(e){setMessage(String(e));}
 }
 async function save(){
  setSaving(true);
  try{
   if(settings.epsilon<0||settings.epsilon>.25||!Number.isFinite(settings.epsilon))throw Error('Use a probability from 0 to 0.25');
   // Candidate must cover every strategy; an uploaded policy may intentionally cover a subset.
   await prepareLocalPlayer(settings,settings.engine==='candidate'?Object.keys(STRATEGIES) as Strategy[]:Object.keys(settings.model?.strategies||{}) as Strategy[]);
   writeSettings(settings);setMessage('Saved. Return to Territori to start a game.');
  }catch(e){setMessage(String(e));}finally{setSaving(false);}
 }
 return <main style={{maxWidth:640,margin:'40px auto',padding:24,lineHeight:1.6}}>
  <a href="/">← Territori</a><h1 style={{fontFamily:'Georgia',fontSize:36}}>AI lab</h1>
  <p>Decisions are saved in this browser. Export them before clearing browser data. Finished games include their results; interrupted games may have no result. No account or browsing information is recorded.</p>
  <button className="primary-button" onClick={download}>Prepare JSONL export</button>
  {downloadUrl && <p><a href={downloadUrl} download="territori-decisions.jsonl">Download JSONL</a></p>}
  <h2 style={{fontSize:24,marginTop:32}}>Try a local policy</h2>
  <p>The default local AI reads the current rules and looks ahead at the opponent’s reply. Each strategy favors a different kind of sound move; no earlier trained model is used for normal games.</p>
  <p>Both engines choose moves on this device. Settings apply to new games opened from this page.</p>
  <fieldset disabled={saving} style={{border:0,padding:0}}>
   <p><label>Engine <select value={settings.engine} onChange={e=>setSettings(s=>({...s,engine:e.target.value as Settings['engine']}))}>
    <option value="candidate">Rules-based local AI (default)</option>
    <option value="local" disabled={!settings.model}>Uploaded linear policy</option>
   </select></label></p>
   <label>Upload policy JSON <input type="file" accept=".json,application/json" onChange={async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>1000000)throw Error('Policy is too large');const model=validateModel(JSON.parse(await file.text()));setSettings(s=>({...s,model}));setMessage(`Loaded: ${Object.keys(model.strategies).join(', ')}`);}catch(error){setMessage(String(error));}
   }}/></label>
   <p><label>Exploration probability <input type="number" min="0" max="0.25" step="0.01" value={settings.epsilon} onChange={e=>setSettings(s=>({...s,epsilon:Number(e.target.value)}))}/></label></p>
   <p>The default AI explores only tactically close moves. Uploaded linear policies explore any legal move.</p>
   <button className="primary-button" onClick={save}>{saving?'Checking models…':'Save settings'}</button>
  </fieldset><p role="status">{message}</p>
 </main>;
}
