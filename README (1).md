# CI Failure Triage Agent

An agentic AI system that watches a CI/CD pipeline, diagnoses failures automatically, and reports back — built to learn how agentic AI patterns apply to real DevOps workflows.

## What it does

When a GitHub Actions CI run fails on a pull request, this bot:

1. **Observes** — detects the failure via a `workflow_run` trigger and fetches the failed job's logs through the GitHub REST API
2. **Reasons** — sends the log content to an LLM (Groq / Llama-family model) to diagnose the likely root cause
3. **Acts** — posts the diagnosis back as a comment on the originating pull request, including the suspected cause, supporting evidence from the log, and a suggested next step

This is the core agentic loop — *observe → reason → act* — applied to a real DevOps problem instead of a toy example.

## Architecture

```
CI workflow fails on a PR
        │
        ▼
workflow_run event fires
        │
        ▼
Triage workflow (.github/workflows/ci-failure-triage.yml)
        │  passes run-id, secrets, and github context as inputs
        ▼
Composite action (action/action.yml)
        │  fetches logs → calls Groq API → posts PR comment
        ▼
Comment appears on the PR
```

**Why split into a workflow + a composite action?** The composite action is reusable and testable in isolation, but composite actions cannot read GitHub's `github.*` or `secrets.*` contexts directly — only the calling workflow can. So the workflow is responsible for pulling those values out of its own context and explicitly passing them into the action via `inputs:` and `env:`. This separation is a standard GitHub Actions pattern, not specific to this project.

## Tech stack

- **TypeScript / Node.js** — core logic (log fetching, LLM call, comment posting)
- **GitHub Actions** — trigger + execution environment (`workflow_run` event, composite action)
- **Octokit** — GitHub REST API client
- **Groq API** (OpenAI-compatible) — LLM inference, free tier, no cost to run

## Problems solved while building this

Debugging this taught more about how GitHub Actions and LLM APIs actually behave than any tutorial would have. A few of the real issues hit and fixed:

**1. `Unrecognized named-value: 'github'` / `'secrets'`**
Composite actions can't access `github.*` or `secrets.*` at all — not even inside plain description text in `action.yml`. GitHub evaluates every `${{ }}` expression in the action's metadata file, including documentation strings, so even an *example* expression in a description field throws this error. Fix: all runtime values are passed in as `inputs:`/`env:` from the calling workflow, and descriptions avoid literal `${{ }}` syntax entirely.

**2. Silent model 404**
The LLM call failed with an ambiguous "model does not exist or you do not have access" error. This looked like an auth problem but wasn't — the specific Llama model had become Enterprise-only on the provider. Lesson: a 404 from an LLM API usually means "model unavailable to your tier," not "bad API key" — check model availability before assuming credentials are wrong.

**3. Unreliable PR-lookup endpoint**
The original design made a separate API call to look up which PR a failed run belonged to, but that endpoint returned inconsistent 404s. The fix: that data was already present in the initial "get workflow run" response (`run.pull_requests`), so the extra network call was removed entirely — fewer requests, fewer failure points, more reliable.

## What this project demonstrates

- Understanding of the agentic loop (observe → reason → act) applied outside a chatbot context
- Real GitHub Actions internals: context scoping, composite actions vs. workflows, `workflow_run` triggers
- Debugging opaque CI/API errors methodically rather than guessing
- Making pragmatic engineering tradeoffs (removing a redundant API call in favor of existing data)
- Working with LLM APIs in production-adjacent conditions (rate limits, model availability, free-tier constraints)

## Running it yourself

1. Fork/clone this repo
2. Add a repository secret `GROQ_API_KEY` (free key from [console.groq.com](https://console.groq.com))
3. Open a PR that fails CI — the triage bot will comment automatically once the failure is detected
