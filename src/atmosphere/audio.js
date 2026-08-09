// ===========================================================================
// ATMOSPHERE — sound placement (world-bible mood: desolate dread, NO threat).
// Uses the curated Ocular library via world.audio (see core/audio.js).
// Deliberately avoids the library's breath/whisper/creature stingers — the
// bible forbids any sense of a present threat. Only tonal beds + a far toll.
//
// Ambient BEDS crossfade by elevation: above ground = cold hall drone + faint
// air; in the undercroft (camera.y < -3) = the underground drone. Plus an
// occasional distant bell. Portal transition SFX are exposed for the atlas's
// future portal system.
// ===========================================================================

export function initAudio(world) {
  const audio = world.audio;
  if (!audio) return;
  audio.setMaster(0.85);

  // Looping beds (non-positional). Created at 0; the crossfade below drives them.
  const hall = audio.bed('hallBed', { volume: 0 });
  const air = audio.bed('air', { volume: 0 });
  const crypt = audio.bed('cryptBed', { volume: 0 });

  // Target levels for each zone.
  const HALL = 0.34, AIR = 0.16, CRYPT = 0.52;
  let hv = 0, av = 0, cv = 0;

  // Elevation crossfade (~0.7 s). Below y=-3 is the undercroft.
  world.updaters.push((dt) => {
    if (!audio.unlocked) return;
    const below = world.camera.position.y < -3;
    const tHall = below ? 0 : HALL;
    const tAir = below ? 0 : AIR;
    const tCrypt = below ? CRYPT : 0;
    const k = 1 - Math.pow(0.5, dt / 0.7);
    hv += (tHall - hv) * k; hall.setVolume(hv);
    av += (tAir - av) * k; air.setVolume(av);
    cv += (tCrypt - cv) * k; crypt.setVolume(cv);
  });

  // A far, mournful toll every ~45–90 s (first one 30–60 s after unlock).
  let nextBell = Infinity;
  audio.onUnlock(() => { nextBell = world.elapsed + 30 + Math.random() * 30; });
  world.updaters.push(() => {
    if (!audio.unlocked || world.elapsed < nextBell) return;
    audio.play('bell', { volume: 0.30, rate: 0.85 + Math.random() * 0.08 });
    nextBell = world.elapsed + 45 + Math.random() * 45;
  });

  // Transition SFX for the atlas portal system (fade → load between areas).
  world.flags.sfxWhoosh = () => audio.play('whoosh', { volume: 0.55 });
  world.flags.sfxGate = () => audio.play('gate', { volume: 0.6 });
}
