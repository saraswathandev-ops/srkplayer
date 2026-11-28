# SRK direct ChatGPT automation

Roadmap: https://app.notion.com/p/426fbf9cf61781efaafced4320ddff6b

## Schedules (IST)
- Feature Planner: daily 06:00, research and add unapproved backlog tasks.
- ChatGPT Development: hourly, select one approved ready task with completed dependencies, edit through GitHub connector on dedicated branch, create draft PR, record exact head CI evidence in Notion.
- ChatGPT Build Repair: hourly, diagnose latest exact-head trusted branch failures and make focused repairs through GitHub connector. Persist incident and retry count before edits; stop at three attempts or if count is uncertain.
- Daily Progress: daily 22:00, reconcile evidence and report blockers.

## GitHub monitoring
The deployment-monitor.yml workflow checks recent Android runs every ten minutes (best effort, after merge into default branch). It reports statuses in Actions summaries; it does not invoke ChatGPT. The hourly repair schedule independently reads GitHub Actions. Existing Android build workflow is unchanged.

## Requirements and gates
Use connected GitHub and Notion permissions. No Codex CLI, Codex Action, external OpenAI API key or Notion integration token is required for the connector-based design. Scheduled connector writes depend on available authorization; report blockers if unavailable. No immediate event-to-ChatGPT trigger is configured. GitHub Actions remains responsible for builds. No direct main edits, auto-merge, force-push, signing or publishing by agents. Validate exact-head checks and physical-device smoke tests; approve tasks in Notion before implementation. Review draft PR before merging the monitor. End-to-end scheduled writes and repairs remain unverified until actual runs complete.
