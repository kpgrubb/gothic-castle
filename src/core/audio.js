import * as THREE from 'three';

// ---------------------------------------------------------------------------
// AUDIO ENGINE (owned by CORE). Loads the curated Ocular sound files (already
// PS1-crunched: 11 kHz / 8-bit / mono / ogg) and plays them through a
// THREE.AudioListener on the camera. Footsteps have no library equivalent, so
// they stay synthesized here.
//
// MANIFEST maps a ROLE -> file. Reassign freely — the rest of the app only ever
// references roles, never filenames. Drop any Ocular .ogg into public/audio and
// point a role at it.
//
// API: unlock() · onUnlock(fn) · onReady(fn) · setMaster(v) ·
//      bed(role,{volume}) -> looping THREE.Audio (setVolume to crossfade) ·
//      play(role,{volume,rate}) -> one-shot · footstep({wet,rate,volume})
// ---------------------------------------------------------------------------

const MANIFEST = {
  hallBed:  'audio/hall-bed.ogg',   // sustained cold drone — above ground (great hall)
  cryptBed: 'audio/crypt-bed.ogg',  // deeper underground drone — the undercroft
  air:      'audio/air.ogg',        // thin cold air at the windows (a wind substitute)
  bell:     'audio/bell.ogg',       // distant resonant toll (one-shot)
  whoosh:   'audio/whoosh.ogg',     // portal transition (one-shot) — for the atlas portals
  gate:     'audio/gate.ogg',       // door / gate close (one-shot) — future
};

export function createAudio(world) {
  const listener = new THREE.AudioListener();
  world.camera.add(listener);
  const ctx = listener.context;

  let unlocked = false;
  let ready = false;
  const unlockCbs = [];
  const readyCbs = [];
  const buffers = {};                    // role -> AudioBuffer

  // --- load the manifest ---
  const loader = new THREE.AudioLoader();
  const roles = Object.keys(MANIFEST);
  let done = 0;
  const tick = () => { if (++done >= roles.length) { ready = true; for (const cb of readyCbs.splice(0)) safe(cb); } };
  for (const role of roles) {
    loader.load(MANIFEST[role], (buf) => { buffers[role] = buf; tick(); },
      undefined, (e) => { console.warn('[audio] load failed:', MANIFEST[role], e); tick(); });
  }
  const onReady = (fn) => { ready ? fn() : readyCbs.push(fn); };

  // --- footstep buffers (synthesized; no library equivalent) ---
  function footBuf(seconds, dark) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, dark ? 2.6 : 3.2);
      const n = Math.random() * 2 - 1;
      lp = lp * (dark ? 0.78 : 0.6) + n * (dark ? 0.22 : 0.4);
      d[i] = (lp * 0.7 + n * 0.12) * env;
    }
    return b;
  }
  const footStone = footBuf(0.16, false);
  const footWet = footBuf(0.22, true);
  let footNode = null;

  // --- looping ambient beds (non-positional) ---
  const beds = {};
  function bed(role, { volume = 0.5 } = {}) {
    if (beds[role]) return beds[role];
    const a = new THREE.Audio(listener);
    a.setLoop(true);
    a.setVolume(volume);
    beds[role] = a;
    onReady(() => {
      if (!buffers[role]) return;
      a.setBuffer(buffers[role]);
      if (unlocked && !a.isPlaying) safe(() => a.play());
    });
    return a;
  }

  // --- one-shots (non-positional; small reusable pool per role) ---
  const pool = {};
  function play(role, { volume = 1, rate = 1 } = {}) {
    if (!unlocked || !buffers[role]) return null;
    let a = pool[role];
    if (!a) { a = new THREE.Audio(listener); a.setBuffer(buffers[role]); pool[role] = a; }
    a.setVolume(volume);
    if (a.setPlaybackRate) a.setPlaybackRate(rate);
    if (a.isPlaying) a.stop();
    safe(() => a.play());
    return a;
  }

  function footstep({ wet = false, rate = 1, volume = 0.4 } = {}) {
    if (!unlocked) return;
    if (!footNode) footNode = new THREE.Audio(listener);
    footNode.setBuffer(wet ? footWet : footStone);
    footNode.setVolume(volume);
    if (footNode.setPlaybackRate) footNode.setPlaybackRate(rate);
    if (footNode.isPlaying) footNode.stop();
    safe(() => footNode.play());
  }

  function safe(fn) { try { fn(); } catch (_) {} }

  return {
    ctx, listener,
    get unlocked() { return unlocked; },
    get ready() { return ready; },
    onReady,
    onUnlock(fn) { unlocked ? fn() : unlockCbs.push(fn); },
    setMaster(v) { listener.setMasterVolume(v); },
    bed, play, footstep,
    /** Resume the context on a user gesture and start any queued beds. Optimistic. */
    unlock() {
      if (unlocked) return;
      try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
      unlocked = true;
      for (const role in beds) { const a = beds[role]; if (a.buffer && !a.isPlaying) safe(() => a.play()); }
      for (const cb of unlockCbs.splice(0)) safe(cb);
    },
  };
}
