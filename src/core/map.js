// ---------------------------------------------------------------------------
// AUTOMAP OVERLAY (owned by CORE). A DOOM-style semi-transparent map toggled
// with the M key. The game keeps running underneath — this NEVER pauses and
// NEVER blocks input; it is plain DOM/SVG, no Three.js.
//
// The castle's areas are discrete "islands" reached by fade-portals, so this is
// not a to-scale blueprint but a stylised node graph: labelled boxes joined by
// thin lines. It reveals nodes automap-style as the player visits them. The node
// the player is in is highlighted; the rooms they can leave to (direct, not-yet-
// visited neighbours) are marked as available EXITS; everything else stays a
// faint "?" placeholder until connected.
//
// Reads the live location from world.currentZone (set by core/zones.js). No
// randomness / Date.now() — everything is static layout + monotonic state.
// ---------------------------------------------------------------------------

// Abstract map units (y grows downward, matching SVG): the arrival runs south→
// north up the spine (Gatehouse bottom → Chancel top), the Side Chamber hangs
// east of the Great Hall with its four island-rooms fanned off it, the Nordturm
// up-left of the Chancel and the Undercroft a level down from it.
const NODES = {
  'The Gatehouse':    { x: 0,    y: 6   },
  'The Inner Ward':   { x: 0,    y: 4.5 },
  'The Great Hall':   { x: 0,    y: 3   },
  'The Chancel':      { x: 0,    y: 1.5 },
  'The Nordturm':     { x: -1.5, y: 0.6 },
  'The Undercroft':   { x: 0.9,  y: 0.4 },
  'The Side Chamber': { x: 2,    y: 3   },
  'The Tithe House':  { x: 4,    y: 1.6 },
  'The Library':      { x: 4,    y: 2.7 },
  'The Infirmary':    { x: 4,    y: 3.8 },
  'The Cloister':     { x: 4,    y: 4.9 },
  // Newer wings — fanned west off the Inner Ward (the courtyard hub).
  'The Long Gallery':    { x: -2.5, y: 3.4 },
  'The Hortus Clausus':  { x: -2.5, y: 4.2 },
  'The Keep':            { x: -2.5, y: 5.0 },
  "St. Ursel's Chapel":  { x: -2.5, y: 5.8 },
};

const EDGES = [
  ['The Gatehouse',   'The Inner Ward'],
  ['The Inner Ward',  'The Great Hall'],
  ['The Great Hall',  'The Chancel'],
  ['The Great Hall',  'The Side Chamber'],
  ['The Chancel',     'The Undercroft'],   // a level down — drawn dashed (see LEVEL)
  ['The Chancel',     'The Nordturm'],
  ['The Side Chamber','The Tithe House'],
  ['The Side Chamber','The Library'],
  ['The Side Chamber','The Infirmary'],
  ['The Side Chamber','The Cloister'],
  ['The Inner Ward',  'The Keep'],
  ['The Inner Ward',  "St. Ursel's Chapel"],
  ['The Inner Ward',  'The Long Gallery'],
  ['The Inner Ward',  'The Hortus Clausus'],
];

// Edges that cross a floor level — rendered dashed with a ↓ hint on the node.
const LEVEL = new Set(['The Chancel|The Undercroft']);

const START = 'The Gatehouse';   // the scout arrives at the gate — seed it visible

const NODE_W = 1.7;
const NODE_H = 0.46;
const VIEWBOX = '-4.3 -0.1 9.6 6.8';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function createMap(world) {
  const root = document.getElementById('map');
  if (!root) return;

  // adjacency (undirected)
  const adj = {};
  for (const n in NODES) adj[n] = [];
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }

  const visited = new Set([START]);   // automap reveal set; seeded with the spawn node
  let current = START;                // last known live location (kept while in transit)
  let open = false;
  let lastKey = '';

  // ---- M toggles the overlay (guard: not while reading, ignore auto-repeat) ----
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || e.repeat) return;
    if (world.flags && world.flags.reading) return;
    open = !open;
    root.classList.toggle('on', open);
    if (open) { lastKey = ''; render(); }
  });

  // ---- Per-frame: track the live zone, grow the visited set, re-render on change ----
  world.updaters.push(() => {
    const cz = world.currentZone;
    if (cz && (cz in NODES)) {
      if (!visited.has(cz)) visited.add(cz);
      current = cz;                   // null (in transit) leaves the last room highlighted
    }
    if (!open) return;
    const key = current + '#' + visited.size;
    if (key !== lastKey) render();
  });

  function render() {
    const cur = current;

    // available exits: direct neighbours of the current node not yet visited
    const exits = new Set();
    for (const nb of adj[cur]) if (!visited.has(nb)) exits.add(nb);

    const revealed = (n) => n === cur || visited.has(n) || exits.has(n);
    const stateOf = (n) =>
      n === cur ? 'current' :
      exits.has(n) ? 'exit' :
      visited.has(n) ? 'visited' : 'unknown';

    // edges — only between revealed endpoints; emphasise those to available exits
    let edgeSvg = '';
    for (const [a, b] of EDGES) {
      if (!revealed(a) || !revealed(b)) continue;
      const pa = NODES[a], pb = NODES[b];
      const isExit = (a === cur && exits.has(b)) || (b === cur && exits.has(a));
      const isLevel = LEVEL.has(a + '|' + b) || LEVEL.has(b + '|' + a);
      const cls = 'edge' + (isExit ? ' exit' : '') + (isLevel ? ' level' : '');
      edgeSvg += `<line class="${cls}" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"/>`;
    }

    // nodes — labelled pills; unknown nodes stay a faint "?" placeholder
    let nodeSvg = '';
    for (const n in NODES) {
      const p = NODES[n];
      const st = stateOf(n);
      const label = st === 'unknown' ? '?' : n;
      const x = p.x - NODE_W / 2, y = p.y - NODE_H / 2;
      nodeSvg += `<g class="node ${st}">`;
      nodeSvg += `<rect class="nbox" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="0.06"/>`;
      nodeSvg += `<text class="nlabel" x="${p.x}" y="${p.y + 0.02}">${esc(label)}</text>`;
      if (st === 'exit') nodeSvg += `<text class="tick" x="${x + 0.14}" y="${p.y + 0.02}">‹</text>`;
      // the Undercroft is a floor below — flag the level change
      if (n === 'The Undercroft' && st !== 'unknown')
        nodeSvg += `<text class="tick" x="${x + NODE_W - 0.14}" y="${p.y + 0.02}">↓</text>`;
      nodeSvg += `</g>`;
    }

    root.innerHTML =
      '<div class="frame">' +
        `<svg viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg>` +
        '<div class="head">' +
          `<span>Map — <span class="cur">${esc(cur)}</span></span>` +
          '<span class="hint">[M] close</span>' +
        '</div>' +
      '</div>';

    lastKey = cur + '#' + visited.size;
  }
}
