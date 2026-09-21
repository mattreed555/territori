// Integer nanodollars avoid rounding away small API charges (42 nano/input token).
import fs from 'node:fs/promises';
export const REQUEST_BOUND_NANO = 65536 * 42;
export function validateLease(ledger, runId, now = Date.now()) {
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  if (ledger.version !== 1 || ![ledger.allowanceNano, ledger.evaluationReserveNano, ledger.spentUpperNano].every(integer)) throw Error('Invalid ledger');
  const active = ledger.sessions.filter(s => s.status === 'reserved');
  if (active.length !== 1 || active[0].id !== runId) throw Error('Missing reservation or another session is active');
  const lease = active[0];
  if (!integer(lease.capNano) || lease.capNano < REQUEST_BOUND_NANO) throw Error('Invalid session cap');
  if (!Number.isFinite(Date.parse(lease.expiresAt)) || now >= Date.parse(lease.expiresAt)) throw Error('Expired reservation: reconcile usage before continuing');
  const age = now - Date.parse(ledger.pricing.verifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > 86400000 || ledger.pricing.nanoPerInputToken !== 42 || ledger.pricing.nanoPerOutputToken !== 0 || ledger.pricing.maxInputTokens !== 65536) throw Error('Reverify pricing and context bound');
  const reserve = lease.purpose === 'evaluation' ? 0 : ledger.evaluationReserveNano;
  if (ledger.spentUpperNano + lease.capNano + reserve > ledger.allowanceNano) throw Error('Reservation exceeds cumulative allowance or evaluation reserve');
  return lease;
}
export function chargeForUsage(teacher) {
  const usage = teacher?.usage;
  if (teacher?.model !== 'jev-1.13.0' || !Number.isSafeInteger(usage?.input_tokens) || usage.input_tokens <= 0 || usage.input_tokens > 65536 || !Number.isSafeInteger(usage?.output_tokens) || usage.output_tokens < 0) throw Error('Unbounded or unexpected teacher usage/model; retain full request charge and stop');
  return usage.input_tokens * 42;
}
export async function atomicJSON(file, value) {
  const temporary = file + '.tmp';
  const handle = await fs.open(temporary, 'w');
  try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, file);
}
// A session reservation MUST already be committed to the shared repository.
// The remote reservation remains charged at its full cap until reconciliation.
export async function openMeter({ledgerFile, journalFile, runId}) {
  const ledger = JSON.parse(await fs.readFile(ledgerFile, 'utf8'));
  const lease = validateLease(ledger, runId);
  const journal = await fs.open(journalFile, 'wx'); // Never rerun/reuse an old session.
  let charged = 0, calls = 0, inputTokens = 0, outputTokens = 0, pending = false, stopped = false;
  const append = async event => { await journal.write(JSON.stringify({at:new Date().toISOString(), ...event}) + '\n'); await journal.sync(); };
  return {
    async request(choose, context) {
      if (stopped || pending) throw Error('Meter is stopped or a request is already active');
      validateLease(ledger, runId);
      if (charged + REQUEST_BOUND_NANO > lease.capNano) throw Error('Session budget reached; no request sent');
      pending = true; calls++; charged += REQUEST_BOUND_NANO;
      // Persist the full bound before issuing a request. No automatic retries.
      try {
        await append({kind:'request', call:calls, context, reservedNano:REQUEST_BOUND_NANO});
        const response = await choose();
        const cost = chargeForUsage(response.teacher);
        await append({kind:'usage', call:calls, model:response.teacher.model, usage:response.teacher.usage, costNano:cost});
        charged += cost - REQUEST_BOUND_NANO;
        inputTokens += response.teacher.usage.input_tokens;
        outputTokens += response.teacher.usage.output_tokens;
        return response;
      } catch (error) {
        stopped = true;
        await append({kind:'uncertain', call:calls, costUpperNano:REQUEST_BOUND_NANO, reason:'request-or-usage-failed'});
        throw error;
      } finally { pending = false; }
    },
    async close() {
      if (pending) throw Error('Cannot close an active request');
      const summary = {calls, inputTokens, outputTokens, spentUpperNano:charged, uncertain:stopped};
      await append({kind:'session-result', ...summary}); await journal.close();
      ledger.spentUpperNano += charged;
      Object.assign(lease, {status:stopped?'closed-with-uncertainty':'closed', closedAt:new Date().toISOString(), ...summary});
      await atomicJSON(ledgerFile, ledger);
      return summary;
    }
  };
}
