import OpenAI from "openai";

import type { ConversationMessage } from "../lib/types.js";

const LLM_MODEL = "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function* streamResponse(
  systemPrompt: string,
  conversationHistory: ConversationMessage[]
): AsyncGenerator<string> {
  console.log(
    `[LLM] Streaming response (${conversationHistory.length} messages in history)`
  );

  const stream = await openai.responses.create({
    model: LLM_MODEL,
    input: [{ role: "system", content: systemPrompt }, ...conversationHistory],
    stream: true,
    max_output_tokens: 1000,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}
