// ===========================================================================
// ATMOSPHERE — CONTEXTUAL SOUND. A zone-driven ambience mixer over the curated
// Envato/Ocular library (via world.audio). Each room gets its own bed mix; as
// the player moves between zones (world.currentZone, set by core/zones.js) the
// beds crossfade. The bible's rule holds — desolate DREAD, no present threat —
// so the "voices"/"devil's presence" beds are used as the residue of what
// happened here (the diabolical works, the sealed places), never as a stinger.
//
//   rain/wind        outdoors (ward, gate, cloister, hortus, harbour, court)
//   dock             the harbour (water + timber)
//   hallgods         the nave / chancel / chapel (vast sacred reverb)
//   cryptRumble/bed  the undercroft
//   whispers         crypt, ordinal, sounding court, bridal hall, galleries…
//   devils           the diabolical works (tithe house, ordinal)
//   fire (positional) the lighthouse brazier — the one warm sound
//   crow (one-shot)  outdoors, now and then
//   bell (one-shot)  a far mournful toll
// ===========================================================================

// Per-zone target volumes for each looping bed. Missing bed → fades to 0.
const AMB = {
  'The Great Hall':      { hallgods: 0.42, hallBed: 0.16, wind: 0.10, rain: 0.08 },
  'The Chancel':         { hallgods: 0.46, hallBed: 0.16 },
  'The Side Chamber':    { hallBed: 0.18, wind: 0.06 },
  'The Undercroft':      { cryptRumble: 0.50, cryptBed: 0.32, whispers: 0.26 },
  'The Nordturm':        { wind: 0.52, whispers: 0.16, hallBed: 0.10 },
  'The Inner Ward':      { rain: 0.55, wind: 0.50 },
  'The Gatehouse':       { rain: 0.42, wind: 0.60 },
  'The Cloister':        { rain: 0.50, wind: 0.40, whispers: 0.16 },
  'The Hortus Clausus':  { rain: 0.46, wind: 0.34 },
  'The Harbour':         { dock: 0.50, rain: 0.42, wind: 0.60 },
  'The Sounding Court':  { whispers: 0.55, rain: 0.32, wind: 0.40 },
  'The Tithe House':     { devils: 0.48, whispers: 0.18 },
  'The Ordinal':         { devils: 0.55, whispers: 0.34, cryptRumble: 0.20 },
  'The Bridal Hall':     { whispers: 0.44, wind: 0.10, hallBed: 0.12 },
  'The Long Gallery':    { whispers: 0.30, hallgods: 0.12 },
  'The Library':         { whispers: 0.16, hallBed: 0.10 },
  'The Infirmary':       { whispers: 0.24, air: 0.12 },
  'The Keep':            { wind: 0.26, whispers: 0.16, hallBed: 0.12 },
  "St. Ursel's Chapel":  { hallgods: 0.40, whispers: 0.12 },
};

const OUTDOOR = new Set(['The Inner Ward', 'The Gatehouse', 'The Cloister', 'The Hortus Clausus', 'The Harbour']);

// Every bed the mixer manages (roles in core/audio.js MANIFEST).
const BEDS = ['hallBed', 'air', 'cryptBed', 'hallgods', 'cryptRumble', 'rain', 'wind', 'whispers', 'devils', 'dock'];

export function initAudio(world) {
  const audio = world.audio;
  if (!audio) return;
  audio.setMaster(0.85);

  // Create every bed at 0; the per-frame crossfade drives them.
  const bed = {}, vol = {};
  for (const r of BEDS) { bed[r] = audio.bed(r, { volume: 0 }); vol[r] = 0; }

  // The lighthouse brazier — the one warm sound, positional at the lantern so it
  // swells as you climb the Brandturm and fades on the mole below.
  audio.positional('fire', { pos: [320, 18, 0], volume: 0.9, refDistance: 6, rolloff: 1.8, loop: true });

  // ---- Zone crossfade (~0.8 s). world.currentZone is set by core/zones.js. ----
  world.updaters.push((dt) => {
    if (!audio.unlocked) return;
    const targets = AMB[world.currentZone] || null;   // null in transit → fade all out
    const k = 1 - Math.pow(0.5, dt / 0.8);
    for (const r of BEDS) {
      const t = (targets && targets[r]) || 0;
      vol[r] += (t - vol[r]) * k;
      bed[r].setVolume(vol[r]);
    }
  });

  // ---- A crow's caw, now and then, only while outdoors. ----
  let nextCrow = Infinity;
  audio.onUnlock(() => { nextCrow = world.elapsed + 8 + Math.random() * 12; });
  world.updaters.push(() => {
    if (!audio.unlocked || world.elapsed < nextCrow) return;
    if (OUTDOOR.has(world.currentZone)) {
      audio.play('crow', { volume: 0.32 + Math.random() * 0.12, rate: 0.9 + Math.random() * 0.2 });
    }
    nextCrow = world.elapsed + 16 + Math.random() * 26;
  });

  // ---- A far, mournful toll every ~45–90 s (first 30–60 s after unlock). ----
  let nextBell = Infinity;
  audio.onUnlock(() => { nextBell = world.elapsed + 30 + Math.random() * 30; });
  world.updaters.push(() => {
    if (!audio.unlocked || world.elapsed < nextBell) return;
    audio.play('bell', { volume: 0.28, rate: 0.85 + Math.random() * 0.08 });
    nextBell = world.elapsed + 45 + Math.random() * 45;
  });

  // Transition SFX for the portal system (fade → load between areas).
  world.flags.sfxWhoosh = () => audio.play('whoosh', { volume: 0.55 });
  world.flags.sfxGate = () => audio.play('gate', { volume: 0.6 });
}
