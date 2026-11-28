# SRK AI automation (initial gated rollout)

Roadmap: https://app.notion.com/p/426fbf9cf61781efaafced4320ddff6b

Existing Android CI: .github/workflows/main.yml (Build & Deploy Android APK). Existing AGENTS.md remains unchanged.

## Activation
1. Review this PR; do not merge until existing Android CI is healthy. Schedule and workflow_run triggers require the workflow on the default branch.
2. The monitor requires no API key. It summarizes the latest runs by branch every ten minutes, subject to GitHub scheduling delays. It does not retry or publish.
3. Add OPENAI_API_KEY as a GitHub Actions secret with a budget limit. Never commit credentials. Set repository variables SRK_AI_DEVELOPMENT_ENABLED and SRK_AI_REPAIR_ENABLED to true only after reviewing the action version and trust boundaries. Default is disabled.
4. Run SRK AI Development manually with one approved Notion task. Candidate patch is an artifact only. Inspect the patch, apply on a separate branch and run npm ci, npm run typecheck, npm run lint, npm run build and the existing Android CI. Never bypass required checks.
5. Repair only triggers for the latest first-attempt failed default-branch run in this initial rollout. It rejects stale heads and external repositories; it does not retry automatically. Treat logs as untrusted and review candidate patch before applying.

## Remaining integration
The ChatGPT hourly queue can select approved tasks, but this rollout does not yet fetch Notion automatically or push patches. Implement a separate trusted orchestration service with NOTION_TOKEN and NOTION_DATA_SOURCE_ID, atomic task claim, dependency checks, exact-head CI, persistent retry counter (max three), separate write-only PR publishing job and explicit merge approval. GitHub token generated commits do not normally trigger subsequent workflows; use an approved app token or explicit dispatch with appropriate permissions. Never execute untrusted PR code with secrets. Do not expose raw failure logs publicly.

No auto-merge, release or production signing changes. Keep existing build monitor for alerts. Physical-device smoke tests remain a human gate.
