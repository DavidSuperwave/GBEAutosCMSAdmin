# Audit Request: Oracle Browser-Mode Configuration Fix

Please review the solution just applied in this workspace to fix GPT-Pro/Oracle runs being routed through API mode instead of launching browser mode.

## Specific Change To Review

The new file is:

- `.oracle/config.json`

It contains:

```json
{
  "engine": "browser",
  "model": "gpt-5.5-pro",
  "maxFileSizeBytes": 20971520,
  "timeoutMs": 3600000,
  "attachmentTimeoutMs": 300000,
  "browser": {
    "thinkingTime": "extended",
    "autoReattachIntervalMs": 120000
  }
}
```

## Problem Observed Before The Change

Oracle was installed and reachable, but `oracle status --hours 24` showed recent sessions using `api/bg`.

There was no project Oracle config at `.oracle/config.json` and no global config at `~/.oracle/config.json`.

`oracle --route -p "route probe only" --file <probe-file>` resolved `gpt-5.5-pro` through OpenRouter API because an `OPENROUTER_API_KEY` is available to Oracle.

## Verification Already Run

After adding `.oracle/config.json`, this dry run was executed:

```powershell
oracle --dry-run summary -p 'config verification only' --file package.json
```

It reported:

```text
[preview] Oracle (0.14.0) browser mode (gpt-5.5-pro) with ~815 tokens (includes 1 inline file).
[preview] Browser control: launch visible Chrome; may focus/control the browser UI.
```

## Scope

Please focus only on whether this `.oracle/config.json` solution is correct, durable, and sufficient for the `gpt-pro` plugin workflows in this Codex workspace.

The repo has unrelated dirty work in many application files. Treat those as out of scope unless they materially affect whether Oracle config is discovered or applied.

## Questions To Answer

1. Does the project-local `.oracle/config.json` correctly force Oracle browser mode despite API provider keys such as `OPENROUTER_API_KEY`?
2. Are the config key names correct for Oracle 0.14.0, especially `timeoutMs`, `attachmentTimeoutMs`, `browser.thinkingTime`, and `browser.autoReattachIntervalMs`?
3. Is anything important missing for reliable browser launch/login behavior on Windows/Codex, such as persistent browser profile, manual-login flags, attachment settings, visibility/hide-window settings, or ChatGPT URL?
4. Is committing a project-local `.oracle/config.json` advisable, or should any values be moved to a user/global config or ignored?
5. Are there any risks that this config could break normal Oracle usage, cause unwanted visible browser focus, or misroute future Pro reviews?

Please give a GO / CONDITIONAL-GO / NO-GO verdict, with concrete corrections if needed.
