import * as THREE from 'three';

// ---------------------------------------------------------------------------
// FIXED VERIFICATION CAMERAS  (owned by CORE — see scene-contract.md §6)
// Six canonical shots. The Playwright verification loop navigates to
//   http://127.0.0.1:5188/?shot=N   (N = 1..6)
// which freezes the camera at SHOTS[N-1] and disables controls, so every
// capture is deterministic. Coordinates are in metres; see the layout in
// scene-contract.md §4. If the layout moves, update BOTH files.
// ---------------------------------------------------------------------------

export const SHOTS = [
  // 1. Hero: stand just inside the entrance, look down the nave to the apse window.
  { name: '01_nave_from_entrance', pos: [0, 1.7, 14.5], look: [0, 3.2, -18] },
  // 2. Value test: off-axis in a side aisle, columns between camera and window light.
  { name: '02_aisle_midnave', pos: [-3.4, 1.6, 3], look: [-5.6, 2.4, -8] },
  // 3. Light motivation: the apse — big tracery window as the visible source.
  { name: '03_apse_window', pos: [0, 1.7, -8], look: [0, 5.5, -19.5] },
  // 4. Decay specificity: the side chamber — abandoned table + objects, candlelight.
  { name: '04_side_chamber_table', pos: [8.5, 1.6, 3.5], look: [11.5, 1.1, 1.5] },
  // 5. Silhouette: from the apse looking back at the daylit entrance doorway.
  { name: '05_entrance_from_apse', pos: [0, 1.7, -7], look: [0, 2.6, 18] },
  // 6. Scale + decay: low angle over fallen debris near a column base.
  { name: '06_fallen_debris', pos: [2.2, 1.15, -1], look: [-1.5, 0.4, -4] },

  // --- THE UNDERCROFT (crypt below; floor y=-6, footprint x[-5,5] z[-14,-3]) ---
  // 7. The descent: from the chancel stairhead looking down the flight.
  { name: '07_stair_descent', pos: [0, 2.0, -15.3], look: [0, -3.0, -10] },
  // 8. Ossuary + moonlight: across the crypt to an east bone-niche, grate shaft in frame.
  { name: '08_crypt_ossuary', pos: [-2.5, -4.3, -7], look: [3.5, -4.8, -6] },
  // 9. The sealed plague pit, looking north toward the cold grate shaft.
  { name: '09_plague_pit', pos: [0, -4.3, -11], look: [0, -5.6, -5.5] },

  // --- THE NORDTURM (north tower; centre (-8.5,-18.25), study floor y=13) ---
  // 10. The ascent: from the tower base looking up into the spiral.
  { name: '10_nord_ascent', pos: [-7.4, 1.6, -17.0], look: [-8.9, 8.0, -18.4] },
  // 11. Siegmund's study: the desk, the cold window, the body at the chair.
  { name: '11_nord_study', pos: [-7.6, 14.7, -17.2], look: [-9.6, 13.9, -19.4] },
  // 12. The keystone: close on the desk, the letter, the fallen pen.
  { name: '12_nord_desk', pos: [-8.5, 14.5, -18.2], look: [-9.5, 13.7, -19.3] },

  // --- THE ARRIVAL (exterior; overcast daylight; +Z = south toward the gate) ---
  // 13. Arrival: from the gatehouse, up the dead ward to the great hall façade.
  { name: '13_gate_arrival', pos: [0, 1.7, 54], look: [0, 3.5, 18] },
  // 14. The façade + great door, mid-ward.
  { name: '14_ward_facade', pos: [0, 1.7, 34], look: [0, 4.5, 16] },
  // 15. Looking back out over the ward to the gate from the great door.
  { name: '15_ward_from_door', pos: [0, 1.7, 17], look: [0, 3.5, 55] },
];

export function applyShot(camera, i) {
  const s = SHOTS[i];
  if (!s) return null;
  camera.position.set(s.pos[0], s.pos[1], s.pos[2]);
  camera.lookAt(new THREE.Vector3(s.look[0], s.look[1], s.look[2]));
  camera.updateMatrixWorld();
  return s;
}

/** Returns 0-based shot index from ?shot=N, or -1 if not in shot mode. */
export function shotFromURL() {
  const p = new URLSearchParams(location.search);
  if (!p.has('shot')) return -1;
  const n = parseInt(p.get('shot'), 10);
  return n >= 1 && n <= SHOTS.length ? n - 1 : -1;
}
