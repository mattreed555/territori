import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'territori-test-'));
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
for (const name of ['rules', 'strategies', 'capture', 'jev']) {
  const source = fs.readFileSync(new URL(`../lib/game/${name}.ts`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  fs.writeFileSync(path.join(dir, `${name}.mjs`), output.replaceAll("'./rules'", "'./rules.mjs'").replaceAll("'./strategies'", "'./strategies.mjs'").replaceAll("'./capture'", "'./capture.mjs'"));
}
const {newGame} = await import(pathToFileURL(path.join(dir, 'rules.mjs')));
const {captureOutcome,decisionRequest} = await import(pathToFileURL(path.join(dir, 'jev.mjs')));
let g=newGame();g.board[27]='blue';g.board[28]='blue';g.supply.blue=23;g.board[9]='red';g.board[10]='red';g.supply.red=23;
const loss=captureOutcome(g,{type:'place',to:17});
assert.equal(loss.boardReturnsToCurrentPosition,true);assert.equal(loss.myNetTerritoryGain,0);assert.equal(loss.myPermanentlyLostPiecesAfterReply,1);assert.equal(loss.myUnusedPiecesAfterReply,22);
assert.equal(captureOutcome(g,{type:'place',to:29}),null);
const shiftCase={...g,board:[...g.board],supply:{blue:23,red:22}};shiftCase.board[20]='red';
assert.equal(captureOutcome(shiftCase,{type:'shift',from:27,to:35}).opponentCaptures,'E4');
assert.equal(captureOutcome(newGame(),{type:'place',to:27}),null);
let end={...g,turn:'red',supply:{blue:23,red:1}};assert.equal(captureOutcome(end,{type:'place',to:17}),null);
let final={...g,supply:{blue:1,red:23}};assert.equal(captureOutcome(final,{type:'place',to:17}).gameEndsAfterReply,'supply');
const request=decisionRequest(g,'Expansive');
assert.equal(request.moves.length,Object.keys(request.body.questions.move.criteria).length);
assert.equal(request.body.state.board.length,8);assert.ok(request.body.state.board.every(row=>row.length===8));
assert.match(request.body.state.coordinates,/A-H/);assert.match(request.body.state.rules,/Ties are safe/);
console.log('Capture lookahead, opening, endgame and 8x8 request checks passed.');

assert.match(decisionRequest(newGame(),'Balanced').body.state.rules,/empty board/);
assert.equal('setup' in decisionRequest(newGame(),'Balanced').body.state,false);
