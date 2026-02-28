const SENTENCE_BOUNDARY_RE = /^(.*?[.!?])\s+([\s\S]*)$/;

export function extractCompleteSentence(
  buffer: string
): [sentence: string, remaining: string] | null {
  const match = buffer.match(SENTENCE_BOUNDARY_RE);
  if (!match || !match[1] || !match[2]) return null;
  return [match[1], match[2]];
}
