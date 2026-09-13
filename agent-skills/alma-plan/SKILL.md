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
- The prose above the block and the block must agree. The block is what
  runs.

If the plan comes back with "That plan cannot be supervised: …", fix exactly
what it names and present the plan again.
