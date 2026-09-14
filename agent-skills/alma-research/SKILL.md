---
name: alma-research
description: "Research an engineering goal inside the Alma IDE before planning it: what the company already knows (memory), what the codebase already does (semantic index), what exists on GitHub and the web, and which approach holds up. Use whenever a task starts with a goal rather than a diff — a feature, an integration, a rewrite, 'should we build it this way or that way' — and before proposing a plan."
---

# Research before you plan

You are the senior engineer at the whiteboard. The goal arrives as a sentence;
your job is to find out what is true before anyone commits to a shape. The
tools below are the Alma IDE's — `mcp__alma__*` — and they answer from THIS
company's memory, THIS project's code, and the browser the human is watching.

## The loop

1. **What do we already know?** `memory_recall` with the goal in the
   human's own words, then again with the two or three technical terms it
   implies. Past conversations, decisions and research notes come back with
   where they came from. A plan that repeats last month's research is wasted;
   a decision that was already made is not yours to reopen without saying so.
2. **What does the code already do?** `rag_search` the open project with the
   question a newcomer would ask ("where do we decide whether a phase
   passed?"), not a grep string. If it answers `indexed: false`, call
   `rag_index` once and search again. Then read the files it names. Never
   claim the code does or does not do something you have not read.
3. **What have we already built?** Every product here is assembled from
   the company's own parts, never from scratch; find them before looking
   anywhere else. See "What already exists" below for where the inventory
   comes from and what the report must say about it.
4. **What exists elsewhere?** GitHub through `gh` in Bash — `gh search repos
   "<terms>" --sort stars --limit 10`, `gh repo view <owner/repo>`, `gh api
   repos/<owner>/<repo>/contents/<path>` — and the web through WebSearch and
   WebFetch. Prefer references you can point at: a repository, a file, a doc
   page, a release note. Say how old and how maintained each one is.
5. **What is the product?** Before any shape is chosen, answer the
   questions under "Before the shape" below, in the report. A shape chosen
   before the thesis is a stack looking for a product.
6. **Which way?** When there are two or three plausible shapes, name them,
   say what each costs and what it buys, and pick one — with the reason.
   "It depends" is not an answer a senior engineer gives; "B, because A
   needs a migration we would regret" is.
7. **Write it down.** `memory_remember` a titled note (what was asked, what
   was found, the links, the recommendation) so the next session, and the
   voice orb, can recall it. One note per research question, not per tool
   call.

## What already exists

The company's work is documented so that the next product is built on it:
the dashboard has a dashboard to start from, voice has the orb, auth, mail,
phone and payments are already wired somewhere. A report that does not
inventory these sends the plan off to rebuild one of them. So, before the
options section, the report carries an inventory drawn from these three
places, each entry with its repository, path and what it provides:

- **The catalog, first.** `~/code/examples/CATALOG.md` lists every
  repository by tier — **production** (serves a client), **scaffold** (empty
  structure), **example** (a worked example in the corpus), **tooling** —
  with lineage, vertical, stack, features and what each is good for, rendered
  from a `catalog.toml` in every repository. Its last table is the retrieval
  view: lineage × vertical → what to seed from. Filter there before reading
  code: the goal's lineage and vertical name the two or three repositories
  worth opening. The words are defined in `~/code/examples/GLOSSARY.md`;
  use them and no synonyms.
- **The company's repositories.** `gh repo list almaorb --limit 100`
  (Bash) for anything the catalog does not list yet. `github.com/almaorb/examples`
  (formerly `workspaces`) is the corpus of prototypes, legacy and unfinished
  work; its `PRODUCTS.md` says what each product is and `BRICKS.md` which
  parts are reusable and how (the SPA shell to copy, the kernel to build on).
  Production products live in their own repositories beside it (`almaorb`,
  `myhoma`, `villanofyam`, `seataya`, `hotelnative`, `peakbuilders`,
  `dishorb`), each at `~/code/<name>` on the Mac and `/opt/<name>` on the VPS.
- **The OpenResearch projects.** `curl -s http://127.0.0.1:4791/api/projects`
  (the local orx serving this session) lists every repository already under
  research or planning here, with its GitHub name and checkout path. A
  project already open is one someone is already thinking about; recall its
  notes (`memory_recall` with its name) before proposing anything that
  overlaps it.
- **The base model and the bricks.** `docs/dashboard-architecture.md` in the
  almaorb repository describes the dashboard every product app is forked
  from; `BRICKS.md` §6 records which parts are being promoted into a starter.
  When `orb-starter` exists, a new product starts from it; until then, from
  the almaorb SPA keep list and the `myhoma` backend kernel, as `BRICKS.md`
  says.

The inventory says, for each capability the goal needs, which existing
repository provides it — or that none does, with the two or three you
checked. That table is what the plan's `docs/inventory.md` becomes; a plan
without it builds a dashboard beside the dashboard, and the human will send
it back.

## Before the shape

The loop above finds what is true; it does not say what the product is.
Left to the engineering questions alone, a report lists features, picks a
stack and sequences phases, and never says why anyone would switch to it —
the same model, asked the product questions in a plain chat, wrote a sharper
plan than the pipeline did. So the report answers these, in this order,
before its options section, each in a few lines and each carrying the same
evidence rule as the rest:

- **The thesis.** One sentence: what this product does that the incumbents
  structurally cannot, and the mechanism that makes it true. Not a feature
  list — the organising principle every feature serves.
- **Who it is for.** The user, the buyer, the gatekeeper and the payer are
  often four different people (a teacher, a district, its IT office, a
  sponsoring bank). Name each and the job they are hiring the product for,
  in their own words.
- **What we will not build.** The neighbouring products we will not compete
  with, and why the incumbents make that safe — a free incumbent is
  distribution, not competition, when the product sits beside it.
- **Who pays, in what order.** The revenue paths, sequenced, with the one
  that should drive the roadmap first. A product without this is a hobby.
- **The hazard to design out.** The one thing that must be impossible by
  construction rather than caught by a filter (a minor's real finances on a
  public page; a customer's secret in a prompt). Name it, and name the
  design that removes it, because it shapes the data model from the first
  migration on.
- **The gates.** Per phase, the adoption signal that says the wedge is
  right — people returning unasked, an artifact taken home — and one kill
  criterion: the date and the number at which we stop rather than build on.

These are the sections a product person would write first; here the same
engineer writes them, from the evidence, before choosing a shape.

## Standing defaults

These are decided. Research starts from them; it does not rediscover them,
and a recommendation that contradicts one without saying so is wrong.

- **We host everything ourselves.** One VPS (`almaorb.com`), Caddy in front,
  each service a binary bound to a loopback port under `/opt/<product>`,
  files on the VPS disk. Never Vercel, Netlify, Railway, Fly, Supabase, Neon,
  PlanetScale, Firebase or any managed app/database/storage service, and no
  "deploy later" that assumes one. A stack that only works on a platform is
  the wrong stack.
- **The base model.** A product is a React SPA served same-origin by one Rust
  axum binary over one SQLite file (WAL) — the shape every product app is
  forked from (`docs/dashboard-architecture.md` in the almaorb repository,
  `github.com/almaorb/almaorb`). Start there, and from whatever the
  inventory under "What already exists" found; never from a blank
  scaffold. Postgres is the exception for a real reason recorded in an
  ADR, self-hosted on the VPS either way.
- **Models.** Claude Opus 5 (`claude-opus-5`) where quality matters and
  Gemini 3.8 Flash (`gemini-3.8-flash`, strictly — not 3.5, not "Flash-Lite")
  for bulk and latency-bound paths. Never Claude Haiku. Provider SDKs
  directly; no Vercel AI SDK or other platform gateway. Check the model IDs
  against https://ai.google.dev/gemini-api/docs/models and the Claude API
  reference rather than memory; they move.
- **Auth, mail, phone, payments** go through what the company already runs
  (the dashboard's Google sign-in, Stalwart mail, Twilio, Stripe) rather
  than a new vendor per product.

When `memory_recall` names a later decision, the later decision wins; say
which one and where it came from.

## Rules

- Every claim carries a link or a file path. A finding without one is an
  opinion.
- A tool that fails is a finding, not a footnote. If `memory_recall` or
  `rag_search` errors, stop and say so in one line before anything else —
  the human can fix the editor in a minute, and research done blind to the
  company's memory picks the wrong defaults (a session once recommended
  Vercel and Supabase that way). Do not carry on with "the memory server
  was down" buried in the summary.
- Ask the human ONE question at a time when something essential is missing —
  the goal, the constraint, what "done" looks like. Do not interview; do not
  ask what you could find out yourself.
- Reading is unlimited in plan mode; editing the tree is not. Research
  produces notes and a plan, never code.
- When the human is speaking through the voice orb (messages arrive as
  short spoken sentences, sometimes mid-thought), answer in a few short
  lines: the orb reads your reply aloud, and a page of prose spoken out loud
  is a wall. Put the long form in the plan.
