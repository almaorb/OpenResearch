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
- A check's output is what the builder reads when it fails. Do not filter
  it through `grep … | head -1`: a run that failed for a locked database
  came back as an empty line and a zero exit, and the builder had nothing
  to fix. Run the command plain and put the condition in `expect`
  (`"contains:test result: ok"`).
- Prefer checks that already exist: the project's tests, its build, its
  linter. A check that already passes on the untouched tree proves nothing
  on its own — pair it with one that only goes green once the phase's work
  exists (`test -s NEW_FILE`, `cargo test new_test_name`, `grep -q`).
- Say which is which in the description: `VERIFY (passes today): …` for a
  check that pins what the research found to exist, `BUILD: …` for one that
  fails until the phase's work is there. Every `VERIFY` check is run in the
  worktree the moment the plan is approved, and one that fails sends the
  plan back with its output — the picture of the tree was wrong, so fix
  the plan, not the check. (A `VERIFY` check in the browser is left for the
  run.) A phase should carry both: what it starts from, and what it adds.
- Order the phases so each one leaves the tree working. Do not number them;
  order is position in the list. Four to eight phases is usually right; a
  phase is an hour or two of work.
- The run has a port of its own, `$ALMA_PORT`, set in every check's shell
  and the builder's, and expanded in `http` and `browser` URLs. Anything a
  phase starts to be checked listens on it — never on a fixed number, which
  the next run or the product's own instance would be sitting on. Say so in
  the phase: "serve on `$ALMA_PORT`"; check
  `http://127.0.0.1:$ALMA_PORT/health`.
- A check may probe a URL (`{"description": ..., "http": "http://127.0.0.1:$ALMA_PORT/health",
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
- `docs/inventory.md` opens with the table the research built under "What
  already exists" in `alma-research`: every company repository
  (`gh repo list almaorb`) and every OpenResearch project
  (`/api/projects`) the goal touches, each with its path and what it
  provides, and for each capability the goal needs, the repository it
  comes from. Nothing here is built from scratch: a dashboard extends the
  dashboard, sign-in is the dashboard's Google sign-in, a voice surface is
  the orb, a product starts from `orb-starter` or, until it exists, from
  the parts `BRICKS.md` names. Each phase's brief names the repository,
  crate or component it builds on, by path; a phase that scaffolds, copies
  by hand or reimplements something the inventory lists is a phase the
  human will send back, and a capability the inventory marks as absent
  says which repositories were checked.
- `docs/whitepaper.md` opens with the product sections the research wrote
  under "Before the shape": the thesis, who it is for, what we will not
  build, who pays, the hazard designed out, the gates. Each phase's prose
  names the differentiator it serves; a phase that serves none is the first
  candidate to cut. The hazard's design lands in the phase that writes the
  schema, not in a later "hardening" phase — a vault or a token split is
  cheap in the first migration and a rewrite in the tenth.
- The plan lives inside the standing defaults of `alma-research` (our own
  VPS behind Caddy, the SPA + Rust binary + SQLite base model, Opus 5 and
  Gemini 3.8 Flash, never Haiku, no managed platform services). A phase that
  provisions a Vercel project, a Supabase database or an AI-SDK gateway is a
  phase the human will reject; an ADR that departs from a default names it
  and says why.
- The prose above the block and the block must agree. The block is what
  runs.

If the plan comes back with "That plan cannot be supervised: …", fix exactly
what it names and present the plan again.
