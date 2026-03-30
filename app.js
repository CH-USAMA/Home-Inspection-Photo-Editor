const { open: openDialog, save: saveDialog, message, confirm: tauriConfirm } = window.__TAURI__.dialog;
const { readFile, writeFile, mkdir } = window.__TAURI__.fs;
const { join, dirname, basename } = window.__TAURI__.path;

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

function getCodeCategory(num) {
  const n = parseInt(num);
  if (n >= 1000) return 'Built-In Kitchen Appliances';
  const base = Math.floor(n / 100) * 100;
  return CODE_CATEGORIES[base] || 'Other';
}

const CATEGORIES = ['Roofing','Exterior','Garage','Interiors','Structural Components','Plumbing System','Electrical System','Heating / Central Air Conditioning','Insulation and Ventilation','Built-In Kitchen Appliances','Other'];
const CODES_KEY = 'inspCodes_v1';

const state = {
  photos: [], currentIndex: -1, activeTool: 'select', captionColor: 'black',
  problemCodes: {}, undoStack: [], redSummary: [],
  sourceFolder: null, saveFolder: null,
  drawing: false, drawStart: {x:0,y:0}, currentDraw: null,
  draggingCaption: false, captionDragOffset: {x:0,y:0}, scale: 1,
  groups: {},
  filmItems: [],
  deletedPhotoStack: [],
  // STAGE 3: sort mode
  sortMode: false,
  sortAssignments: {}, // photoIndex -> folderKey
  sortSelected: new Set(), // photoIndices selected in sort filmstrip
  filmSelected: new Set(), // itemIndices selected in normal filmstrip
  filmSelectAnchor: undefined, // anchor for shift+click range
};

const SORT_FOLDERS = [
  { key: 'Roofing',       label: '🏠 Roofing' },
  { key: 'Exterior',      label: '🌳 Exterior' },
  { key: 'Garage',        label: '🚗 Garage' },
  { key: 'Interiors',     label: '🛋 Interiors' },
  { key: 'Structural',    label: '🏗 Structural' },
  { key: 'Plumbing',      label: '🔧 Plumbing' },
  { key: 'Electrical',    label: '⚡ Electrical' },
  { key: 'HVAC',          label: '🌡 HVAC' },
  { key: 'Insulation',    label: '🧱 Insulation' },
  { key: 'Kitchen',       label: '🍳 Kitchen' },
];

const mainCanvas = document.getElementById('mainCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const interactCanvas = document.getElementById('interactCanvas');
const canvasWrap = document.getElementById('canvas-wrap');
const ctx = mainCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');
const ictx = interactCanvas.getContext('2d');

function photoItemIndex(photoIndex) {
  return state.filmItems.findIndex(it => it.type === 'photo' && it.photoIndex === photoIndex);
}

function rebuildFilmItems() {
  state.filmItems = state.photos.map((_, i) => ({ type: 'photo', photoIndex: i }));
}

// ── SORT MODE ──
function enterSortMode() {
  state.sortMode = true;
  state.sortSelected.clear();
  document.getElementById('btnSortMode').classList.add('active');
  const sortBtn = document.getElementById('btnSortMode');
  sortBtn.innerHTML = '✕ Exit<span>Sort</span>';
  document.getElementById('sort-mode-area').style.display = 'flex';
  document.getElementById('canvas-area').style.display = 'none';
  document.getElementById('save-next-bar').style.display = 'none';
  renderSortBuckets();
  renderFilmstrip();
  setStatus('Sort Mode — click photos to select, drag to folder buckets');
}

function exitSortMode() {
  state.sortMode = false;
  state.sortSelected.clear();
  const btn = document.getElementById('btnSortMode');
  btn.classList.remove('active');
  btn.innerHTML = '⊞ Sort<span>Photos</span>';
  document.getElementById('sort-mode-area').style.display = 'none';
  document.getElementById('canvas-area').style.display = 'flex';
  document.getElementById('save-next-bar').style.display = 'flex';
  rebuildFilmItemsFromSort();
  renderFilmstrip();
  if (state.photos.length > 0) loadPhoto(0);
  setStatus('Sort complete — photos organized by category');
  showToast('Sort complete ✓', '#4a2a8a');
}

function rebuildFilmItemsFromSort() {
  const newItems = [];
  const unassigned = state.photos.map((_, i) => i).filter(i => !state.sortAssignments[i]);
  unassigned.forEach(i => newItems.push({ type: 'photo', photoIndex: i }));

  SORT_FOLDERS.forEach(folder => {
    const assigned = state.photos.map((_, i) => i).filter(i => state.sortAssignments[i] === folder.key);
    if (!assigned.length) return;
    newItems.push({ type: 'card', id: Date.now() + Math.random(), text: folder.key, cardMode: 'group', _fromSort: true });
    assigned.forEach(i => newItems.push({ type: 'photo', photoIndex: i }));
    newItems.push({ type: 'card', id: Date.now() + Math.random(), text: '000', cardMode: 'code' });
  });
  state.filmItems = newItems;
}

const sortDrag = { active: false, dragging: false, indices: [], startX: 0, startY: 0, ghost: null, clickedIndex: -1 };

function renderSortBuckets() {
  const container = document.getElementById('sort-buckets');
  container.innerHTML = '';
  SORT_FOLDERS.forEach(folder => {
    const assignedPhotos = state.photos.map((_, i) => i).filter(i => state.sortAssignments[i] === folder.key);
    const bucket = document.createElement('div');
    bucket.className = 'sort-bucket'; bucket.dataset.folder = folder.key;
    const header = document.createElement('div');
    header.className = 'sort-bucket-header'; header.innerHTML = `${folder.label} <span class="sort-bucket-count">${assignedPhotos.length} photo${assignedPhotos.length !== 1 ? 's' : ''}</span>`;
    bucket.appendChild(header);
    const photosDiv = document.createElement('div'); photosDiv.className = 'sort-bucket-photos';
    assignedPhotos.forEach(photoIdx => {
      const img = document.createElement('img'); img.className = 'sort-thumb'; img.src = state.photos[photoIdx].url;
      img.addEventListener('mousedown', (e) => { e.stopPropagation(); });
      img.addEventListener('click', (e) => { e.stopPropagation(); delete state.sortAssignments[photoIdx]; renderSortBuckets(); renderFilmstrip(); setStatus('Photo moved back to unsorted pool'); });
      photosDiv.appendChild(img);
    });
    bucket.appendChild(photosDiv); container.appendChild(bucket);
  });
}

function assignSelectedToBucket(folderKey) {
  if (!sortDrag.indices.length) return;
  sortDrag.indices.forEach(i => { state.sortAssignments[i] = folderKey; });
  const count = sortDrag.indices.length; state.sortSelected.clear(); sortDrag.indices = [];
  renderSortBuckets(); renderFilmstrip(); setStatus(`${count} photo${count !== 1 ? 's' : ''} assigned to ${folderKey}`); showToast(`\u2192 ${folderKey}`, '#4a2a8a');
}

function getBucketUnderPoint(x, y) {
  const buckets = document.querySelectorAll('.sort-bucket');
  for (const b of buckets) { const r = b.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b; }
  return null;
}

function renderSortFilmstrip() {
  const strip = document.getElementById('filmstrip'); strip.innerHTML = '';
  const unassigned = state.photos.map((p, i) => ({ photo: p, photoIndex: i })).filter(({ photoIndex }) => !state.sortAssignments[photoIndex]);
  if (!unassigned.length) { strip.innerHTML = '<div style="color:#88ffcc;font-size:13px;padding:10px;text-align:center;">\u2713 All photos assigned!</div>'; return; }
  const label = document.createElement('div'); label.style.cssText = 'font-size:11px;color:#aaa;text-transform:uppercase;padding:6px 6px 4px;letter-spacing:.5px;'; label.textContent = `Unsorted (${unassigned.length})`; strip.appendChild(label);
  const unassignedIndices = unassigned.map(u => u.photoIndex);
  unassigned.forEach(({ photo, photoIndex }) => {
    const isSelected = state.sortSelected.has(photoIndex);
    const thumb = document.createElement('div'); thumb.className = 'film-thumb' + (isSelected ? ' sort-selected' : ''); thumb.dataset.photoIndex = photoIndex; thumb.style.marginBottom = '4px';
    thumb.innerHTML = `<img src="${photo.url}" loading="lazy" style="pointer-events:none;"><span class="film-num-badge">${photoIndex + 1}</span>`;
    thumb.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey && state.sortSelected.size > 0) {
        const allSelected = [...state.sortSelected]; const lastSelected = allSelected[allSelected.length - 1];
        const lastIdx = unassignedIndices.indexOf(lastSelected), thisIdx = unassignedIndices.indexOf(photoIndex);
        if (lastIdx >= 0 && thisIdx >= 0) { const lo = Math.min(lastIdx, thisIdx), hi = Math.max(lastIdx, thisIdx); for (let k = lo; k <= hi; k++) state.sortSelected.add(unassignedIndices[k]); } else state.sortSelected.add(photoIndex);
        renderSortFilmstrip();
      } else if (e.ctrlKey || e.metaKey) {
        if (state.sortSelected.has(photoIndex)) state.sortSelected.delete(photoIndex); else state.sortSelected.add(photoIndex);
        renderSortFilmstrip();
      } else {
        if (!state.sortSelected.has(photoIndex)) { state.sortSelected.clear(); state.sortSelected.add(photoIndex); renderSortFilmstrip(); }
      }
      sortDrag.active = true; sortDrag.dragging = false; sortDrag.startX = e.clientX; sortDrag.startY = e.clientY; sortDrag.indices = [...state.sortSelected]; sortDrag.clickedIndex = photoIndex;
    });
    thumb.addEventListener('mouseup', (e) => { if (!sortDrag.dragging && !e.shiftKey && !e.ctrlKey && !e.metaKey) { state.sortSelected.clear(); state.sortSelected.add(photoIndex); renderSortFilmstrip(); } });
    strip.appendChild(thumb);
  });
}

document.addEventListener('mousemove', (eSM) => {
  if (!sortDrag.active || !state.sortMode) return;
  if (!sortDrag.dragging) {
    if (Math.abs(eSM.clientX - sortDrag.startX) < 5 && Math.abs(eSM.clientY - sortDrag.startY) < 5) return;
    sortDrag.dragging = true; const ghost = document.getElementById('drag-ghost');
    ghost.textContent = `\uD83D\uDCF7 ${sortDrag.indices.length} photo${sortDrag.indices.length !== 1 ? 's' : ''}`;
    ghost.style.display = 'block'; sortDrag.ghost = ghost;
  }
  if (sortDrag.ghost) { sortDrag.ghost.style.left = (eSM.clientX + 14) + 'px'; sortDrag.ghost.style.top = (eSM.clientY - 10) + 'px'; }
  document.querySelectorAll('.sort-bucket').forEach(b => b.classList.remove('drag-over'));
  const bucket = getBucketUnderPoint(eSM.clientX, eSM.clientY);
  if (bucket) bucket.classList.add('drag-over');
});

document.addEventListener('mouseup', (eSM) => {
  if (!sortDrag.active || !state.sortMode) return;
  sortDrag.active = false; if (sortDrag.ghost) sortDrag.ghost.style.display = 'none';
  document.querySelectorAll('.sort-bucket').forEach(b => b.classList.remove('drag-over'));
  if (sortDrag.dragging) { sortDrag.dragging = false; const bucket = getBucketUnderPoint(eSM.clientX, eSM.clientY); if (bucket && bucket.dataset.folder) assignSelectedToBucket(bucket.dataset.folder); }
  sortDrag.indices = [];
});

function loadProblemCodes() {
  try { const s = localStorage.getItem(CODES_KEY); state.problemCodes = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_PROBLEM_CODES)); } catch(e) { state.problemCodes = JSON.parse(JSON.stringify(DEFAULT_PROBLEM_CODES)); }
  renderCodesList();
}
function saveProblemCodes() { try { localStorage.setItem(CODES_KEY, JSON.stringify(state.problemCodes)); } catch(e) {} }

function autoResizeTextarea(ta) { if (!ta) return; ta.style.height = '42px'; const sh = ta.scrollHeight; if (sh > 42) ta.style.height = sh + 'px'; }

function renderCodesList() {
  const list = document.getElementById('codes-list'), search = document.getElementById('codes-search').value.trim().toLowerCase(), catFilter = document.getElementById('codes-cat-filter').value;
  list.innerHTML = ''; const nums = Object.keys(state.problemCodes).map(Number).sort((a,b) => a-b); let lastCat = '';
  nums.forEach(num => {
    const code = state.problemCodes[num], cat = getCodeCategory(num);
    if (catFilter !== 'ALL' && cat !== catFilter) return;
    if (search && !String(num).includes(search) && !code.short.toLowerCase().includes(search) && !code.caption.toLowerCase().includes(search)) return;
    if (cat !== lastCat) { const h = document.createElement('div'); h.style.cssText = 'font-size:10px;text-transform:uppercase;color:#f0c040;padding:5px 3px 2px;margin-top:4px;border-bottom:1px solid #333;'; h.textContent = cat; list.appendChild(h); lastCat = cat; }
    const div = document.createElement('div'); div.className = 'code-entry';
    div.innerHTML = `
      <div style="font-size:16px;font-weight:bold;color:#ffffff;background:#1a1a3a;margin-bottom:5px;padding:5px 6px;border-radius:3px;border-left:3px solid #4488ff;">${escapeHtml(code.short)}${code.safety ? ' <span style="font-size:11px;background:#7d0000;color:#ffaaaa;padding:1px 5px;border-radius:3px;vertical-align:middle;">Safety</span>' : ''}</div>
      <div class="code-entry-header"><div style="display:flex;align-items:center;gap:6px;"><span class="code-num" data-num="${num}">##${num}</span><input class="code-short-input" value="${escapeHtml(code.short)}" data-num="${num}" data-field="short" style="display:none;"><button class="code-edit-btn" data-num="${num}">Edit</button><button class="code-save-btn" data-num="${num}">Save</button></div></div>
      <textarea class="code-caption-text" data-num="${num}" data-field="caption" readonly rows="1">${escapeHtml(code.caption)}</textarea>`;
    div.querySelector('.code-num').addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active')); document.querySelector('.tab-btn[data-tab="caption"]').classList.add('active'); document.getElementById('tab-caption').classList.add('active'); applyCodeNum(num); });
    list.appendChild(div);
  });
  requestAnimationFrame(() => { list.querySelectorAll('.code-caption-text').forEach(ta => autoResizeTextarea(ta)); });
  list.querySelectorAll('.code-edit-btn').forEach(btn => { btn.onclick = () => { const entry = btn.closest('.code-entry'), ta = entry.querySelector('.code-caption-text'), shortInput = entry.querySelector('.code-short-input'), titleDiv = entry.querySelector('div:first-child'); ta.removeAttribute('readonly'); ta.style.background = '#2a2a2a'; ta.style.overflow = 'hidden'; shortInput.style.display = 'block'; shortInput.style.background = '#2a2a2a'; if (titleDiv) titleDiv.style.display = 'none'; btn.style.display = 'none'; entry.querySelector('.code-save-btn').style.display = 'inline-block'; }; });
  list.querySelectorAll('.code-save-btn').forEach(btn => { btn.onclick = () => { const num = btn.dataset.num, entry = btn.closest('.code-entry'), newCaption = entry.querySelector('.code-caption-text').value, newShort = entry.querySelector('.code-short-input').value; state.problemCodes[num].caption = newCaption; state.problemCodes[num].short = newShort; saveProblemCodes(); setStatus('Code ##' + num + ' updated'); renderCodesList(); }; });
}

document.getElementById('codes-search').addEventListener('input', renderCodesList);
document.getElementById('codes-cat-filter').addEventListener('change', renderCodesList);

document.getElementById('new-code-num').addEventListener('input', function() {
  const num = parseInt(this.value), statusEl = document.getElementById('new-code-num-status'), availEl = document.getElementById('code-availability');
  if (!num) { statusEl.textContent = ''; availEl.style.display = 'none'; return; }
  if (state.problemCodes[num]) {
    statusEl.textContent = '⚠️ EXISTS'; statusEl.style.color = '#ffaa44'; availEl.style.display = 'block';
    availEl.innerHTML = `<span style="color:#ffaa44">Code ##${num} exists: "${escapeHtml(state.problemCodes[num].short)}"</span>`;
    document.getElementById('new-code-short').value = state.problemCodes[num].short; document.getElementById('new-code-caption').value = state.problemCodes[num].caption; document.getElementById('new-code-safety').checked = state.problemCodes[num].safety;
  } else {
    const cat = Math.floor(num / 100) * 100, usedInRange = Object.keys(state.problemCodes).map(Number).filter(n => Math.floor(n/100)*100 === cat).sort((a,b)=>a-b);
    statusEl.textContent = '✓ OPEN'; statusEl.style.color = '#66cc66';
    document.getElementById('new-code-short').value = ''; document.getElementById('new-code-caption').value = ''; document.getElementById('new-code-safety').checked = false;
    if (usedInRange.length > 0) { availEl.style.display = 'block'; availEl.innerHTML = `<span style="color:#666">Used in ${cat}s: ${usedInRange.map(n=>'##'+n).join(', ')}</span>`; } else availEl.style.display = 'none';
  }
});

document.getElementById('btnAddCode').onclick = () => {
  const num = parseInt(document.getElementById('new-code-num').value), short = document.getElementById('new-code-short').value.trim(), caption = document.getElementById('new-code-caption').value.trim(), safety = document.getElementById('new-code-safety').checked;
  if (!num || !short || !caption) { alert('Fill all fields'); return; }
  state.problemCodes[num] = { short, caption, safety }; saveProblemCodes();
  document.getElementById('new-code-num').value = ''; document.getElementById('new-code-short').value = ''; document.getElementById('new-code-caption').value = ''; document.getElementById('new-code-safety').checked = false; document.getElementById('new-code-num-status').textContent = ''; document.getElementById('code-availability').style.display = 'none';
  renderCodesList(); setStatus('Code ##' + num + ' saved');
};

document.getElementById('btnPrintCodes').onclick = async () => {
  let html = '<html><head><style>body{font-family:sans-serif;font-size:12px;} table{width:100%;border-collapse:collapse;} td,th{border:1px solid #ccc;padding:6px;} th{background:#f0c040;} .cat{background:#333;color:#fff;}</style></head><body><h2>Problem Codes</h2><table>';
  const nums = Object.keys(state.problemCodes).map(Number).sort((a,b) => a-b); let lastCat = '';
  nums.forEach(num => {
    const code = state.problemCodes[num], cat = getCodeCategory(num);
    if (cat !== lastCat) { html += `<tr><td colspan="3" class="cat">${cat}</td></tr>`; lastCat = cat; }
    html += `<tr><td><b>##${num}</b></td><td>${escapeHtml(code.short)}</td><td>${code.safety ? '⚠️' : ''}</td></tr>`;
  });
  html += '</table></body></html>';
  const savePath = await saveDialog({ defaultPath: 'codes.html' }); if (!savePath) return;
  await writeFile(savePath, new TextEncoder().encode(html)); setStatus('Exported codes');
};

function applyCodeNum(num) {
  const inp = document.getElementById('captionCodeNum'), statusEl = document.getElementById('captionCodeStatus');
  if (!num || isNaN(num) || num < 1) { statusEl.textContent = ''; return; }
  inp.value = num; const code = state.problemCodes[num];
  if (code) { statusEl.innerHTML = `<span style="color:#88cc88">##${num}: ${escapeHtml(code.short)}</span>`; document.getElementById('caption-text').value = code.caption === 'STICKER_READ' ? `[Sticker — ${code.appliance || 'read'}]` : code.caption; setCaptionColor(code.safety ? 'red' : 'black'); }
  else { statusEl.innerHTML = `<span style="color:#aaa">##${num} — ✓ OPEN</span>`; document.getElementById('caption-text').value = ''; setCaptionColor('black'); }
}
document.getElementById('captionCodeNum').addEventListener('input', function() { applyCodeNum(parseInt(this.value)); });
document.getElementById('btnCodeUp').onclick = () => { const cur = parseInt(document.getElementById('captionCodeNum').value) || 0, next = Object.keys(state.problemCodes).map(Number).sort((a,b)=>a-b).find(n => n > cur); if (next) applyCodeNum(next); };
document.getElementById('btnCodeDown').onclick = () => { const cur = parseInt(document.getElementById('captionCodeNum').value) || 999999, prev = Object.keys(state.problemCodes).map(Number).sort((a,b)=>b-a).find(n => n < cur); if (prev) applyCodeNum(prev); };

function liveUpdateFontSize(fs) {
  fs = Math.max(8, Math.min(80, parseInt(fs) || getDefaultCaptionFont()));
  document.getElementById('captionFontSize').value = fs; if (state.currentIndex < 0) return;
  const photo = state.photos[state.currentIndex]; if (photo.caption) { photo.caption.fontSize = fs; renderAnnotations(); }
}
document.getElementById('captionFontSize').addEventListener('input', function() { liveUpdateFontSize(this.value); });
document.getElementById('btnFontUp').onclick = () => liveUpdateFontSize((parseInt(document.getElementById('captionFontSize').value) || 32) + 1);
document.getElementById('btnFontDown').onclick = () => liveUpdateFontSize((parseInt(document.getElementById('captionFontSize').value) || 32) - 1);
function getDefaultCaptionFont() { const v = parseInt(document.getElementById('defaultCaptionFont').value); return (v && v >= 8 && v <= 80) ? v : 32; }
document.getElementById('defaultCaptionFont').addEventListener('change', function() { localStorage.setItem('defaultCaptionFont', this.value); });
try { const saved = localStorage.getItem('defaultCaptionFont'); if (saved) document.getElementById('defaultCaptionFont').value = saved; } catch(e) {}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function setCaptionColor(color) {
  state.captionColor = color; document.getElementById('capColorBlack').classList.toggle('selected', color === 'black'); document.getElementById('capColorRed').classList.toggle('selected', color === 'red');
  if (state.currentIndex >= 0) { const photo = state.photos[state.currentIndex]; if (photo && photo.caption) { photo.caption.color = color; renderAnnotations(); } }
}
window.setCaptionColor = setCaptionColor;

function addToRedSummary(photoName, text) { state.redSummary.push({ photoName, text }); renderRedSummary(); }
function renderRedSummary() {
  const el = document.getElementById('inline-summary-list'), wrap = document.getElementById('inline-summary');
  if (!state.redSummary.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex'; el.innerHTML = state.redSummary.map(item => `<div>${escapeHtml(item.photoName)}: ${escapeHtml(item.text)}</div>`).join('');
}

document.getElementById('btnProcess').onclick = () => { if (!state.photos.length) return; applyCards(); renderFilmstrip(); setStatus('Cards applied'); showToast('Cards applied'); };

document.getElementById('btnNewJob').onclick = async () => {
  if (state.photos.length) { if (!await tauriConfirm('Clear all?')) return; }
  state.photos = []; state.redSummary = []; state.currentIndex = -1; state.undoStack = []; state.deletedPhotoStack = []; state.filmItems = []; state.sortAssignments = {}; state.sortSelected.clear(); state.sortMode = false;
  document.getElementById('btnSortMode').classList.remove('active'); document.getElementById('btnSortMode').innerHTML = '⊞ Sort<span>Photos</span>'; document.getElementById('sort-mode-area').style.display = 'none'; document.getElementById('canvas-area').style.display = 'flex'; document.getElementById('save-next-bar').style.display = 'flex';
  document.getElementById('caption-text').value = ''; document.getElementById('canvas-wrap').style.display = 'none'; document.getElementById('no-photo-msg').style.display = '';
  renderRedSummary(); renderFilmstrip(); setStatus('New job'); updateStatusRight();
};

document.getElementById('btnSortMode').onclick = () => state.sortMode ? exitSortMode() : enterSortMode();
document.getElementById('btnImport').onclick = async () => { const paths = await openDialog({ multiple: true }); if (!paths) return; state.photos = []; state.filmItems = []; await loadPhotoPaths(paths, false); };
document.getElementById('btnImportAdd').onclick = async () => { const paths = await openDialog({ multiple: true }); if (!paths) return; await loadPhotoPaths(paths, true); };

async function loadPhotoPaths(paths, append) {
  for (const p of paths) {
    const bytes = await readFile(p), ext = p.split('.').pop().toLowerCase(), mime = ext === 'png' ? 'image/png' : 'image/jpeg', url = URL.createObjectURL(new Blob([bytes], { type: mime })), name = await basename(p);
    state.photos.push({ filePath: p, name, url, annotations: [], caption: null, done: false, aiType: 'pending' });
    state.filmItems.push({ type: 'photo', photoIndex: state.photos.length - 1 });
  }
  renderFilmstrip(); if (append || state.photos.length) loadPhoto(append ? state.currentIndex : 0);
}

function renderFilmstrip() {
  if (state.sortMode) { renderSortFilmstrip(); return; }
  validateCards(); const strip = document.getElementById('filmstrip'); strip.innerHTML = ''; strip.appendChild(makeDropZone(0));
  state.filmItems.forEach((item, itemIdx) => {
    if (item.type === 'photo') {
      const photo = state.photos[item.photoIndex], div = document.createElement('div'), isActive = item.photoIndex === state.currentIndex, thumb = document.createElement('div');
      thumb.className = 'film-thumb' + (isActive ? ' active' : '') + (state.filmSelected.has(itemIdx) ? ' film-selected' : '');
      thumb.innerHTML = `<img src="${photo.url}"><span class="film-num-badge">${item.photoIndex + 1}</span>${photo.done ? '<div class="film-done-overlay">✓</div>' : ''}<span class="film-drag-handle">⠿</span>`;
      thumb.onmousedown = e => { if (e.target.className === 'film-drag-handle') startDrag(e, itemIdx, 'Photo ' + (item.photoIndex+1)); else if (e.ctrlKey) { if (state.filmSelected.has(itemIdx)) state.filmSelected.delete(itemIdx); else state.filmSelected.add(itemIdx); renderFilmstrip(); } else { state.filmSelected.clear(); state.filmSelected.add(itemIdx); loadPhoto(item.photoIndex); } };
      div.appendChild(thumb); strip.appendChild(div);
    } else {
      const div = document.createElement('div'); div.className = 'film-item'; const card = document.createElement('div'); card.className = 'film-card' + (state.filmSelected.has(itemIdx) ? ' film-selected' : '');
      card.innerHTML = `<span class="film-card-drag">⠿</span><button class="film-card-toggle">${item.cardMode==='code'?'##':'📁'}</button><input class="film-card-input" value="${item.text||''}" placeholder="${item.cardMode==='code'?'Code':'Group'}"><button class="film-card-del">✕</button>`;
      card.querySelector('.film-card-drag').onmousedown = e => startDrag(e, itemIdx, item.text || 'Card');
      card.querySelector('.film-card-toggle').onclick = () => { item.cardMode = item.cardMode==='code'?'group':'code'; renderFilmstrip(); };
      card.querySelector('.film-card-input').oninput = e => { item.text = e.target.value; validateCards(); };
      card.querySelector('.film-card-del').onclick = () => { state.filmItems.splice(itemIdx, 1); renderFilmstrip(); };
      div.appendChild(card); strip.appendChild(div);
    }
    strip.appendChild(makeDropZone(itemIdx + 1));
  });
}

function makeDropZone(pos) { const dz = document.createElement('div'); dz.className = 'film-drop-zone'; dz.dataset.insertBefore = pos; const btn = document.createElement('button'); btn.className = 'film-gap-btn'; btn.textContent = '+'; btn.onclick = () => { state.filmItems.splice(pos, 0, { type: 'card', id: Date.now(), text: '', cardMode: 'group' }); renderFilmstrip(); }; dz.appendChild(btn); return dz; }

const drag = { active: false, srcItemIdx: null, startY: 0, ghost: null, lastDropZone: null };
function startDrag(e, idx, lbl) { drag.srcItemIdx = idx; drag.startY = e.clientY; const g = document.getElementById('drag-ghost'); g.textContent = lbl; drag.ghost = g; }
document.addEventListener('mousemove', e => {
  if (drag.srcItemIdx === null) return;
  if (!drag.active && Math.abs(e.clientY - drag.startY) > 5) drag.active = true;
  if (drag.active) { drag.ghost.style.display = 'block'; drag.ghost.style.left = e.clientX + 10 + 'px'; drag.ghost.style.top = e.clientY + 10 + 'px'; const dz = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList.contains('film-drop-zone')); if (drag.lastDropZone) drag.lastDropZone.classList.remove('drag-over'); if (dz) { dz.classList.add('drag-over'); drag.lastDropZone = dz; } }
});
document.addEventListener('mouseup', e => {
  if (drag.srcItemIdx !== null && drag.active && drag.lastDropZone) { let dest = parseInt(drag.lastDropZone.dataset.insertBefore); if (dest > drag.srcItemIdx) dest--; const it = state.filmItems.splice(drag.srcItemIdx, 1)[0]; state.filmItems.splice(dest, 0, it); renderFilmstrip(); }
  drag.srcItemIdx = null; drag.active = false; if (drag.ghost) drag.ghost.style.display = 'none'; if (drag.lastDropZone) drag.lastDropZone.classList.remove('drag-over');
});

function insertCardAt(insertBefore, prefill) {
  const newCard = { type: 'card', id: Date.now() + Math.random(), text: prefill?.text || '', cardMode: prefill?.cardMode || 'group' };
  state.filmItems.splice(insertBefore, 0, newCard);
  renderFilmstrip();
  if (!prefill?.text) {
    setTimeout(() => {
      const strip = document.getElementById('filmstrip');
      let cardCount = 0;
      for (let i = 0; i < state.filmItems.length; i++) {
        if (state.filmItems[i] && state.filmItems[i].type === 'card') {
          if (i === insertBefore) {
            const cards = strip.querySelectorAll('.film-card-input');
            if (cards[cardCount]) cards[cardCount].focus();
            break;
          }
          cardCount++;
        }
      }
    }, 50);
  }
}

document.getElementById('btnAddCardTop').onclick = () => {
  // Original had a quick-add popup, but here we'll use a simple insert for now
  // or restore the quick-add popup logic if it's in index.html
  insertCardAt(0);
  document.getElementById('filmstrip').scrollTop = 0;
};

function deletePhoto(photoIndex) {
  const deletedSnapshot = {
    photo: state.photos[photoIndex],
    photoIndex: photoIndex,
    filmItems: JSON.parse(JSON.stringify(state.filmItems)),
    currentIndex: state.currentIndex
  };
  state.deletedPhotoStack.push(deletedSnapshot);
  if (state.deletedPhotoStack.length > 10) state.deletedPhotoStack.shift();

  state.filmItems = state.filmItems.filter(it => !(it.type === 'photo' && it.photoIndex === photoIndex));
  state.photos.splice(photoIndex, 1);
  state.filmItems.forEach(it => {
    if (it.type === 'photo' && it.photoIndex > photoIndex) it.photoIndex--;
  });
  if (state.currentIndex === photoIndex) {
    const newIdx = Math.min(photoIndex, state.photos.length - 1);
    if (newIdx >= 0) loadPhoto(newIdx);
    else {
      state.currentIndex = -1;
      document.getElementById('canvas-wrap').style.display = 'none';
      document.getElementById('no-photo-msg').style.display = '';
    }
  } else if (state.currentIndex > photoIndex) {
    state.currentIndex--;
  }
  validateCards();
  renderFilmstrip();
  updateStatusRight();
  setStatus(`Photo removed. ${state.photos.length} photo(s) remaining. Ctrl+Z to undo.`);
}

function undoDeletePhoto() {
  if (!state.deletedPhotoStack.length) return false;
  const snap = state.deletedPhotoStack.pop();
  state.photos.splice(snap.photoIndex, 0, snap.photo);
  state.filmItems = snap.filmItems;
  validateCards();
  renderFilmstrip();
  updateStatusRight();
  setStatus(`Photo restored: ${snap.photo.name}`);
  showToast('Photo restored ✓', '#1a6a3a');
  return true;
}

function getItemRole(item) {
  if (item.type === 'card') {
    const txt = (item.text || '').trim();
    if (!txt) return null;
    if (item.cardMode === 'code') {
      const raw = txt.replace(/##/g, ' ').trim();
      const nums = raw.match(/\d+/g);
      if (nums) return { role: 'codes', codes: nums.map(Number) };
      return null;
    }
    if (/^(group|report)\s/i.test(txt)) return { role: 'group', name: txt.replace(/^(group|report)\s+/i,'').trim() };
    return { role: 'group', name: txt };
  } else if (item.type === 'photo') {
    const photo = state.photos[item.photoIndex];
    if (!photo) return { role: 'photo' };
    if (photo.aiType === 'group-start' || photo.isGroupStart) return { role: 'group', name: photo.groupName || 'Group' };
    if (photo.aiType === 'code-card' || photo.isCodeCard) return { role: 'codes', codes: photo.codes || [] };
    return { role: 'photo' };
  }
  return null;
}

function validateCards() {
  state.filmItems.forEach(item => { if (item.type === 'card') item._warn = null; });
  state.photos.forEach(p => { p._cardState = null; });
  let openGroupIdx = null, groupHasCode = false, photosInGroup = [];
  for (let i = 0; i < state.filmItems.length; i++) {
    const item = state.filmItems[i], role = getItemRole(item);
    if (!role) continue;
    if (role.role === 'group') {
      if (openGroupIdx !== null && !groupHasCode && photosInGroup.length > 0) {
        const prev = state.filmItems[openGroupIdx];
        if (prev.type === 'card') prev._warn = 'no-code';
        else if (state.photos[prev.photoIndex]) state.photos[prev.photoIndex]._cardState = 'needs-code';
        photosInGroup.forEach(pi => { if (state.photos[pi]) state.photos[pi]._cardState = 'needs-code'; });
      }
      openGroupIdx = i; groupHasCode = false; photosInGroup = [];
    } else if (role.role === 'codes') {
      if (openGroupIdx === null) { if (item.type === 'card') item._warn = 'no-group'; }
      else { groupHasCode = true; photosInGroup.forEach(pi => { if (state.photos[pi]) state.photos[pi]._cardState = 'ok'; }); openGroupIdx = null; groupHasCode = false; photosInGroup = []; }
    } else if (role.role === 'photo' && openGroupIdx !== null) {
      photosInGroup.push(item.photoIndex); if (state.photos[item.photoIndex]) state.photos[item.photoIndex]._cardState = 'in-group';
    }
  }
}

function applyCards() {
  validateCards();
  const warnings = state.filmItems.filter(it => it.type === 'card' && it._warn).map(it => it._warn === 'no-code' ? `"${it.text}" — No code card` : `"${it.text}" — No group card`);
  if (warnings.length) setStatus(`⚠️ Card issues: ${warnings.join(' | ')}`);
  state.redSummary = [];
  let currentGroupPhotos = [], pendingCodes = [], inGroup = false, currentGroupName = null, changed = 0;
  const flushGroup = () => {
    if (!currentGroupPhotos.length) return;
    const isLabelOnly = !pendingCodes.length || pendingCodes.includes(0);
    let parts = [], hasSafety = false;
    if (!isLabelOnly) pendingCodes.forEach(num => { const code = state.problemCodes[num]; if (code && code.caption !== 'STICKER_READ' && code.caption !== 'GROUP_LABEL') { if (code.safety) hasSafety = true; parts.push(code.caption); } });
    const captionText = (isLabelOnly || !parts.length) ? (currentGroupName || 'Unlabeled') : (hasSafety ? 'Safety Issue - ' : '') + parts.join(' - ');
    const captionColor = (isLabelOnly || !parts.length) ? 'black' : 'red';
    currentGroupPhotos.forEach((photoIdx, viewNum) => {
      const photo = state.photos[photoIdx]; if (!photo) return;
      const text = viewNum === 0 ? captionText : `View ${viewNum + 1} - ${captionText}`;
      const color = viewNum === 0 ? captionColor : 'black';
      photo.caption = { text, color, fontSize: photo.caption?.fontSize || getDefaultCaptionFont(), centered: true, x: 0, y: -1 };
      if (color === 'red' && viewNum === 0) addToRedSummary(photo.name, text);
      changed++;
    });
  };
  for (const item of state.filmItems) {
    const role = getItemRole(item); if (!role) continue;
    if (role.role === 'group') { flushGroup(); inGroup = true; currentGroupName = role.name; currentGroupPhotos = []; pendingCodes = []; }
    else if (role.role === 'codes') { role.codes.forEach(n => { if (!pendingCodes.includes(n)) pendingCodes.push(n); }); flushGroup(); inGroup = false; }
    else if (role.role === 'photo' && inGroup) {
      const photo = state.photos[item.photoIndex];
      if (photo && !photo.isGroupStart && !photo.isCodeCard) currentGroupPhotos.push(item.photoIndex);
    }
  }
  flushGroup(); renderFilmstrip(); renderRedSummary(); setStatus(`Apply Cards: ${changed} updated`);
}

function loadPhoto(index) {
  if (index < 0 || index >= state.photos.length) return;
  state.currentIndex = index; state.filmSelectAnchor = index;
  const photo = state.photos[index], img = new Image();
  img.onload = () => {
    const area = document.getElementById('canvas-area'), maxW = area.clientWidth - 8, maxH = area.clientHeight - 8;
    state.scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const W = Math.round(img.width * state.scale), H = Math.round(img.height * state.scale);
    [mainCanvas, overlayCanvas, interactCanvas].forEach(c => { c.width = W; c.height = H; });
    canvasWrap.style.width = W + 'px'; canvasWrap.style.height = H + 'px';
    ctx.drawImage(img, 0, 0, W, H); canvasWrap.style.display = 'block'; document.getElementById('no-photo-msg').style.display = 'none';
    photo._W = W; photo._H = H;
    if (!photo.caption) photo.caption = { text: '', color: 'black', fontSize: getDefaultCaptionFont(), x: 0, y: -1, centered: true };
    document.getElementById('caption-text').value = photo.caption.text || '';
    document.getElementById('captionFontSize').value = photo.caption.fontSize || getDefaultCaptionFont();
    setCaptionColor(photo.caption.color || 'black');
    
    // Auto-switch code filter logic
    const folderToCat = { 'Roofing': 'Roofing', 'Exterior': 'Exterior', 'Garage': 'Garage', 'Interiors': 'Interiors', 'Structural': 'Structural Components', 'Plumbing': 'Plumbing System', 'Electrical': 'Electrical System', 'HVAC': 'Heating / Central Air Conditioning', 'Insulation': 'Insulation and Ventilation', 'Kitchen': 'Built-In Kitchen Appliances' };
    let autoSwitchCat = folderToCat[state.sortAssignments[index]] || null;
    if (!autoSwitchCat) {
      const myItemIdx = state.filmItems.findIndex(it => it.type === 'photo' && it.photoIndex === index);
      for (let k = myItemIdx - 1; k >= 0; k--) {
        const it = state.filmItems[k]; if (it.type === 'card' && it.cardMode === 'group' && it.text) { autoSwitchCat = folderToCat[it.text.trim()] || null; break; }
      }
    }
    document.getElementById('codes-cat-filter').value = autoSwitchCat || 'ALL'; renderCodesList();
    renderAnnotations(); renderFilmstrip(); setStatus(`Photo ${index + 1}/${state.photos.length}: ${photo.name}`); updateStatusRight();
  };
  img.src = photo.url;
}

function renderAnnotations() {
  const photo = state.photos[state.currentIndex]; if (!photo) return;
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  photo.annotations.forEach(ann => drawAnnotation(octx, ann));
  if (photo.caption && photo.caption.text) drawCaption(octx, photo.caption);
}

function drawAnnotation(c, ann) {
  c.save(); c.strokeStyle = '#CC0000'; c.fillStyle = '#CC0000'; c.lineWidth = Math.max(2, 3 * state.scale);
  if (ann.type === 'rect') c.strokeRect(ann.x, ann.y, ann.w, ann.h);
  else if (ann.type === 'circle') { c.beginPath(); c.ellipse(ann.cx, ann.cy, Math.abs(ann.rx), Math.abs(ann.ry), 0, 0, Math.PI * 2); c.stroke(); }
  else if (ann.type.startsWith('arrow')) drawArrow(c, ann);
  c.restore();
}

function drawArrow(c, ann) {
  const sz = ann.size || 64, hw = sz * .5, hh = sz * .42, bh = sz * .22, bw = sz * .55;
  c.save(); c.translate(ann.x, ann.y); c.fillStyle = '#CC0000'; c.beginPath();
  const dir = ann.type.replace('arrow-', '');
  if (dir === 'left') { c.moveTo(-hw, 0); c.lineTo(0, -hh); c.lineTo(0, -bh); c.lineTo(bw, -bh); c.lineTo(bw, bh); c.lineTo(0, bh); c.lineTo(0, hh); }
  else if (dir === 'right') { c.moveTo(hw, 0); c.lineTo(0, -hh); c.lineTo(0, -bh); c.lineTo(-bw, -bh); c.lineTo(-bw, bh); c.lineTo(0, bh); c.lineTo(0, hh); }
  else if (dir === 'up') { c.moveTo(0, -hw); c.lineTo(-hh, 0); c.lineTo(-bh, 0); c.lineTo(-bh, bw); c.lineTo(bh, bw); c.lineTo(bh, 0); c.lineTo(hh, 0); }
  else if (dir === 'down') { c.moveTo(0, hw); c.lineTo(-hh, 0); c.lineTo(-bh, 0); c.lineTo(-bh, -bw); c.lineTo(bh, -bw); c.lineTo(bh, 0); c.lineTo(hh, 0); }
  c.closePath(); c.fill(); c.restore();
}

// DrawCaption and WrapText are already in app.js

function populateCodesFilter() {
  const sel = document.getElementById('codes-cat-filter'); sel.innerHTML = '<option value="ALL">— All Categories —</option>';
  Object.entries(CODE_CATEGORIES).forEach(([code, cat]) => { const opt = document.createElement('option'); opt.value = cat; opt.textContent = cat; sel.appendChild(opt); });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') { e.preventDefault(); if (state.deletedPhotoStack.length) undoDeletePhoto(); else document.getElementById('btnUndo').click(); } }
});

async function init() {
  loadProblemCodes(); populateCodesFilter();
  if (state.photos.length) loadPhoto(0);
}
init();
