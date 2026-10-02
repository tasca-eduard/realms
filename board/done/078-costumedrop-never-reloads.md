---
id: 078
title: The costumedrop check never reloads the page
realm: aqua
area: tests
status: done
priority: medium
created: 2026-10-02
done: 2026-10-02
owner: an agent (balancer, its own copy)
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

## Done 2026-10-02

`tests/costumedrop1.js` hands its report over in `sessionStorage`, marks the old page, sets `__ready = false` and reloads;
`tests/costumedrop2.js` reports the navigation (`page: "reload"`) and that the old page's mark is gone (`fresh: true`), and
its `ok` needs part 1's felled state too. Checked: 8 runs in a row with a real reload (5 alone, 3 through the suite);
costume 3 of 3.
