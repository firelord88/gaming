# Life Sentence

A full-3D, third-person prison survival story that runs in the browser.

You are **Stefan Reed**, 32, a first-time prisoner serving life without parole at the
fictional Harlan Creek Unit in Texas. Walk the cellblock, the yard, the chow hall /
commissary and the library; talk to people; make choices. Your decisions move five
stats (Health, Mind, Reputation, Trust, Heat) and decide which of seven endings you get.

- **Raymond** — your cellmate, nineteen years down, teaches the rules people actually live by.
- **Nathan** — the quiet man who runs the library cart. Depending on how you treat him he
  becomes your best friend, your love interest, or nobody.
- Eight chapters: Intake (Day 1), Commissary (3), The Yard (5), The Officer (8),
  Lockdown (14, a timed run back to your cell), Reputation (30), The Dream Seller (180),
  The First Year (365).

## Play

Open `index.html` in a browser (no build step, no server needed), or serve the folder:

    python3 -m http.server 8000

| | Keyboard / mouse | Touch |
|---|---|---|
| Walk | WASD or ↑↓ | drag the left side |
| Look | drag the mouse, or ← → | drag the right side |
| Run | Shift | push the stick all the way |
| Interact | E | tap the yellow prompt |
| Choose | 1–4 or click | tap |

Progress autosaves at the start of each day (localStorage).

## Layout

- `index.html` — page, HUD and styles
- `js/engine.js` — renderer, world geometry, characters, controls, camera, audio
- `js/main.js` — game state, UI, and the story script
- `vendor/three.min.js` — three.js r160 (MIT)

A work of fiction for adults. It depicts prison violence, coercion and corruption as
story events and deliberately contains no real-world instructions for weapons,
smuggling or escape.
