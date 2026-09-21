/**
 * Stage 1 — Fetch raw logs from a failed GitHub Actions run.
 *
 * Pipeline:
 *   1. Find the workflow run by ID (CLI arg or GITHUB_RUN_ID).
 *   2. Verify the run actually failed.
 *   3. List the run's jobs and pick the first FAILED one.
 *   4. Download that job's logs (plain text or zip, GitHub varies by API version).
 *   5. Print the log text.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx npm start -- <run_id>
 *   or (inside GitHub Actions) the script reads GITHUB_RUN_ID automatically.
 */

import { Octokit } from "@octokit/rest";
import unzipper from "unzipper";
import { summarizeFailure } from "./summarize.js";
import { findAssociatedPr, postComment } from "./post-comment.js";

// ─────────────────────────────────────────────────────────────
// Configuration — all secrets come from the environment.
// ⚠️ Requires: GITHUB_TOKEN — a token with `repo` (classic) or
//    `actions: read` + `checks: read` (fine-grained) permissions.
// ⚠️ Do NOT hardcode a token. Local runs can pass it inline (as above);
//    in GitHub Actions it comes from `secrets.GITHUB_TOKEN` / `${{ github.token }}`.
// ─────────────────────────────────────────────────────────────

/** Pulls owner/repo/number/lifetime from a GitHub API URL. Stays unversioned. */
function getRunId(argv: string[]): number | null {
  // 1. CLI argument: `npm start -- 123456`
  const fromArg = argv[2] ? Number(argv[2]) : NaN;
  if (Number.isInteger(fromArg)) return fromArg;

  // 2. Environment variable: what the GitHub Action sets.
  //    Guard for null/empty: Number("") is 0, which would silently pass as a valid ID.
  const envRunId = process.env.GITHUB_RUN_ID;
  const fromEnv = envRunId ? Number(envRunId) : NaN;
  if (Number.isInteger(fromEnv)) return fromEnv;

  return null;
}

/**
 * GitHub serves job logs one of two ways depending on API version:
 *   - a plain text file, or
 *   - a .zip archive containing one .txt file.
 * Detect by checking for the "PK" magic bytes and decode accordingly.
 */
async function decodeLogBody(body: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(body);
  const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"

  if (!isZip) return buf.toString("utf8");

  const directory = await unzipper.Open.buffer(buf);
  let text = "";
  for (const file of directory.files) {
    text += (await file.buffer()).toString("utf8") + "\n";
  }
  return text;
}

/** Resolve owner/repo. Locally set GITHUB_REPOSITORY="owner/repo"; the Actions runner sets it for us. */
function resolveRepo(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (!owner || !repo) {
    console.error(
      "Missing GITHUB_REPOSITORY (expected format 'owner/repo'). Set it locally or let the GitHub Action provide it.",
    );
    process.exit(1);
  }
  return { owner, repo };
}

async function main(): Promise<void> {
  // 1. Resolve where we're pointing — owner/repo come from the local repo's remote,
  //    but in GitHub Actions they're injected as env vars by the runner.
  const runId = getRunId(process.argv);
  if (runId === null) {
    console.error("No run ID provided. Pass it as an argument (npm start -- <run_id>) or set GITHUB_RUN_ID.");
    process.exit(1);
  }

  const ctx = resolveRepo();

  // 2. Authenticated client. In a workflow, pass GITHUB_TOKEN as the token.
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Missing GITHUB_TOKEN.");
    process.exit(1);
  }
  const octokit = new Octokit({ auth: token });

  // 3. Confirm the run is actually finished and failed.
  const { data: run } = await octokit.rest.actions.getWorkflowRun({
    ...ctx,
    run_id: runId,
  });

  console.log(`Workflow: ${run.name ?? runId} (${run.display_title ?? "n/a"})`);
  console.log(`Conclusion: ${run.conclusion ?? "n/a"}  ·  Status: ${run.status}`);

  if (run.conclusion === "success") {
    console.log("Run succeeded — nothing to triage.");
    return;
  }

  // 4. Find the first failed job.
  const { data: jobsPage } = await octokit.rest.actions.listJobsForWorkflowRun({
    ...ctx,
    run_id: runId,
  });

  const failed = jobsPage.jobs.find((job) => job.conclusion === "failure");
  if (!failed) {
    console.log("No failed jobs found — nothing to triage.");
    return;
  }
  console.log(`Failed job: ${failed.name} (#${failed.id})`);

  // 5. Download the job logs. GitHub returns a 302 → signed URL;
  //    tell Octokit not to follow it, then fetch the target ourselves.
  const redirect = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
    ...ctx,
    job_id: failed.id,
    request: { redirect: "manual" },
  });

  const location = redirect.headers.location;
  if (!location) {
    console.error("No log download location found.");
    process.exit(1);
  }

  const res = await fetch(location);
  if (!res.ok) {
    console.error(`Log download failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const logs = await decodeLogBody(await res.arrayBuffer());
  console.log(`\nFetched ${logs.length} chars of logs from ${failed.name}.`);

  // ── Stage 2: send the log to the LLM (Groq) for a root-cause diagnosis ──
  if (!process.env.GROQ_API_KEY) {
    console.error("Missing GROQ_API_KEY. Set it to run the Stage 2 analysis.");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70) + "\nCLAUDE ROOT-CAUSE ANALYSIS\n" + "=".repeat(70));
  const summary = await summarizeFailure(logs);

  // ── Stage 3: publish the diagnosis on the PR that triggered the run ──
  // The PR number comes from the workflow-run payload itself (run.pull_requests);
  // the dedicated "runs/{id}/pull_requests" endpoint is currently broken (404).
  const prNumber = findAssociatedPr(run);
  if (prNumber === null) {
    console.log("\nRun was not triggered by a PR (or no PR associated) — skipping comment.\n");
    console.log(summary);
    return;
  }

  await postComment(octokit, ctx.owner, ctx.repo, prNumber, summary);
  console.log(`\nPosted triage comment to PR #${prNumber}.`);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});