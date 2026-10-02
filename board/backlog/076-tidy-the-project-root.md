---
id: 076
title: Tidy the project root
realm: all
area: process
status: backlog
priority: low
created: 2026-10-02
done:
owner:
depends: []
links: [../../docs/README.md]
---

# 076 Tidy the project root

`dist/` (the production build, `npm run build`) and `shots/` (screenshots, about 400 of them: `tools/shot.mjs` writes there by default) sit at the project root next to the docs. Both are git-ignored (`.gitignore`: node_modules, dist, shots), so this is about finding things, not the repo.

## Why

The user (2026-10-02): "make separate folders for the docs, we need to organize stuff"; the layout keeps nothing new
at the root but CLAUDE.md.

## To decide and do

Where screenshots should go (`tools/shot.mjs` line 8 defaults to `shots/shot.png` and line 10 makes `shots/`;
`tools/test-all.mjs` and `tools/withserver.sh` mention it too), whether old screenshots are kept, and whether
`dist/` is needed between builds. Don't move anything while a suite run is going.

## Checks

`npm run build`, one `node tools/shot.mjs` run, and a short `node tools/test-all.mjs <name>` run still write where expected.
