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
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, tokensRead: inputTokens + cachedInputTokens, costUsd, source: "measured" };
  }

  if (agentId === "claude-code") {
    const result = lastJsonMatch(transcriptText, (e) => e.type === "result" && (e.usage || e.total_cost_usd !== undefined));
    if (!result) return estimate(transcriptText);
    const u = result.usage || {};
    const inputTokens = Number(u.input_tokens || 0);
    const outputTokens = Number(u.output_tokens || 0);
    const cachedInputTokens = Number(u.cache_read_input_tokens || 0);
    const costUsd = Number(result.total_cost_usd || 0);
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, tokensRead: inputTokens + cachedInputTokens, costUsd, source: "measured" };
  }

  return estimate(transcriptText);
}

function estimate(transcriptText) {
  const bytes = Buffer.byteLength(transcriptText, "utf8");
  const totalTokens = Math.ceil(bytes / 4);
  return { inputTokens: totalTokens, outputTokens: 0, cachedInputTokens: 0, totalTokens, tokensRead: totalTokens, costUsd: 0, source: "estimated" };
}
