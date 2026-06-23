export function extractHighlights(lane, transcriptText) {
  const text = String(transcriptText || "");
  if (!text.trim()) return { tablesInspected: 0, joinsWritten: 0, fkErrors: 0, documentReads: 0, summary: "trace highlight unavailable" };
  const joinsWritten = (text.match(/\bJOIN\b/gi) || []).length;
  const fkErrors = (text.match(/foreign key|fk violation|violates foreign key/gi) || []).length;
  const tablesInspected = new Set((text.match(/\\d\s+(\w+)/g) || []).map((s) => s.trim())).size
    + (text.match(/\bFROM\s+(\w+)/gi) || []).length;
  const documentReads = (text.match(/findOne|find\(|collection\(|\.aggregate\(/gi) || []).length;
  const summary = lane === "postgres"
    ? `The AI looked at ~${tablesInspected} tables and wrote ${joinsWritten} JOINs to stitch them back together${fkErrors ? `, and hit ${fkErrors} broken-link error${fkErrors === 1 ? "" : "s"} along the way` : ""}.`
    : `The AI read the single record directly (${documentReads || 1} read${documentReads === 1 ? "" : "s"}) — no stitching needed.`;
  return { tablesInspected, joinsWritten, fkErrors, documentReads, summary };
}
