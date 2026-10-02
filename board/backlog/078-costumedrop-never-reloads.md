---
id: 078
title: The costumedrop check never reloads the page
realm: aqua
area: tests
status: backlog
priority: medium
created: 2026-10-02
done:
owner:
depends: []
links: [../../docs/testing/checks.md]
---

# 078 The costumedrop check never reloads the page

## What

`tests/costumedrop1.js` never reloads, so `costumedrop2.js` runs on the same page: the check passes without testing
what its description in `tools/test-all.mjs` says ("after a reload it's still where he stood"). Part 1 should hand its
state over in `sessionStorage` and call `location.reload()`, as `tests/kip1.js` does.

## Why

Found by docs agent 3 (2026-10-02) while writing docs/testing/checks.md. A suit that vanished on reload would leave a
knight who felled Brassbelly with no way under the sea, and this check would not catch it.

## Checks

`costumedrop` passes with a real reload between its two parts (its report shows the page's load count or a fresh
`__game`), five runs in a row.
