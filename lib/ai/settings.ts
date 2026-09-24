import { validateModel, type PolicyModel } from './policy';

export type Settings = {engine:'jev'|'local'|'candidate'; epsilon:number; model:PolicyModel|null};
export const DEFAULT_SETTINGS:Settings = {engine:'jev',epsilon:.03,model:null};
export function validateSettings(value:unknown):Settings {
 const s=value as Settings;
 if(!s || !['jev','local','candidate'].includes(s.engine) || !Number.isFinite(s.epsilon) || s.epsilon<0 || s.epsilon>1)throw new Error('Invalid AI settings. Open the AI lab to reset them.');
 return {engine:s.engine,epsilon:s.epsilon,model:s.model?validateModel(s.model):null};
}
