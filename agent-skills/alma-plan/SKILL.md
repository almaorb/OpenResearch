---
name: alma-plan
description: "Write an engineering plan the Alma IDE's supervisor can run unattended: ordered phases, each with a brief and at least one shell check that decides on its own whether the phase worked. Use in plan mode, once the research is done and the human has heard the shape, before calling ExitPlanMode."
---

# A plan the supervisor can run

When the human approves your plan with **Approve and build**, the Alma IDE's
supervisor takes over: it hands you one phase at a time in this same session,
runs that phase's checks when you stop, and only then hands you the next —
or hands the same one back with the failing output. Nobody is watching in
between. So the plan you present must be one a machine can drive.

## The contract

Your `ExitPlanMode` plan is Markdown for the human — goal, what was found,
the approach and why, the phases in prose — and it ENDS with exactly one
fenced `json` block in this shape:

```json
{
  "title": "a short name for the run",
  "phases": [
    {
      "title": "what this phase delivers",
      "intent": "the brief you will be handed: what to do, and what done looks like",
      "checks": [
        {"description": "what this establishes", "command": "a shell command", "expect": "success"}
      ]
    }
  ]
}
```

- Every phase needs at least one check. A check is a shell command that runs
  in the repository and decides, on its own, whether the phase worked. No
  phase may end in a person looking at something. If a phase cannot be
  checked that way, split it or rewrite it until it can.
- `expect` is one of `"success"` (exits zero, the default), `"exit:N"`,
  `"contains:TEXT"`, `"excludes:TEXT"`.
- Prefer checks that already exist: the project's tests, its build, its
  linter. A check that already passes on the untouched tree proves nothing
  on its own — pair it with one that only goes green once the phase's work
  exists (`test -s NEW_FILE`, `cargo test new_test_name`, `grep -q`).
- Order the phases so each one leaves the tree working. Do not number them;
  order is position in the list. Four to eight phases is usually right; a
  phase is an hour or two of work.
- A check may probe a URL (`{"description": ..., "http": "http://127.0.0.1:3000/health",
  "expect_status": 200}`) or a page in the editor's own browser
  (`{"description": ..., "browser": "<url>", "script": "<javascript that
  evaluates to a truthy value once the page is right>"}`). **A phase that
  adds or changes anything a person sees in a browser must carry a browser
  check.** A build passing says nothing about a page: one that served its
  own source as text, and one that froze the editor on open, both passed
  every shell check they had.
- A phase that writes a script must run it, not parse it. `bash -n` and
  `--help` prove nothing; if the script cannot run against the instance
  that is verifying the phase, give it a dry-run mode and check that, or
  run it against a second instance on another port.
- Optional top-level keys: `"policy"` (standing rules of the environment,
  quoted into every brief; without it the default says everything is
  preinstalled and nothing may be installed, containerised or scaffolded),
  `"executor": {"ssh": {"host": ..., "directory": ...}}` to build on a
  remote host over ssh and tmux, and per phase `"id"` and `"depends_on"`.
- Before `ExitPlanMode`, write the design down as files in the worktree so
  the supervisor and every phase can read them: `docs/inventory.md` (what
  already exists and where — the capability map from the research),
  `docs/whitepaper.md` (the problem, prior art, the approach and why) and
  one `docs/adr/NNNN-<slug>.md` per significant choice (context, options
  considered, decision, consequences). Every brief names them.
- The prose above the block and the block must agree. The block is what
  runs.

If the plan comes back with "That plan cannot be supervised: …", fix exactly
what it names and present the plan again.
