/**
 * Stage 3 — Post the triage summary as a PR comment.
 *
 * A workflow run was triggered by a pull request (or a push). We find the
 * PR that triggered the run, then post the LLM's analysis on it.
 *
 * API notes:
 *  - Runs link to PRs via GET /repos/{owner}/{repo}/actions/runs/{id}/pull_requests
 *  - Comments on a PR go through the *issues* endpoints (a PR *is* an issue
 *    on GitHub's API) → POST /repos/{owner}/{repo}/issues/{n}/comments
 */

import { Octokit } from "@octokit/rest";

/**
 * Returns the PR number that triggered a run, or null if the run wasn't
 * caused by a pull request (e.g. a push to main).
 */
export async function findAssociatedPr(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
): Promise<number | null> {
  // octokit.rest doesn't always expose this endpoint (it varies by SDK version),
  // so call the REST route directly — path is stable across GitHub API versions.
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}/pull_requests",
    { owner, repo, run_id: runId },
  );
  return data[0]?.number ?? null;
}

/** Posts the summary as a comment, with a header to keep it visually distinct. */
export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  summary: string,
): Promise<void> {
  const body = `## 🤖 CI Failure Triage\n\n${summary}\n\n---\n*Generated automatically on workflow run failure.*`;
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}