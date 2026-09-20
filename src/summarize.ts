/**
 * Stage 2 — Root-cause summarization with Claude.
 *
 * Takes the raw job log from Stage 1, sends it to Claude, and gets back
 * a structured root-cause diagnosis we can post to a PR later.
 *
 * ⚠️ Requires: ANTHROPIC_API_KEY (env). The SDK reads it automatically —
 *    no key is ever stored in code.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Model + payload size are env-configurable so the GitHub Action can pass
// them as inputs without us rebuilding. Defaults are good for most repos.
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
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
 * Summarizes a CI failure log with Claude.
 * We send only the tail of the log: the interesting error is almost always
 * near the end and it keeps the prompt small/cheap.
 */
export async function summarizeFailure(logs: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: logs.slice(-MAX_LOG_CHARS) }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}