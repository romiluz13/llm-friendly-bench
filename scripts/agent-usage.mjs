// Published price snapshot; used only to derive cost when a CLI does not report it (Codex).
export const PRICES = {
  // USD per token (input, output). Snapshot constant; documented in README as an assumption.
  codex: { input: 0.0000025, output: 0.00001 }
};

function lastJsonMatch(text, predicate) {
  let found = null;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const event = JSON.parse(trimmed);
      if (predicate(event)) found = event;
    } catch {}
  }
  return found;
}

export function extractUsage(agentId, transcriptText) {
  const empty = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0, tokensRead: 0, costUsd: 0, source: "estimated" };
  if (!transcriptText || !transcriptText.trim()) {
    return { ...empty, estimatedFromBytes: true };
  }

  if (agentId === "codex") {
    const turn = lastJsonMatch(transcriptText, (e) => e.type === "turn.completed" && e.usage);
    if (!turn) return estimate(transcriptText);
    const u = turn.usage;
    const inputTokens = Number(u.input_tokens || 0);
    const outputTokens = Number(u.output_tokens || 0);
    const cachedInputTokens = Number(u.cached_input_tokens || 0);
    const costUsd = inputTokens * PRICES.codex.input + outputTokens * PRICES.codex.output;
    // cached_input_tokens is a sub-count already inside input_tokens; do not add it again
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, tokensRead: inputTokens, costUsd, source: "measured" };
  }

  if (agentId === "claude-code") {
    const lines = String(transcriptText).split(/\r?\n/);
    const perMsg = new Map(); // message.id -> latest usage object (dedup parallel tool calls, last-wins)
    let resultEvent = null;
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("{")) continue;
      let e; try { e = JSON.parse(s); } catch { continue; }
      if (e.type === "result") resultEvent = e;
      if (e.type === "assistant") {
        const id = e.message?.id || e.message_id || e.id;
        const u = e.message?.usage || e.usage;
        if (u && id) perMsg.set(id, u);
      }
    }
    if (perMsg.size === 0 && !resultEvent) return estimate(transcriptText);
    let inputTokens = 0, cacheRead = 0, cacheCreation = 0, outputTokens = 0;
    for (const u of perMsg.values()) {
      inputTokens   += Number(u.input_tokens || 0);
      cacheRead     += Number(u.cache_read_input_tokens || 0);
      cacheCreation += Number(u.cache_creation_input_tokens || 0);
      outputTokens  += Number(u.output_tokens || 0);
    }
    // total context the model actually read across the whole task (3 non-overlapping buckets)
    const tokensRead = inputTokens + cacheRead + cacheCreation;
    const cachedInputTokens = cacheRead + cacheCreation;
    // cost: CLI-real total from the result event (authoritative single number for the invocation)
    const costUsd = Number(resultEvent?.total_cost_usd || 0);
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, tokensRead, costUsd, source: "measured" };
  }

  return estimate(transcriptText);
}

function estimate(transcriptText) {
  const bytes = Buffer.byteLength(transcriptText, "utf8");
  const totalTokens = Math.ceil(bytes / 4);
  return { inputTokens: totalTokens, outputTokens: 0, cachedInputTokens: 0, totalTokens, tokensRead: totalTokens, costUsd: 0, source: "estimated" };
}
