import { createClient } from "@deepgram/sdk";

const TTS_MODEL = "aura-2-thalia-en";
const MAX_CHARS = 2000;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

function splitAtSentenceBoundaries(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_CHARS) {
    let splitIdx = remaining.lastIndexOf(". ", MAX_CHARS);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf("! ", MAX_CHARS);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf("? ", MAX_CHARS);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(" ", MAX_CHARS);
    if (splitIdx === -1) splitIdx = MAX_CHARS;

    chunks.push(remaining.slice(0, splitIdx + 1).trim());
    remaining = remaining.slice(splitIdx + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function textToSpeech(text: string): Promise<Buffer> {
  const chunks = splitAtSentenceBoundaries(text);
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    console.log(`[DeepgramTTS] Generating audio for ${chunk.length} chars...`);

    const response = await deepgram.speak.request(
      { text: chunk },
      { model: TTS_MODEL }
    );

    const stream = await response.getStream();
    if (!stream) {
      throw new Error("[DeepgramTTS] No audio stream returned");
    }

    const buffer = await streamToBuffer(stream);
    audioBuffers.push(buffer);
  }

  return Buffer.concat(audioBuffers);
}
