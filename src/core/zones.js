// ---------------------------------------------------------------------------
// ZONE TITLES (owned by CORE). Announces the room you enter at top-centre —
// fade in, hold ~2 s, fade out. A per-frame detector finds the zone volume the
// player is in; on CHANGE it announces. This covers both walking between core
// sub-zones AND teleporting into a discrete area (you land in its volume, so it
// announces itself). Area modules add their volume via world.registerZone(...).
//
// Skipped in shot mode (keeps verification captures clean), before the player
// enters (prompt still up), and while reading.
// ---------------------------------------------------------------------------

// Core Great-Hall-cluster zones, most-specific first. 3D AABBs [min]..[max] so
// the crypt (below) and the Nordturm (above/west) disambiguate from the nave.
const CORE_ZONES = [
  { name: 'The Undercroft',   min: [-6, -7, -15], max: [6, -2.5, -2] },
  { name: 'The Nordturm',     min: [-11.5, -1, -21], max: [-6, 20, -14] },
  { name: 'The Side Chamber', min: [6, -1, -0.5], max: [13, 4, 8.5] },
  { name: 'The Chancel',      min: [-6, -1, -20.5], max: [6, 4, -15] },
  { name: 'The Great Hall',   min: [-6, -1, -15], max: [6, 4, 15.6] },
];

const inZone = (p, z) =>
  p.x >= z.min[0] && p.x <= z.max[0] &&
  p.y >= z.min[1] && p.y <= z.max[1] &&
  p.z >= z.min[2] && p.z <= z.max[2];

export function createZones(world) {
  const el = document.getElementById('zone');
  const promptEl = document.getElementById('prompt');

  world.zones = CORE_ZONES.slice();
  world.registerZone = (z) => { world.zones.push(z); return z; };

  let current = null;
  let hideT = 0;

  world.currentZone = null;   // live location for the map overlay (null = in transit)

  world.showZone = (name) => {
    if (!el) return;
    el.textContent = name;
    el.classList.add('on');
    hideT = world.elapsed + 2.0;   // hold 2 s, then the updater fades it out
  };

  world.updaters.push(() => {
    // fade-out when the hold elapses
    if (el && el.classList.contains('on') && world.elapsed >= hideT) el.classList.remove('on');

    // gates: not during shot captures, only once entered, not while reading
    if (world.flags.shotMode) return;
    if (!(promptEl && promptEl.classList.contains('hidden'))) return;
    if (world.flags.reading) return;

    const p = world.camera.position;
    let z = null;
    for (const zone of world.zones) { if (inZone(p, zone)) { z = zone; break; } }
    const name = z ? z.name : null;
    if (name && name !== current) { current = name; world.currentZone = name; world.showZone(name); }
    else if (name) { world.currentZone = name; }   // unchanged, keep live value fresh
    else { current = null; world.currentZone = null; }   // in transit (mid-teleport) — allow re-announce on arrival
  });
}
