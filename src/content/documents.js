// ===========================================================================
// DOCUMENTS — discoverable readable leaves (world-bible §6 voices, §9 register,
// §11 timeline). Data only; interaction places a marker + registers each as a
// readable that opens world.reader. Register audited against §9: no rhetorical
// questions, no summary conclusions, no anachronism; the writer stops, not
// concludes. Ratio target ~4:1 mundane:emotional.
//
// pos = [x,y,z] world metres. rot optional [x,y,z] radians (default lies flat).
// pages = string (single leaf) or string[] (multi-leaf; turn with E/→).
// ===========================================================================

const FLAT = [-Math.PI / 2, 0, 0];

export const DOCUMENTS = [
  // --- PAYMENT I (months 1–3): works surrendered, explained away ---
  {
    id: 'marck-reliquary',
    type: 'Ledger', style: 'ledger', voice: 'Dietrich Marck, Chancellor',
    dateText: 'the Feast of St. Agatha',
    pos: [-2.6, 0.16, 6.0], rot: [-Math.PI / 2, 0, 0.35],
    prompt: 'A ledger leaf on the flags, close-written.',
    pages:
      'Rendered to the account, this day: one reliquary of St. Ursel, silver-gilt, ' +
      'weight four pound eleven ounce, the gift of Reinhold the Elder.\n\n' +
      'Valued to the second head. No receipt entered.\n\n' +
      'His Grace bids the matter rest there, and it rests there.',
  },

  // --- PAYMENT II/III (months 3–9): the guilds redirected, the makers struck ---
  {
    id: 'krieg-roll',
    type: 'Guild roll', style: 'roll', voice: 'Balthasar Krieg, Masons’ Guild',
    dateText: 'quarter-day after Michaelmas',
    pos: [3.1, 0.16, -2.0], rot: [-Math.PI / 2, 0, -0.2],
    prompt: 'A guild roll, the margin worn from handling.',
    pages:
      'Set to the east courses, and struck from the roll:\n\n' +
      '  Volkmar, hewer .......... struck\n' +
      '  Encke, hewer ............ struck\n' +
      '  Little Hans, prentice ... struck\n' +
      '  Reuss, setter ........... struck\n' +
      '  ( and seven more, each with a line drawn through, no cause set against any )\n\n' +
      'The east courses run to no plan I was taught. I set them as I am given them. ' +
      'My father would have put down his hammer and gone home.',
  },

  // --- PAYMENT IV (months 9–11): the purpose; Anselm breaks the seal ---
  {
    id: 'anselm-seal',
    type: 'Leaf', style: '', voice: 'Father Anselm Vogt, Confessor',
    dateText: 'the eve of St. Martin',
    pos: [1.6, 1.02, -16.4], rot: [-Math.PI / 2, 0, 0.15],
    prompt: 'A leaf left on the altar step, folded once.',
    pages:
      'I have broken the seal. God forgive me, I told her, and she wept and said she ' +
      'had known since Candlemas. We are neither of us in time.\n\n' +
      'He will not hear me now. He keeps the other one’s hours.',
  },

  // --- The burning things (residue) — Weinhold, near the fallen chandelier ---
  {
    id: 'weinhold-flame',
    type: 'Marginalia', style: '', voice: 'Jost Weinhold, Master of Works',
    dateText: 'in the margin of a work-book',
    pos: [1.9, 0.16, -2.8], rot: [-Math.PI / 2, 0, 0.5],
    prompt: 'A work-book, fallen open, a note down its margin.',
    pages:
      'The flame on the fallen ring keeps. I have watched it a glass and it does not ' +
      'take from the wax. It gives no heat to the hand.\n\n' +
      'I have set down many things this year that I did not understand. I will not set ' +
      'down this one.',
  },

  // --- Quarantine (month 12): the gate ---
  {
    id: 'lenhart-gate',
    type: 'Tally', style: 'tally', voice: 'Lenhart Vogel, gate sergeant',
    dateText: 'by the Marshal’s order',
    pos: [2.6, 0.16, 13.0], rot: [-Math.PI / 2, 0, -0.35],
    prompt: 'A tally-board propped by the door.',
    pages:
      'Marks for the gate, by the Marshal’s order.\n\n' +
      '  In  ....... none\n' +
      '  Out ....... none\n' +
      '  Turned at the wall this day ....... nine\n\n' +
      'One would not turn. I did as I was told. I will not set his name here.',
  },

  // --- The physician's register collapse (months 11–12) — MULTI-LEAF ---
  {
    id: 'bohn-weeping',
    type: 'Physician’s leaf', style: '', voice: 'Magister Cyriak Bohn, physician',
    dateText: 'St. Nicholas to St. Lucy',
    pos: [11.4, 0.82, 6.1], rot: [-Math.PI / 2, 0, 0.1],
    prompt: 'Two leaves in a physician’s hand, the second hurried.',
    pages: [
      'De aegritudine.\n\nThe swelling comes at the groin and the neck within the day. ' +
      'The fingers and toes blacken from the ends. In the last hours they weep at the ' +
      'nose and eyes.\n\nI have opened three and let the black blood by rule. None were ' +
      'bettered. I hold still that the cause is the bad air off the marsh.',

      'I was wrong. It is not the air.\n\nIt goes from bed to bed as a finger goes down ' +
      'a row. The strong and the shriven die the same as the rest.\n\nI have no physic ' +
      'for a thing that passes by the touch of a hand. Burn my books when I am done, ' +
      'that no one after me trust them.',
    ],
  },

  // --- The answer, in the crypt (month 12) ---
  {
    id: 'klara-consign',
    type: 'Consignment', style: 'tally', voice: 'Sister Klara, infirmarian',
    dateText: 'the week before St. Lucy',
    pos: [3.9, -5.28, -6.6], rot: [-Math.PI / 2, 0, -0.25],
    prompt: 'A consignment slate, chalked and re-chalked.',
    pages:
      'Consigned to the vault this week: forty and one. Shrouded where cloth held out.\n\n' +
      'The lime is short. The sexton says we lay them without, after Thursday.\n\n' +
      'I have stopped setting the names. There is no more slate to wipe.',
  },

  // --- The household leaving mid-service (month 13) — Grete ---
  {
    id: 'grete-bread',
    type: 'Chalk', style: 'chalk', voice: 'Grete Ilmer, scullion',
    dateText: '—',
    pos: [8.9, 1.35, 7.7], rot: [0, -Math.PI / 2, 0],
    prompt: 'A few lines in chalk, low on the plaster.',
    pages:
      'Master Ochs did not come for his bread again. Three days. I will not keep it ' +
      'back a fourth.\n\nThe little one in the north room has gone quiet, which is ' +
      'worse than the crying.',
  },

  // --- THE KEYSTONE (Nordturm study; world-bible §5.5 / §4). Under the corpse's
  // hand. Ties the crypt's red shoe, the breach, and the burning light. Ends mid-word. ---
  {
    id: 'keystone-letter',
    type: 'Letter', style: '', voice: '', dateText: 'the last leaf, unfinished',
    pos: [-9.42, 13.77, -19.17], rot: [-Math.PI / 2, 0, 0.2], radius: 1.9,
    prompt: 'A letter under the dead man’s hand — three leaves, the last broken off.',
    pages: [
      'Adelheid.\n\nThe ink is poor and my hand is worse, so I will set it plain, the ' +
      'way you always asked me to set things.\n\nI bought them a wall, and they died ' +
      'behind it. That is the whole of it. I have sent the last of the household down ' +
      'and told them to keep off the north stair, so I might write this without their ' +
      'faces at the door.',

      'I read what I signed. I want you to believe that above all else. I read every ' +
      'clause by candle and I thought I had read it well.\n\nWhen the sickness came ' +
      'inside the walls I went back and asked to have it lifted, and that was the wrong ' +
      'door. The first paper forbade my going to any other. I had forgotten the first ' +
      'paper, the way a man forgets the footing of a house he has lived in all his ' +
      'life.\n\nSo the walls that held stopped holding, this last month, and it was my ' +
      'hand that opened them. Not the sickness. Mine. I did it trying to spare you.',

      'Kunigunde first. Then the boy. Then the little one, who would not be parted from ' +
      'her red shoes, so we let her keep them.\n\nI have not gone down to them. I cannot ' +
      'set that here either.\n\nCome up when you are able. The stair is long and I have ' +
      'left a light burning. I do not ask you to forgive what I signed. I ask only that ' +
      'you believe I —',
    ],
  },
];
