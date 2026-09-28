# CI Failure Triage Agent

A GitHub Actions bot that reads failed CI logs, asks an LLM for the likely root cause, and posts the diagnosis as a comment on the pull request.

Built to learn how agentic AI fits into a DevOps pipeline: **observe → reason → report**, with a human deciding what to fix.

## Demo: catching a real bug

The repo includes a small coffee-shop app (`demo-app/`) with a Jest test suite that runs in CI. It has a `calculateOrderTotal` function with a rule: *10% discount when the order has 3 or more items in total.*

A subtle bug was introduced: the discount was checked **per order line** instead of on the **total quantity**. So 3 cups on one line got the discount, but 2 lattes + 1 croissant did not.

What happened on the pull request:

1. CI ran the tests and one failed (`Expected: 9.45, Received: 10.5`)
2. The triage bot fetched the logs, asked the LLM, and commented with the failing test and evidence
3. I read the failure, found the faulty condition, and fixed it
4. CI turned green

See the full story in [PR #3](https://github.com/khalillaabidi25-gif/ci-triage-agent/pull/3).

> Add a screenshot of the bot's comment here: `docs/bot-comment.png`

### What I learned from the bot being partly wrong

The bot correctly found the failing test and quoted the right evidence. But its suggested fix (count `items.length`, or change the test) was wrong: the test was correct and the bug was in the function. If the bot had been allowed to apply its own fix, it would have made things worse.

That is why this is a **diagnostic** agent, not an autonomous one: it investigates and reports, and a human approves any code change.

## How it works

```
CI fails on a PR
      │
      ▼
workflow_run event triggers the triage workflow
      │
      ▼
Composite action:
  1. fetch the failed job's logs (GitHub REST API)
  2. send the log to an LLM for a root-cause analysis (Groq)
  3. post the analysis as a PR comment
```

The workflow (`.github/workflows/ci-failure-triage.yml`) holds the trigger and passes the run ID and secrets into the action (`action/action.yml`), because composite actions cannot read `github.*` or `secrets.*` directly.

## Tech stack

- TypeScript / Node.js
- GitHub Actions (`workflow_run` trigger, composite action)
- Octokit (GitHub REST API)
- Groq API (OpenAI-compatible), free tier
- Jest (for the demo app's tests)

## Problems solved along the way

- **`Unrecognized named-value: 'github'`**: composite actions cannot use `github.*` or `secrets.*`, and GitHub evaluates `${{ }}` even inside description text. Values are now passed in as inputs/env from the calling workflow.
- **Model 404**: the original Llama model became unavailable on the free tier. A 404 from an LLM API often means "model not available to you," not "bad key."
- **PR lookup 404**: a dedicated endpoint for finding the PR kept failing. The PR number was already in the workflow run response, so the extra call was removed.

## How it was built

I designed the project, directed an AI coding agent (OpenCode) to implement it in stages, debugged the errors that came up, and wrote the bug fix in the demo app myself.

## Run it yourself

1. Fork the repo
2. Add a repository secret named `GROQ_API_KEY` (free key from [console.groq.com](https://console.groq.com))
3. Open a pull request that breaks a test. The bot comments once CI fails
