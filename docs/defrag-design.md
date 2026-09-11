# defrag

A puzzle game where the desktop's windows are the level.

## The idea

The machine is coming apart. Its rooms have drifted into separate windows.
Each room is a small ASCII map inside a window. The room moves with its
window, and the player (`@`) can walk from one room into another only where
their edges meet cell for cell on screen. Dragging, stacking and cutting
windows is how the path gets built.

## Rules

1. **You can only walk where you can see.** A tile under any window — another
   room, a title bar, the terminal — cannot be stepped on. Z-order is part of
   the puzzle. A window's title bar sits over the two rows above its room, so
   going down from one room into another needs the upper room in front.
2. **Rooms join only at their edges.** Leaving a room means stepping off the
   edge of its window onto the facing edge of another room's window. Overlap
   joins nothing: an early version let it, and every level could be skipped
   by dropping the exit room onto the start room.
3. **The window's edge is the room's edge.** A croppable room (dashed border)
   can be bigger than its window. Dragging any edge of its window cuts the
   room. Floor cut by the window's edge becomes an opening, and a wall cut
   away stops being in the way. Cutting never moves the room itself, only the
   window over it, and never cuts out the tile the player stands on.
4. **Rooms carry you.** The player's position is inside a room, so dragging
   the room you are standing in takes you with it. A room can be a bridge now
   and a ferry later.

## Tiles

| glyph | meaning |
|---|---|
| `#` and any other symbol | wall |
| `.` | floor |
| space | void — nothing there |
| `@` | start (floor) |
| `>` | the way out |
| `$` | a key; walking onto it picks it up |
| `%` | a door; walking onto it uses a key and opens it for good |
| `^` | a switch; stepping onto it fires what the level wires it to |
| `?` | a note; stepping onto it opens a text file |
| `+` | a gate, shut until a switch flips the gates |
| `=` | a gate, open until a switch flips the gates |

Every switch flips every gate, every time it is stepped on. A switch can also
release a locked room so it can be dragged and cut.

Art on a room uses symbols outside this table. The level tests fail if a key,
door, switch, note or gate appears somewhere the level does not mean one.

## Windows

- **movable** — drag it by its title bar.
- **locked** — cannot be moved, cut or closed, until a switch releases it.
- **pinned** — cannot be moved, but can be cut if croppable.
- **always on top** — drawn over every other window. Nothing enters one from
  above, since its title bar is always over the room above it.
- **popup** — jumps back in front every few seconds. Clicking a room brings it
  forward until the next jump.
- **blink** — minimizes itself for a moment on a cycle. It never vanishes with
  the player inside; it waits.
- **wander** — hops between set places on a cycle, taking whoever is inside
  along.
- **process** — has a pid. The terminal's `ps` lists it, with the pid hidden
  until a note has named it; `kill <pid>` then removes the window for the
  rest of the level.

Hostile windows move with the window manager's `RAISE` action, which brings a
window forward without taking keyboard focus. A popup that stole focus would
eat what the player was typing into the terminal.

## Chapters

1. **boot** — handshake, tuck, watchdog, ferry, relay. Edges, title bars and
   z-order, windows that will not move or go under anything, rooms that carry
   you, and never entering an always-on-top window from above.
2. **fragmentation** — crop, cut to size, keys, switch, fragmentation. Cutting
   walls away, cutting a room down to fit a gap, keys and doors, gates and
   switches, and a locked room released by a switch.
3. **hostile** — kill, blink, drift, popup, defrag. Notes and the terminal,
   windows that come and go, one that carries you on a schedule, popups, and
   a last level that uses everything.

Levels only lean on the top and left edges of the screen being where they
are. A bigger screen leaves more room to the right and below, and no level
can depend on that room not being there.

## Outside the game: the crash site

The game changes the desktop it is played on. The wreck in the crater on the
wallpaper is rebuilt as levels are finished (`src/lib/crash-site.ts`):

- every level finished sends one more person walking up from the right, up
  to six. They stay put between visits; only newcomers walk in, and never
  while a level's rooms are covering the screen;
- the wreck goes from burning, to looked at, dug out, patched, rebuilt
  around a new booster, and stood on a launch pad with a gantry. The fire
  dies down as they work, and steam comes off the tanks at the end;
- after the last level the ship is ready. Launching it, from the finish
  screen or by clicking it, counts down, lights, and climbs off the top of
  the screen, and the wallpaper follows it into space: planets, a drifting
  starfield, and ships and aliens crossing now and then. The ship idles out
  there and is the way to the starmap from then on;
- the level list, and Display Properties, can switch between the plains
  (an empty pad, the crew waving) and space. The level list can also start
  over: the wreck burns again and every level is locked.

Progress lives in `src/lib/defrag/progress.ts`, saved under the same key as
before, so a player partway through keeps their place.

## How the levels are kept honest

Every level carries a scripted solution: a sequence of drags, crops, raises,
walks, kills and hostile-window moves. `src/lib/defrag/simulate.ts` runs that
script against the real rules. `levels.test.ts` then proves, for every level:

- it can be finished;
- it is not finished before the player touches anything;
- no single first move finishes it, on the smallest supported screen or on a
  1920×1080 one;
- every window stays on a 1200×640 screen from start to finish;
- hostile windows in the script only do what their timers would, in order;
- every special tile is meant, and every process named in a note exists.

A few lesson tests check that each level's idea is the only way through: no
bridge in the ferry level, the pipe does not fit uncut, the pid cannot be
killed before it is found, and so on.
