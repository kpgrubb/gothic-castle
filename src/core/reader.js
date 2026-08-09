// ---------------------------------------------------------------------------
// READING SYSTEM (owned by CORE). A simple framed "leaf" overlay for documents.
// world.reader.open(doc) shows it; paging via E/arrows; Esc closes. Tracks which
// documents have been read for the quiet findings tally (no total shown — the
// world-bible wants no objective markers). While open, world.flags.reading is
// true so interaction freezes movement/look/examine.
//
// A `doc` is: { id, type, voice, dateText, style?, prompt?, pages: string|string[] }
// ---------------------------------------------------------------------------

export function createReader(world) {
  const el = document.getElementById('reader');
  const metaEl = document.getElementById('reader-meta');
  const bodyEl = document.getElementById('reader-body');
  const pageEl = document.getElementById('reader-page');
  const hintEl = document.getElementById('reader-hint');
  const tallyEl = document.getElementById('tally');
  const leafEl = el ? el.querySelector('.leaf') : null;

  const readIds = new Set();
  let current = null;        // { doc, page }
  let keyHandler = null;

  const pagesOf = (doc) => (Array.isArray(doc.pages) ? doc.pages : [doc.pages ?? '']);

  function render() {
    const { doc, page } = current;
    const ps = pagesOf(doc);
    metaEl.textContent = [doc.type, doc.voice, doc.dateText].filter(Boolean).join('  ·  ');
    bodyEl.className = 'doc-body ' + (doc.style || doc.type || '');
    bodyEl.textContent = ps[page];
    const multi = ps.length > 1;
    pageEl.textContent = multi ? `leaf ${page + 1} of ${ps.length}` : '';
    hintEl.textContent = multi
      ? (page < ps.length - 1 ? '[E / →] turn over   ·   [Esc] set down'
                              : '[Esc] set down   ·   [←] back')
      : '[E / Esc] set down';
    if (leafEl) leafEl.scrollTop = 0;
  }

  function open(doc) {
    if (!el || !doc) return;
    current = { doc, page: 0 };
    el.classList.add('open');
    world.flags.reading = true;
    render();
    if (!readIds.has(doc.id)) { readIds.add(doc.id); updateTally(); }

    // Capture-phase key handling so interaction's window listeners don't also fire.
    keyHandler = (e) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.code === 'ArrowRight' || e.code === 'KeyE') {
        e.preventDefault(); e.stopPropagation();
        const ps = pagesOf(current.doc);
        if (current.page < ps.length - 1) { current.page++; render(); } else { close(); }
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        if (current.page > 0) { current.page--; render(); }
      }
    };
    window.addEventListener('keydown', keyHandler, true);
  }

  function close() {
    if (!el) return;
    el.classList.remove('open');
    world.flags.reading = false;
    if (keyHandler) { window.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
    current = null;
  }

  function updateTally() {
    if (tallyEl && readIds.size > 0) {
      tallyEl.style.display = 'block';
      tallyEl.textContent = `leaves read: ${readIds.size}`;
    }
  }

  return {
    open,
    close,
    get isOpen() { return !!current; },
    get readCount() { return readIds.size; },
    hasRead: (id) => readIds.has(id),
  };
}
