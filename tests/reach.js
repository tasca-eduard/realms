window.__report = () => ({ done: window.__reach(true), early: window.__reach(false).unreachable.map((u) => u.what).filter((w, i, a) => a.indexOf(w) === i) });
