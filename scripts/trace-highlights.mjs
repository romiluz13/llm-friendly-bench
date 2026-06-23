export function extractHighlights(lane, transcriptText) {
  const text = String(transcriptText || "");
  if (!text.trim()) return { tablesInspected: 0, joinsWritten: 0, fkErrors: 0, documentReads: 0, summary: "trace highlight unavailable" };
  const joinsWritten = (text.match(/\bJOIN\b/gi) || []).length;
  const fkErrors = (text.match(/foreign key|fk violation|violates foreign key/gi) || []).length;
  const tablesInspected = new Set((text.match(/\\d\s+(\w+)/g) || []).map((s) => s.trim())).size
    + (text.match(/\bFROM\s+(\w+)/gi) || []).length;
  const documentReads = (text.match(/findOne|find\(|collection\(|\.aggregate\(/gi) || []).length;
  const summary = lane === "postgres"
    ? `Agent inspected ~${tablesInspected} tables, wrote ${joinsWritten} JOINs${fkErrors ? `, hit ${fkErrors} FK errors` : ""}.`
    : `Agent read the document directly (${documentReads || 1} read${documentReads === 1 ? "" : "s"}), no joins.`;
  return { tablesInspected, joinsWritten, fkErrors, documentReads, summary };
}
