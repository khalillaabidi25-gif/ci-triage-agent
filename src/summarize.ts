/**
 * Stage 2 — Root-cause summarization with Groq's API.
 *
 * Groq exposes an OpenAI-compatible endpoint, so we use the official
 * `openai` package pointed at Groq's base URL. No Anthropic SDK involved.
 *
 * ⚠️ Requires: GROQ_API_KEY (env) — get it at console.groq.com (free tier).
 *    Never commit a hardcoded key.
 */

import OpenAI from "openai";

// Created lazily inside summarizeFailure(): the OpenAI SDK throws at
// construction time if no key is present, and we want the run-in-early-exit
// guard in index.ts to fire first with a friendly message.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY, // required; left here only via env
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return client;
}

// Model + payload size are env-configurable so the GitHub Action can pass
// them as inputs without us rebuilding.
const MODEL = process.env.MODEL ?? "openai/gpt-oss-20b";
const MAX_LOG_CHARS = Math.max(1, Number(process.env.MAX_LOG_CHARS ?? 50000));

const SYSTEM_PROMPT = `You are "CI Failure Triage", a senior DevOps engineer SRE.
You receive the raw output log of a FAILED GitHub Actions job.
Diagnose the most likely root cause of the failure.

Rules:
- Use ONLY evidence present in the log. Never invent lines that aren't there.
- Distinguish categories: dependency/install error, compile error, test
  assertion failure, network/timeout, config/secret error, flaky infra, unknown.
- Output valid Markdown with EXACTLY these three sections:
  ## Suspected root cause
  ## Evidence from the log (quote the 1-2 most relevant lines)
  ## Suggested next step
- Be concise. Total under 200 words.`;

/**
 * Summarizes a CI failure log with Llama (via Groq).
 * We send only the tail of the log: the interesting error is almost always
 * near the end and it keeps the prompt small/cheap.
 */
export async function summarizeFailure(logs: string): Promise<string> {
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: logs.slice(-MAX_LOG_CHARS) },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}