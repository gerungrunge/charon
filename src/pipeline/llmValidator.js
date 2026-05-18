export function validateLlmJson(parsed, rows = [], { maxBuySol = Number(process.env.MAX_BUY_SOL || 0.02), defaultTp = 50, defaultSl = -25 } = {}) {
  const rawAction = String(parsed?.action || parsed?.verdict || '').toUpperCase();
  const action = rawAction === 'BUY' ? 'BUY' : 'SKIP';
  const maxBuy = Number(maxBuySol);
  const suggested = Math.max(0, Math.min(Number.isFinite(maxBuy) ? maxBuy : 0.02, Number(parsed?.suggestedSizeSol ?? parsed?.suggested_size_sol ?? maxBuy) || 0));
  const confidence = Math.max(0, Math.min(100, Number(parsed?.confidence) || 0));
  const selectedId = Number(parsed?.selected_candidate_id || parsed?.candidate_id || 0);
  const selectedMint = String(parsed?.selected_mint || parsed?.mint || '');
  const row = rows.find(item => item.id === selectedId || item.candidate?.token?.mint === selectedMint) || null;
  const verdict = action === 'BUY' && row ? 'BUY' : 'WATCH';
  return {
    action,
    verdict,
    confidence,
    reason: String(parsed?.reason || (action === 'SKIP' ? 'LLM skipped.' : '')).slice(0, 1000),
    risks: Array.isArray(parsed?.risks) ? parsed.risks.map(String).slice(0, 8) : [],
    invalidations: Array.isArray(parsed?.invalidations) ? parsed.invalidations.map(String).slice(0, 8) : [],
    suggestedSizeSol: suggested,
    suggested_tp_percent: Number(parsed?.suggested_tp_percent) || defaultTp,
    suggested_sl_percent: Number(parsed?.suggested_sl_percent) || defaultSl,
    selected_candidate_id: verdict === 'BUY' && row ? row.id : null,
    selected_mint: verdict === 'BUY' && row ? row.candidate.token.mint : null,
    selected_row: verdict === 'BUY' && row ? row : null,
    raw: parsed,
  };
}
