import { db } from './connection.js';
import { now, safeJson, json } from '../utils.js';
import { numSetting, activeStrategy } from './settings.js';

export const APPROVAL_TTL_MS = Number(process.env.APPROVAL_TTL_MS || 5 * 60 * 1000);

export function createTradeIntent(candidateId, candidate, decision, mode, status, side = 'buy') {
  const strat = activeStrategy();
  const sizeSol = Number(decision.suggestedSizeSol ?? decision.suggested_size_sol ?? strat.position_size_sol ?? numSetting('dry_run_buy_sol', 0.1));
  const mint = candidate.token.mint;
  const idempotencyKey = `${side}:${mint}:${candidateId}:${decision.id || 'no_decision'}:${mode}`;
  const expiresAt = now() + APPROVAL_TTL_MS;
  const existing = db.prepare('SELECT id FROM trade_intents WHERE idempotency_key = ? LIMIT 1').get(idempotencyKey);
  if (existing) return existing.id;
  const result = db.prepare(`
    INSERT INTO trade_intents (
      candidate_id, mint, mode, status, created_at_ms, updated_at_ms, side,
      size_sol, confidence, reason, llm_decision_id, payload_json, expires_at_ms, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    candidateId,
    mint,
    mode,
    status,
    now(),
    now(),
    side,
    sizeSol,
    decision.confidence,
    decision.reason,
    decision.id || null,
    json({ candidate, decision, mode, status }),
    status === 'pending_confirmation' ? expiresAt : null,
    idempotencyKey,
  );
  const intentId = Number(result.lastInsertRowid);
  if (status === 'pending_confirmation') {
    db.prepare(`
      INSERT INTO pending_approvals (intent_id, mint, status, created_at_ms, expires_at_ms, payload_json)
      VALUES (?, ?, 'pending', ?, ?, ?)
      ON CONFLICT(intent_id) DO NOTHING
    `).run(intentId, mint, now(), expiresAt, json({ candidateId, decisionId: decision.id || null, side, mode }));
  }
  return intentId;
}

export function expireOldApprovals() {
  const at = now();
  db.prepare("UPDATE pending_approvals SET status = 'expired' WHERE status = 'pending' AND expires_at_ms <= ?").run(at);
  db.prepare("UPDATE trade_intents SET status = 'expired', updated_at_ms = ? WHERE status = 'pending_confirmation' AND expires_at_ms IS NOT NULL AND expires_at_ms <= ?").run(at, at);
}

export function markApproval(intentId, status) {
  const at = now();
  const column = status === 'approved' ? 'approved_at_ms' : 'rejected_at_ms';
  db.prepare(`UPDATE pending_approvals SET status = ?, ${column} = ? WHERE intent_id = ?`).run(status, at, intentId);
}

export function intentById(id) {
  expireOldApprovals();
  const row = db.prepare('SELECT * FROM trade_intents WHERE id = ?').get(id);
  return row ? { ...row, payload: safeJson(row.payload_json, {}) } : null;
}
