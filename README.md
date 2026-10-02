# Eight Realms: The Moonlit Keep

An isometric remake of Eight Realms. Realm 1: a knight crosses a moonlit countryside, frees a
captive, lowers the keep's drawbridge and dethrones the Goblin King. Realm 2, Whisperwood (the
prototype's second realm), is reached on foot along the thorn road; see [its page](docs/realms/2-whisperwood.md). Realm 3, the Sunken
Reef, a drowned coast, lies at the foot of the Sea Stair below Whisperwood's sea cliff. Realm 4, the
Scorched Dunes, is a draft plan on [the board](board/README.md) (nothing built yet). It runs in the browser, on desktop and
on phones.

## Run it

```
npm install
npm run dev
```

Open the address Vite prints (http://localhost:5173, or the next free port if that one is taken).

**On your phone:** keep the dev server running and put the phone on the same Wi-Fi.
Vite prints a `Network:` address when it starts (something like `http://192.168.1.20:5173`).
Open that on the phone. The game goes fullscreen and asks for landscape when you press Begin
(held upright it still plays, with a taller view).

`npm run build` makes a static copy in `dist/` that any web host can serve.

## Docs

[docs/README.md](docs/README.md) is the full index. In short:

| Where | What |
| --- | --- |
| [docs/play/](docs/play/) | Playing: [controls](docs/play/controls.md), [foes and effects](docs/play/foes.md), [known limits](docs/play/known-limits.md) |
| [docs/realms/](docs/realms/README.md) | The realms, a page each; the pause menu's map, the journal and saving |
| [docs/design/](docs/design/) | The design rules, how to build a realm, what realms share and what each brings, their scores, difficulty, notes for later realms |
| [docs/code/](docs/code/) | The architecture, the [project layout](docs/code/layout.md), code and writing style |
| [docs/testing/](docs/testing/) | How the game is checked, every check, the [testing shortcuts](docs/testing/shortcuts.md) |
| [docs/workflow/](docs/workflow/) | Work copies, briefs and merging; which agent, command and skill to use for what |
| [board/](board/README.md) | The task board: backlog, todo, in progress, blocked, done, and the plans ([BOARD.md](BOARD.md) is its index) |
| [CLAUDE.md](CLAUDE.md) | Read first by Claude Code: what an agent needs to start work here |
| [.claude/](.claude/) | Slash commands, skills and agent definitions |

## Credits

Music uses instrument samples from the FluidR3_GM soundfont by Frank Wen (CC BY 3.0),
taken from the original Eight Realms. Everything else is made in code.
