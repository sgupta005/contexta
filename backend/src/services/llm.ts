import OpenAI from "openai";

import type { ConversationMessage } from "../lib/types.js";

const LLM_MODEL = "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateResponse(
  systemPrompt: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  console.log(
    `[LLM] Generating response (${conversationHistory.length} messages in history)`
  );

  const completion = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("[LLM] No content in completion response");
  }

  console.log(`[LLM] Response: "${content.slice(0, 80)}..."`);
  return content;
}
