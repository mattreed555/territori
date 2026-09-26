import { finalizedDecisions, type DatasetEvent } from './dataset';
import { DEFAULT_SETTINGS, migrateSettings, validateSettings, type Settings } from './settings';
export type { Settings } from './settings';
const DB_NAME='territori-training-v1';
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('events',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveEvent(event:DatasetEvent) {
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('events','readwrite');tx.objectStore('events').put({key:event.kind==='decision'?`decision:${event.id}`:`result:${event.gameId}`,event});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Dataset write aborted'));});}finally{db.close();}
}
export async function exportDataset() {
 const db=await database();try{const events=await new Promise<DatasetEvent[]>((resolve,reject)=>{const r=db.transaction('events').objectStore('events').getAll();r.onsuccess=()=>resolve(r.result.map(x=>x.event));r.onerror=()=>reject(r.error);});return finalizedDecisions(events).map(r=>JSON.stringify(r)).join('\n')+'\n';}finally{db.close();}
}
export function readSettings():Settings {const raw=localStorage.getItem('territori-ai-settings');return raw?migrateSettings(JSON.parse(raw)):{...DEFAULT_SETTINGS};}
export function writeSettings(settings:Settings){localStorage.setItem('territori-ai-settings',JSON.stringify({...validateSettings(settings),version:2}));}

export function newGameId() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join(''); }
