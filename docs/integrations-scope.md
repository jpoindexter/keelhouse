# Integrations Scope

Integrations should support the core loop: inspect/edit code, run agents, review changes, and hand work to source control. They are not a plugin marketplace.

## Must / Core

| Integration | Scope |
| --- | --- |
| Local Git | Detect repo root, branch, remotes, dirty/untracked/deleted files, diffs, stage/unstage/discard with confirmation, copy diff, open changed file. |
| Git credentials | Detect whether `git` operations can authenticate through existing system/CLI credentials; explain failures without storing passwords directly. |

## Should / First-Class Source Hosts

| Integration | Scope |
| --- | --- |
| GitHub | Use existing `gh` auth when available; support repo detection, open repo/PR/issue in browser preview or external browser, show PR/CI status, and later create PRs from reviewed work. |
| GitLab | Use existing `glab` auth or token/API URL; support gitlab.com and self-hosted instances, repo/MR/issue links, pipeline status, and later create merge requests. |

## Could / Adapter Lane

| Integration | Scope |
| --- | --- |
| Bitbucket / Azure DevOps | Remote detection, open links, auth health, PR status if a project uses them often. |
| Linear / Jira | Link branch names, commits, PRs/MRs, or session labels to issue URLs; do not become a project management client. |
| Slack / Discord | Optional notification targets for agent completion or attention-needed events; no chat client. |

## Boundaries

- Prefer installed CLIs (`git`, `gh`, `glab`) before direct API implementations when they cover the job.
- Store tokens only through OS-safe credential storage; never in plain config.
- Every mutating action needs visible user intent and an undo/recovery path where possible.
- Agents can request integration actions only through permissioned app-owned commands with attribution.
- No arbitrary third-party plugins or unreviewed extension execution.
