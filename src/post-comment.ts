/**
 * Stage 3 — Post the triage summary as a PR comment.
 *
 * A workflow run was triggered by a pull request (or a push). We find the
 * PR that triggered the run, then post the LLM's analysis on it.
 *
 * API notes:
 *  - The "Get a workflow run" response already embeds the run's associated
 *    pull requests in `run.pull_requests` — we read the PR number from there.
 *    (The dedicated endpoint GET .../runs/{id}/pull_requests currently
 *    responds 404 even with full-scope tokens, so we deliberately avoid it.)
 *  - Comments on a PR go through the *issues* endpoints (a PR *is* an issue
 *    on GitHub's API) → POST /repos/{owner}/{repo}/issues/{n}/comments
 */

import { Octokit } from "@octokit/rest";

/** Structural subset of the workflow-run payload we need to find the PR. */
export interface RunWithPullRequests {
  pull_requests?: { number: number }[] | null;
}

/**
 * Returns the PR number that triggered a run, or null if the run wasn't
 * caused by a pull request (e.g. a push to main).
 */
export function findAssociatedPr(run: RunWithPullRequests): number | null {
  return run.pull_requests?.[0]?.number ?? null;
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