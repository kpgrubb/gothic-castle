# Plague's End — World Bible

> **Authority.** This file is the source of truth for all narrative, naming, prop,
> and text content in the project. Where this file and a build agent's instinct
> disagree, this file wins. Where this file is silent, ask before inventing.
>
> Companion specs: `scene-contract.md` (module contract), `art-direction.md`
> (visual rules). This file governs *meaning*; those govern *form*. Nothing here
> overrides the PS1 spec or the palette rules.

---

## 0. The one-paragraph version

Hochmauer is the seat of House Aldenbrandt, a dynasty of builders who ruled the
coastal Landgraviate of Wendelmark for two hundred years and measured their worth
in what they raised: walls, moles, quays, vaults, a lighthouse. Fourteen months
ago the last of them, King Siegmund III, believing his realm about to be carved up
by envious neighbours, entered into covenant with a devil. He paid in the only
coin his house had ever minted — craft. First its products, then its labour, then
its makers, then its purpose.

The account proved valuable, and other princes of the infernal courts came to
compete for it. Each demanded its own instruments, its own workings, its own
structures raised to its own specification. Within a year Hochmauer held a dozen
contending jurisdictions of hell, each asserting order over the same ground —
which is to say that Siegmund's masons, working from plans they did not
understand, had built a fortified infernal position on the mortal coast. In a war
that has run since the fall, a fortification invites a siege. The demons came for
it, and the weapon they used was pestilence. Everyone in Hochmauer is dead. The
player is a scout from a rival march, sent to find out why the harbour has gone
quiet, walking through the answer and understanding it in fragments.

---

## 1. Imperatives (read before writing a single line)

1. **Everything has already happened.** There is no threat, no chase, no enemy, no
   fail state. The horror is comprehension. The player is never in danger and must
   never be made to feel hunted.
2. **The castle is empty.** No survivors, no ghosts that act, no figures glimpsed.
   Gulls, rats, crows, flies. Nothing else moves that a scout could report.
3. **Siegmund must end pitiable.** Every document, every room, every ruin should
   compound toward a man who was not cruel and not vain, who loved his house and
   his people, and who was outmatched. A player who finishes hating him is a
   failure of authorship.
4. **Craft is the spine.** This is a story about makers. The tragedy is that the
   thing the dynasty was *for* became the thing that destroyed it. Every diabolical
   site should read as a masterwork put to an unspeakable use — never as shoddy
   occultism.
5. **Nonlinear and emergent.** No puzzles, no gates, no required order. Any single
   document should reward a player who finds only that one. The whole should
   reward a player who finds thirty.
6. **Period register.** See §9. Anachronism breaks this project faster than any
   texture flaw.
7. **Restraint.** The strongest beats are the quietest. A tally of the dead in a
   steward's clean hand outperforms any amount of blood on a wall.
8. **This file is a seed, not a boundary.** What is written here is canon. What is
   not written here is *unwritten*, not absent. Hochmauer is enormous and this
   document describes a fraction of it. Agents are expected to invent rooms,
   works, voices, documents, and wings — see §13 for the generative rules that
   keep invention in canon. An agent who treats this file as an exhaustive
   inventory has misread it.

---

## 2. Place and polity

**The Landgraviate of Wendelmark** — a coastal principality of the Empire, north
Germanic in character, wealthy from harbour tolls, stone, and the wool staple.
Not large. Its importance is disproportionate to its size because it holds a deep
bay on a shallow coast, which is precisely why its neighbours want it.

**Hochmauer** — the seat. "High wall." A castle that grew by accretion over two
centuries, each generation adding, so that its fabric is a legible stratigraphy of
the house's ambitions. It descends from the headland to the water; the lower works
are harbour works.

**Neighbours and rivals** (for correspondence and the scout's framing):
- The **March of Falkenrieth**, east — the scout's master. Margrave **Otto von
  Falkenrieth**. Covetous but not villainous; wanted the bay, would have taken it
  by marriage or by law before he took it by war.
- The **Duchy of Sarnthal**, south — larger, slower, hungrier.
- The **Free City of Immel**, up the coast — commercial rival, the staple's enemy.
- The **Prince-Bishopric of Gerau** — ecclesiastical, and the authority Siegmund
  most feared learning of his covenant.

**Nearby, named, usable:**
- **Neder Hochmauer** — the town below the castle. Future build scope. Assume it
  exists and is equally dead; documents may reference its streets (Salt Row, the
  Tanners' Steps, Mariengasse, the Bone Field outside the wall).
- **The Brandturm** — the lighthouse on the far mole, built by Albrecht II. Its
  brazier is still lit. See §7.
- **St. Ursel's** — the castle chapel. Ursel is our invented local martyr; see §6.

---

## 3. House Aldenbrandt — the builder lineage

The dynasty's motto, cut over the great hall door and repeated on seals and
maker's marks throughout: **WIR SETZEN STEIN** — *we set stone*. Use it. It should
appear early, read as pride, and by the end read as an epitaph.

Each generation is legible in the fabric. Build agents should be able to place any
room in this sequence and the player should be able to feel the century change.

| Gen | Name | Reign | What they raised | How it reads |
|---|---|---|---|---|
| 1 | **Otwin I, the Founder** | c. 200 yr past | The curtain wall, the keep, the first chapel | Crude, thick, defensive. Small windows. Rubble core. |
| 2 | **Reinhold the Elder** | | The Great Hall, the nave, the column rows | Ambition arrives. Height, ceremony, the cruciform plan. |
| 3 | **Mechthild the Regent** | | The mole, the quays, the harbour stair | Engineering, not display. Ruled 19 years for a minor heir and out-built every man of her line. |
| 4 | **Albrecht II** | | The Brandturm, the guild quarter, the workshops | Outward-facing, mercantile. The house turns to trade. |
| 5 | **Konrad the Patient** | | The vaults, the undercroft granary, the water works | Invisible works. Everything that keeps a castle alive. Loved by no chronicler. |
| 6 | **Dietrich IV and Gisela** | | The gardens, the long gallery, the library, **the Hortus Clausus** | The refined generation. Beauty for its own sake, and one enclosure nobody could account for. |
| 7 | **Siegmund III** | last 11 yrs | *see §4* | — |

### 3.1 The Dowager Gisela

Siegmund's mother. Born **Gisella di Ravello**, of a merchant house on the southern
sea, married north at nineteen as the settlement of a wool contract. She Germanised
her name within a year and never quite lost the accent. She brought a library, a
physician of her own, three chests of cuttings, and the manners of a court where
poisoning was a recognised branch of statecraft rather than a scandal.

She is not a villain and did not cause any of this. She is a strangeness at the
root of the family that the game never resolves. She built the library that
Abbess Walburga later borrowed from — and one of the books Walburga borrowed is
how the Abbess came to recognise a devil's seal on sight. **Never connect these
two facts in any document.** Let the player.

She died nine years before the covenant. Siegmund named his eldest daughter for
his grandmother, not for his mother, which is itself a fact worth one line
somewhere.

**The Hortus Clausus — the poison garden.** See §7.4.

**Canon note for existing geometry.** The undercroft was built by Konrad as a
**granary**, not a crypt. Its piers, its dryness, its grate. It was emptied and
consecrated as a plague crypt in the fourth month. The lime-pit is a grain bin.
Some agent should put a worn grain-tally cut into a pier, still legible under the
bone dust. That single detail carries the whole thesis of this section.

---

## 4. Siegmund III

Fifth decade. Not a soldier. Trained as his forebears were trained — he could read
a plan, judge a course of stone, and price a shipment of Baltic oak. Chroniclers
before the covenant call him *der Bauherr*, the patron, and mean it warmly.

**Family:**
- **Queen Adelheid**, of the house of Kirchmar. Pious, sharper than her husband,
  the first in the castle to understand what was being done and the last to be
  told. Her letters are the emotional centre of the document set.
- **Kunigunde**, daughter, seventeen. Betrothed to a son of Sarnthal — the marriage
  that would have cost Wendelmark the bay, and the pressure that started all this.
- **Otwin**, heir, eleven. Named for the founder. Kept a book of his own drawings
  of the works. The book survives. It should devastate.
- **Mechthild**, daughter, six. Named for the Regent. **The child's shoe on the
  undercroft steps is hers.** Do not state this outright anywhere. Let one
  document mention that she would not be parted from a pair of red shoes, and let
  the player do the rest.

**His motive, stated plainly so no agent softens it into ambition:** Sarnthal and
Falkenrieth both moved on the bay in the same season. The Emperor was distant and
uninterested. Siegmund saw two hundred years of his family's work about to become
someone else's toll house, and he could not bear to be the Aldenbrandt who set no
stone but lost all of it. He was not seeking power. He was seeking to not be the
last one.

**His end.** He is at the desk at the top of the **Nordturm**, the north tower,
mid-letter. The letter is to Adelheid, who was already dead when he began it. He
does not know that, or he does and writes anyway. He died of the plague like
everyone else — no special damnation, no spectacle, no body twisted into anything.
An ordinary corpse at a desk, pen fallen, ink dried in the well. **The player
should reach him last, and the room should be quiet, and there should be nothing
in it to fight or solve.** The final act available is to read.

---

## 5. The covenant

### 5.1 The two orders

We take the Catholic frame, not a game-system frame. Do not use the word "demon"
and "devil" interchangeably in any player-facing text — the distinction is the
plot.

- **The devils.** The fallen orders that retained hierarchy, rank, and law. They
  contract. They keep their word to the letter and ruin you inside it. They are
  approached through instrument, seal, witness, and consideration. Their sin is
  pride and their instrument is jurisprudence.
- **The demons.** The ungoverned. Pestilence, swarm, appetite, ruin. They do not
  bargain because they do not recognise the standing of the party. They are
  offended by contract, because a contract is a claim of order over territory they
  regard as theirs.

The two are at war and have been since the fall. **Siegmund did not know he was
walking into someone else's war.** He thought he was making a deal. He was
choosing a side in a conflict that predates the world, and the other side answered.

### 5.2 Named infernals (use these, spelled these ways)

Drawn from scripture and the demonologies. Never invent a new arch-devil; the
authority of the real names is the point.

**The contending princes.** Treat these as rival houses competing for a lucrative
account, with all the courtesy, sabotage, and legalism that implies. None of them
ever appears to the player. They exist as seals, hands, specifications, and the
things they made Siegmund build.

- **BELIAL** — the principal, and the first. Scripture's *worthlessness*. Appears
  fair, speaks well, is a liar under oath, and can be compelled by no court. He
  came when Siegmund called and he came pleasantly. The original instrument is
  sealed to him, and every later contract is, in law, an encroachment on his
  paper. His arc is the arc of an incumbent losing control of a client.
- **MAMMON** — the assessor. Brought in under Belial's instrument to value the
  payments in craft, and began within three months to want the account entire.
  Every tithe document is denominated to his head. He is the one who first
  suggested that a maker might be valued the same way a made thing is.
- **ASTAROTH** — the rival. A great duke, treasurer of hell, teacher of the
  liberal sciences. Approached Siegmund directly in month five with better terms —
  which is the sole reason Siegmund believed himself to have leverage. Astaroth's
  interest is the works themselves; his specifications are the most elegant and
  the most incomprehensible. The Ordinal is his.
- **FOCALOR** — the maritime clauses, subcontracted from Belial and resentful of
  it. A drowner of men and overturner of ships, therefore the one bound to keep
  Sarnthal's fleet off the bay. **His clauses worked.** The wrecks in the bay are
  not Wendelmark's. That should land hard when the player reaches the water. He
  took his fee below the tide line.
- **BAEL** — the first king of the infernal hierarchy, who does not negotiate and
  does not appear, but whose jurisdiction was cited against Astaroth's in month
  eight. His name occurs once, in a Latin fragment, in a hand not Weinhold's.
- **ASMODEUS** — destroyer of marriages. Bought a narrow and vicious clause from
  Mammon that has no bearing on the realm's defence and every bearing on
  Adelheid. This is a quiet subplot: the collapse of a marriage under a
  supernatural pressure that neither party can name. Never say so outright.

**The answer.**

- **BEELZEBUB** — Lord of the Flies. The demonic response, and the plague is his.
  Not named in early documents; appears first as a marginal scrawl by a dying man,
  then everywhere.
- **ABADDON / APOLLYON** — the destroyer of the Apocalypse. Invoked by Father
  Anselm in his last writings as the thing he believes is coming next. He is wrong,
  or he is early. Leave it unresolved.

**Lesser working spirits** may be named from the goetic lists for work orders,
foundation deposits, and keystones — **Gusion, Furfur, Vassago, Ronové, Andromalius,
Marchosias, Buer, Sabnock, Haagenti, Zepar**. These appear as *specifications*, not
characters: a name cut into a keystone the way a mason cuts his mark. Agents may
draw further names from the goetic and scriptural lists as needed. **Never invent
an infernal name.** The authority of the real ones is the point.

### 5.3 The escalation — the four payments

This is the structure that all discoverable content should map onto. Every
document, every room, every corpse belongs to a phase. Agents should be able to
say which phase a prop is from.

**Payment I — the works.** Months 1–3. Objects of craft surrendered and unmade.
The silver reliquary of St. Ursel, melted. The great astronomical clock of the
gallery, dismantled and its parts carried out. The library's illuminated psalter.
Beautiful things that go missing and are explained away as sold to fund the
levies. *The court is supportive. Nobody knows anything.*

**Payment II — the labour.** Months 3–6. The guilds are put to work on plans not
their own. Masons build what they are given and are told not to ask. Wages double,
then triple. **The first grumbling is professional, not moral** — a stonecutter's
objection to a course that violates his craft, not his conscience. This is a
crucial register and agents should get it right: these men were offended as
*makers* before they were frightened as *Christians*.

**Payment III — the makers.** Months 6–9. Named craftsmen go to the works and do
not come back. The official account is accident and fever. The guild rolls have
lines struck through. **Balthasar Krieg's roll survives with eleven names struck
and no cause entered against any of them**, and that document alone should turn a
player's stomach.

**Payment IV — the purpose.** Months 9–11. The house begins to build things that
serve nothing human. See §7. This is when Adelheid confronts him. This is when
Father Anselm stops taking his confession. This is when the first case of the
Black Weeping appears in the harbour quarter.

**The answer.** Months 11–14. See §8.

### 5.4 The bidding war, and how a castle became a fortress in someone else's war

This is the mechanism. Every agent must understand it, and no document may state
it.

Siegmund's account was valuable beyond his understanding: a builder-king with two
centuries of accumulated craft to mortgage, a hereditary workforce of the finest
masons on the coast, and a deep-water harbour. Belial's competitors noticed. From
month five onward the princes of the infernal courts contended for him — better
terms, then better terms again, then jurisdictional claims filed against one
another over the same ground.

Siegmund believed this was leverage, and for a season it was. He got his defences
cheaper. **He wrote to Marck, in month six, that he had learned to make them
bid against one another.** That letter should be discoverable and should be the
moment the player understands exactly how far out of his depth he was.

What he was actually doing:

- Each new patron required its own instruments, its own workings, its own
  structures raised to its own specification. **This is why the diabolical works
  are stylistically incoherent** — they were commissioned by rival authorities
  who despised one another. Weinhold noticed and could not explain it.
- A contract is a claim of order over ground. One contract is a claim. A dozen
  contending jurisdictions, each asserting its law over the same walls, each with
  its seals set into the foundations, is not a claim. It is **occupation**.
- The devils are the ordered orders. Their war with the demonic is territorial and
  ancient. What Siegmund's masons built, course by course, from plans nobody
  understood, was a fortified infernal position on the mortal coast — the first in
  centuries.

**A fortification invites a siege.** The demons came for Hochmauer because
Hochmauer had become worth taking. The Black Weeping is not a curse and not a
punishment. It is ordnance.

The final turn of the knife: **the last thing House Aldenbrandt ever built was a
fortress for hell, and they built it well.** Do not let any document say this.
Let the player arrive at it and sit with it.

### 5.5 The placation, and the breach

In month twelve, with the pestilence inside the walls, Siegmund attempted to treat
with the *demonic* side — to buy the plague off. It was the most human thing he
did and the worst.

- To the demons, the approach was noise from a fortified enemy position.
- To the devils — all of them, and they agreed on nothing else — it was **breach**.
  Belial's instrument contains a clause of exclusive dealing that survived every
  later contract because every later contract was drafted inside it. On its
  violation, the protections lapse. All of them. At once.

So the walls that had held stopped holding. This is why the last month is so much
worse than the three before it, and why the final documents describe a collapse
rather than a decline. **Siegmund understood this. He wrote it down. He knew he
had killed his family by trying to save them.** That letter is the keystone of the
whole document set and should be found at or near the Nordturm desk.

---

## 6. The cast

Voices for the document set. Each has a register, a position on the timeline, and
a physical location where their hand is most likely found. Agents writing text
must pick a voice from this list and stay inside it. **A document with no
attributable hand is a wasted document.**

### Small council and court

| Name | Office | Register | Arc |
|---|---|---|---|
| **Dietrich Marck** | Chancellor | Dry, procedural, immaculate hand. Records everything, judges nothing. | Complicit through obedience. His ledgers are the clearest evidence and he never once writes an opinion. His last entry is a tally that does not balance. |
| **Father Anselm Vogt** | Confessor | Latin-inflected, scriptural, increasingly unsteady | Knows first. Torn between the seal of confession and the danger. Breaks the seal too late. Dies in the chapel. |
| **Marshal Gerhart Stolz** | Marshal | Blunt, military, poor speller, honest | Loyal, thick, useful. Enforced the quarantine. Killed men at the gate on order and it broke him. Do not make him a villain. |
| **Hanne Brack** | Spymaster ("the Ledgerer") | Terse, coded, numbered leaves | Kept the outside world ignorant. Her cipher-notes are the best source on what the neighbours knew. Fled in month 13, made it as far as the Bone Field. |
| **Baumeister Jost Weinhold** | Master of works | Technical, precise, agonised | Built the diabolical works. Understood their geometry better than anyone and could not stop drawing them. His marginalia are the most frightening documents in the game. |
| **Magister Cyriak Bohn** | Physician | Learned, wrong, then learned and right | Diagnoses the Black Weeping as bad air, then as contagion, then stops writing in Latin. |
| **Abbess Walburga of St. Ursel** | Scholar | Formal, sceptical, sharp | The intellectual voice. Correspondence with Anselm. Recognised the seals for what they were from a book in her own library. |
| **Guildmaster Balthasar Krieg** | Masons' guild | Working register, proud, exact about craft | The professional conscience. His guild roll is Payment III's evidence. |
| **Nikolaus Fahr** | Chronicler | Ornate, courtly, self-important, then not | Writes the official history. His tone collapsing across fourteen months is a delivery mechanism for the whole timeline. |
| **Hildebrand Rosch** | Merchant council | Commercial, ingratiating | Kept the staple running past all reason. Profiteered on the quarantine. The nearest thing to a villain, and small. |

### Household and town

| Name | Role | Use |
|---|---|---|
| **Grete Ilmer** | Scullion | Chalk and charcoal. Barely literate. The most affecting voice in the game — she writes what she sees with no framework to explain it. |
| **Werner Ochs** | Smith | Work orders, complaints about metal that will not heat |
| **Captain Ansgar Feld** | Master of the cog *Sankt Ursel* | Harbour logs, the quarantine at sea, the decision not to sail |
| **Old Mattheus Krug** | Lighthouse keeper | The Brandturm. Kept the brazier. See §7. |
| **Sister Klara** | Infirmarian | Casualty rolls, the crypt consignments |
| **Lenhart Vogel** | Gate sergeant | Under Stolz. Tally marks. |

---

## 7. The works — canon sites

Two categories. Build agents may add to either, in keeping.

### 7.1 Ancestral works (beautiful, purposeful, legible)

The great hall and nave (Reinhold) · the harbour mole and quays (Mechthild) · the
Brandturm (Albrecht) · the undercroft granary and the water works (Konrad) · the
long gallery, the library, the walled garden (Gisela and Dietrich) · the smithy,
the joiners' shop, the mason's yard, the guild hall.

**These should be the game's beauty.** The player should like this family before
they learn what it did. Give them good stone, good proportion, evidence of care.

### 7.2 Diabolical works (masterful, purposeless, wrong)

Built in the last year, by the best hands in the realm, to specifications not of
this world. **Rule: to a layman, esoteric and unclear. To a player who explores
them, unmistakable.** They are always superbly made. The horror is the quality.

**Each work has a patron**, and works of different patrons should not resemble one
another. Astaroth's are geometric and elegant. Mammon's are inventories and
storage. Focalor's are wet, low, and tidal. Belial's are the earliest and the most
nearly reasonable. **This incoherence is canon, not sloppiness** — see §5.4.

| Work | Patron | Description |
|---|---|---|
| **The Ordinal** | Astaroth | Seven concentric rings of brick in a vaulted chamber, no opening into the innermost. The bricklaying is flawless. Whatever the centre is for, it was walled in from the outside. |
| **The Sounding Court** | Astaroth | A courtyard cut so that a voice at the centre returns wrong — delayed, or pitched differently, or not at all. Weinhold's notes give the intended acoustic effect. It is not one a human throat produces. |
| **The Tithe House** | Mammon | Where payments were rendered. Racks, cradles, fitted cases for objects no longer in them, every case labelled in Marck's hand. The inventory of what a house of makers gave away. |
| **The Iron Orchard** | Mammon | In the pleasure garden, twelve trees of wrought and cast iron, each a different species, each botanically exact. Werner Ochs's work. He complained in writing about the commission and made them beautifully anyway, because he was a smith. |
| **The Unfinished Stair** | Belial | A spiral of forty-one perfect steps rising into a sealed vault. It was not abandoned. It was completed. |
| **The Wet Chapel** | Focalor | Below the tide line in the harbour works, floods twice daily, consecrated to nothing identifiable. Fittings in the wrong orientation. |
| **The Drowning Stair** | Focalor | A quay stair that continues past the low-water mark, cut and dressed, descending into the bay. Nobody records how far it goes. |
| **The Cold Forge** | Asmodeus | A second smithy where the fires will not take. Ochs's last order came here. This is where he stopped writing. |
| **The Bridal Hall** | Asmodeus | A small hall furnished for a wedding feast that was never held, set for two, dressed and finished in month ten. Adelheid ordered it locked. The key was never found. |

**Agents may add works.** Pick a patron, take its domain, and build something a
guild would be proud of and a priest would burn. See §13.

### 7.3 The Hortus Clausus — the poison garden

**The single strangest place in Hochmauer, and the one that has nothing to do with
the covenant.** Planted by the Dowager Gisela some forty years ago, walled,
gated, and kept locked. It predates Siegmund's first working by a generation.

**What it is.** A small enclosed garden — thirty paces by twenty — inside the
castle walls, reached through a single iron gate in a blind wall. Beds laid out on
a formal southern plan that belongs to no northern garden. Every plant in it is
lethal. Monkshood, hemlock, henbane, mandrake, foxglove, belladonna, hellebore,
yew, oleander, autumn crocus. Several should not survive this latitude. All of
them do.

**And they are still alive.** This is the essential fact. Hochmauer is dead —
dead people, dead flies, dead fires, dust and stain and silence — and behind one
iron gate there is a garden in full growth, tended by nobody for fourteen months,
unweeded and unruined, flowering out of season. The beds are not overgrown. The
paths are clear.

**Art direction — read this before building it.** The garden must not break the
palette. It reads in the **cold family**: bone-white, silver-green, pale violet,
grey-blue, wet black. Moonlit rather than sunlit. Nothing warm, nothing saturated,
no green in the register of a living meadow. The effect is *luminous*, not
verdant — pale flowers holding light in a dark enclosure. It should read as the
most beautiful place in the castle and the player's neck should prickle anyway.

**What it is for.** Unresolved and to remain so. The available evidence, and no
more:

- Gisela's own physician kept a dispensary book. It survives. It is a book of
  medicines, and every medicine in it is drawn from something in that garden, and
  the doses are correct.
- The gate has been kept locked for forty years. Two keys were cut. Gisela had
  one. The other is unaccounted for in every inventory Marck ever took, and he
  noted the discrepancy four times without comment.
- Two deaths at court during Gisela's tenure were recorded as fevers. Fahr's
  predecessor recorded them in one line each, which is fewer lines than he gave
  the weather.
- A child's footprints in the bed-borders, from Otwin's book of drawings — he drew
  the garden from inside. He should not have been able to get in.

**What agents must never do.** Do not connect the garden to the covenant. Do not
explain why it lives. Do not make Gisela a witch, a cultist, or a devil's client.
She was a foreign woman in a suspicious court who knew a great deal about plants,
and the game does not adjudicate her. The garden's power is that it is a second,
older, unrelated strangeness sitting inside the first — proof that this family had
rooms nobody could account for long before Siegmund signed anything.

If the player leaves the Hortus Clausus without an answer, it has worked.

### 7.4 Canon reconciliation with the existing build

- **The single burning candle** on the fallen chandelier in the nave — infernal
  residue. Things touched by the covenant do not stop. Never explained in text.
  Established as a *class* of phenomenon: the candle, the Brandturm brazier, and a
  lamp or two elsewhere. All burn without fuel and give no heat. Weinhold noticed
  and wrote one line about it.
- **The Brandturm brazier**, still lit across the water — same class. Mattheus
  Krug's last log entry records that he stopped bringing fuel up eight days before
  he died, and that the fire did not care.
- **The tolling bell** — leave unexplained. No document addresses it. If any agent
  is tempted to answer this, do not.
- **The child's shoe** on the undercroft steps — Mechthild's. Never stated.
- **The abandoned meal** in the side chamber — a household that left in the middle
  of a service. Phase: month 13, the collapse.
- **The lime-pit** — Konrad's grain bin. Sealed in month 12 when the crypt was
  declared full.

---

## 8. The Black Weeping

The name the household gave it. Bohn calls it *pestis atra* until month 12, then
he calls it what the servants call it.

**Course:** fever and hard swelling at groin and neck within a day. Extremities
blacken from the fingertips inward over two or three. Bleeding from nose, eyes,
and ears in the last hours — the weeping. Four days from first symptom to death,
sometimes two. It does not spare the strong or the pious and everyone notices.

**Visual grammar for build agents — use these, repeatably:**

1. **Blackened extremities** on exposed corpse geometry. Hands and feet. Read at
   PS1 resolution as dark terminal segments.
2. **Dried blood tracks** from the face. Dark, not red. Three streaks is the
   silhouette.
3. **The stain.** Where a body lay long enough, the stone beneath is marked, and
   the mark does not scrub out. Masons tried. There are scrub marks around some
   stains and that detail is worth more than the stain.
4. **Flies.** Dead flies in drifts at window sills, in corners, in vessels. In
   quantity. This is Beelzebub's signature and the player should register it as
   ambient filth before they ever read the name. **Cheapest and best tool in the
   kit — use it everywhere and never comment on it.**
5. **Vinegar and lime.** The household's futile counter-measures. Bowls of vinegar
   gone to scum, lime scattered at thresholds, herbs bundled at every doorway.
   Evidence of people trying.
6. **Sealed doors.** Boards nailed across from the outside. Chalked crosses. Chalk
   dates. Some crosses are on the *inside* of doors.

**Corpse placement doctrine — contextual, never decorative:**

| Phase | Placement | Reads as |
|---|---|---|
| Early (months 11–12) | Not present. In the ossuary, in the lime-pit. Bone, ordered, stacked. | A society still functioning. Someone counted these dead. |
| Middle (month 13) | In beds, in the infirmary, laid out with hands composed, sheets drawn. | Care, until care ran out. |
| Late (month 13–14) | Where they fell. Mid-task. At a bench, on a stair, in a doorway. Not arranged. | The end of order. |
| Violent (month 14) | Small clusters. Evidence of what happened between two or three people in a room, reconstructible from position and what is in their hands. Never explained by any text. | The player does the forensics. |

The violent tableaux should be **rare and specific** — four or five in the whole
castle. Each one a puzzle with no solution offered. A door barred from one side, a
body on each side of it. Two men in the buttery, one with a knife, one with a key.
The restraint is the effect.

---

## 9. Writing guidance — the register

**All player-facing text is period-plausible English of a fourteenth-century
northern court.** The model is Buehlman's *Between Two Fires*: plain, concrete,
sensory, unsentimental, with religion as furniture rather than decoration. Read
that book's approach and imitate its restraint, never its sentences.

### Rules

**Do:**
- Write in the concrete. Objects, weights, weather, prices, bodies, work.
- Let the writer's trade shape the prose. A mason measures. A physician
  classifies. A scullion lists what she has to do tomorrow.
- Use the calendar of saints and feasts for dates. *On the eve of St. Martin.*
- Treat God, the Devil, and hell as facts about the world, stated without emphasis.
- Let people be wrong, petty, bored, and practical in the middle of catastrophe.
- Break off. Documents end because the writer stopped. Not every leaf is complete.
- Keep it short. Six to sixty words is the working range for most inscriptions.

**Do not:**
- **Ye olde pastiche.** No *thee, thou, forsooth, verily, mayhap, prithee*.
- **Modern idiom.** No *okay, folks, seriously, insane, crazy, nightmare fuel,
  something's off, I have a bad feeling.*
- **Therapeutic or analytic vocabulary.** No *trauma, processing, coping,
  psychological, ritual space, energy, presence.*
- **AI tells.** No *a testament to*, no *it is worth noting*, no *in the end*, no
  em-dash-hinged summary clauses, no three-item lists of abstractions, no closing
  sentence that restates the document's meaning. **A period writer does not
  conclude. They stop.**
- **Explaining.** No document should tell the player what the game is about. The
  writer knows less than the player will.
- **Adverbs.** Cut them. Choose the better verb.
- **Naming the theme.** Nobody writes about craft being corrupted. They write
  about a bad course of stone.

### Calibration

*Wrong (modern):* "Something is seriously wrong with the new construction in the
east wing. The geometry doesn't make sense and it's giving everyone a bad feeling."

*Wrong (pastiche):* "Verily, mayhap the stones of yon eastern hall be cursed, for
forsooth they trouble mine heart."

*Right:* "The east courses run to no plan I was taught. I set them as I am given
them. My father would have put down his hammer and gone home."
— *Balthasar Krieg, guild roll, marginal*

*Right (Grete, chalk, scullion):* "Master Ochs did not come for his bread again.
Three days. I will not keep it back a fourth."

*Right (Marck, ledger):* "Rendered to the account: one reliquary, silver-gilt,
weight four pound eleven ounce. Valued to the second head. No receipt entered."

*Right (Anselm, late):* "I have broken the seal. God forgive me, I told her, and
she wept and said she had known since Candlemas. We are neither of us in time."

*Right (Siegmund, the keystone letter):* "I bought them a wall and they died
behind it. I do not ask you to understand what I signed. I ask you to believe I
read it, and that I thought I had read it well."

### Document formats available

Chalk on plaster · charcoal on stone · scratched tally · ledger entry · guild roll
· work order · victualling list · casualty roll · private letter · sealed
instrument (Latin fragments, seals described) · marginalia in a book of hours ·
chronicle entry · a child's drawing with a caption · a name cut into a keystone ·
a laundry list.

**Ratio target:** for every letter of high emotion, four documents of mundane
administration. The bureaucracy of a dying household is the thing that hurts.

---

## 10. The player

An unnamed scout in the service of **Margrave Otto von Falkenrieth**, sent
overland when Hochmauer's harbour went silent through a whole trading season and
three envoys failed to return. Practical, unlettered in Latin but literate in the
vernacular, not a hero, not an investigator by trade. A man with a job and a
report to give.

- **He is never characterised in text.** No inner monologue, no journal of his
  own, no commentary. The examine lines describe what is there, in his plain
  register, and stop.
- **The game ends when he leaves**, or it does not end. Do not build an ending
  until the castle is worth leaving. A future slice may allow walking out through
  the gate you came in by, at which point the screen goes and that is all.
- **He does not know what a devil's seal looks like.** The player may recognise
  BELIAL on a document. The scout does not. Examine text should describe form, not
  meaning: *a name cut deep, in letters not of any hand he knows.*

---

## 11. Timeline (canonical, for dating every document)

Fourteen months. Use feast-day dating in text; use month numbers in specs.

| Month | Event |
|---|---|
| — | Sarnthal betrothal proposed. Falkenrieth's claim filed at the Diet. |
| 1 | Siegmund's first working. Belial. The instrument sealed. |
| 1–3 | **Payment I.** Works surrendered. Court supportive. Fahr's chronicle at its most flattering. |
| 3–6 | **Payment II.** The guilds redirected. Wages tripled. Krieg's first complaint. |
| 5 | Sarnthal's fleet turns back from the bay in clear weather. Focalor's clause. Celebrated as fortune. **Astaroth approaches directly.** |
| 6 | Siegmund's letter to Marck: he has learned to make them bid. The high-water mark of his confidence. |
| 6–9 | **Payment III.** Eleven names struck from the roll. Anselm's first refusal of absolution. |
| 8 | Jurisdictional dispute. Bael's name cited against Astaroth's. Weinhold receives three sets of plans in one week that contradict each other. |
| 9–11 | **Payment IV.** The Ordinal, the Sounding Court, the Cold Forge, the Bridal Hall. Asmodeus's clause takes hold. Adelheid confronts him. |
| 11 | First case of the Black Weeping, harbour quarter. |
| 12 | Quarantine. The gate killings. Siegmund's approach to the demonic side. **Breach.** The undercroft consecrated as crypt. Lime-pit sealed. |
| 13 | Collapse. The infirmary overrun. Anselm dies in the chapel. Adelheid dies. The abandoned meal. |
| 14 | The violent month. Brack flees. Krug stops carrying fuel. Siegmund at the desk. |
| — | Present. The scout arrives. Silence, gulls, one candle burning. |

---

## 12. Open items

Not yet canon. Do not invent answers; escalate to the author.

1. Whether the harbour wrecks are named Sarnthal ships and whether any bodies
   remain aboard.
2. Whether Kunigunde's betrothal was concluded and whether a Sarnthal party was in
   residence when the plague broke.
3. Whether Neder Hochmauer is walled off from the castle or continuous.
4. What is in the Ordinal. **Recommendation: never answer this.**
5. What the Hortus Clausus is for. **Recommendation: never answer this either.**
6. Where the second garden key went.
7. Whether the player may enter the Nordturm at any time or whether the ascent is
   soft-gated by geography.

---

## 13. Expansion doctrine

**Hochmauer is meant to grow without limit.** New wings, rooms, works, voices, and
documents will be added over many sessions. This section is how invention stays in
canon without the author adjudicating every prop.

### 13.1 The four tests

Any invented content must pass all four. If it fails one, cut it or escalate.

1. **Whose hand?** Every space was built by a named generation (§3) and every
   document was written by a named voice (§6). If you cannot name both, you are
   decorating rather than authoring. Inventing a new minor voice is allowed and
   encouraged; inventing an unattributable one is not.
2. **Which month?** Every prop, stain, corpse, and inscription belongs to a phase
   of the timeline (§11). A boarded door is month twelve. A body mid-task is month
   fourteen. Get this wrong and the castle stops telling time.
3. **Does it explain?** If the content states the theme, names the mechanism, or
   summarises what the player should feel, cut it. §5.4 is known to the author and
   to no one in the world.
4. **Would a guild be proud of it?** Ancestral works must be good. Diabolical works
   must be *better*. Nothing in Hochmauer was made badly. Decay is what happened to
   it, not how it was made.

### 13.2 Generative recipes

**A new ancestral wing.** Pick a generation from §3. Take its preoccupation
(defence, ceremony, engineering, trade, infrastructure, refinement). Build to that
preoccupation with the stone vocabulary of that era. Populate with the trade that
worked there. Add one detail of unreasonable care — a carved corbel nobody would
ever see, a stair worn to a curve. Then apply the phase-appropriate decay.

**A new diabolical work.** Pick a patron from §5.2. Take its domain — Astaroth
geometry and the sciences, Mammon valuation and storage, Focalor tide and
drowning, Belial law and language, Asmodeus marriage and hearth. Specify a
structure that serves that domain and no human need. Have it built to guild
standard by a named craftsman who left one line of professional objection. Never
state its function.

**A new voice.** Give them an office, a register tied to their trade, a literacy
level, and a date of death. Write four mundane documents before you write one
emotional one. Their arc is the arc of their paperwork.

**A new document.** Choose a format from §9. Choose a month. Choose a voice.
Write between six and sixty words. Stop before the writer would have concluded.

**A new room in an existing wing.** Ask what work was done there, who did it, what
they were doing on the last day, and whether they finished.

### 13.3 What is fixed and what is open

**Fixed** — do not alter without the author: the four payments, the bidding war and
the beachhead, the breach, Siegmund's character and end, the plague's visual
grammar, the empty-castle rule, the no-threat rule, the register in §9, the real
infernal names, the Hortus Clausus's unresolvability.

**Open** — invent as needed: rooms, wings, courtyards, outbuildings, ships, minor
voices, documents, guild business, household routine, town streets, saints' names,
local custom, weather, food, the contents of any cupboard in the realm.

### 13.4 Amendment protocol

New canon is written **into this file**, in the section it belongs to, with a
date. Canon that lives only in an agent's context is not canon and will be lost.
When a slice ships, the integrator updates this file before closing the session.

---

*End of world bible. Last amended: 8 August 2026 — infernal bidding war and
beachhead mechanism (§5.4), contending princes (§5.2), the Dowager Gisela (§3.1),
the Hortus Clausus (§7.3), expansion doctrine (§13).*
