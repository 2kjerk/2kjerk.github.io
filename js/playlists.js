window.Playlists = {
  STORAGE_KEY: 'fsv-playlists-v1',
  TS_KEY: 'fsv-playlists-v1-ts',
  IDB_NAME: 'fsv-playlists-db',
  IDB_STORE: 'playlists',
  LEGACY_DEFAULT_COVER: 'images/logo.png',
  COVER_OUTPUT_SIZE: 512,
  MAX_PLAYLISTS: 10,

  playlists: [],
  selectedPlaylistId: null,

  _pendingTrack: null,
  _ctxTrack: null,
  _ctxPlaylistId: null,
  _ctxTrackIdx: -1,
  _nameMode: 'create',
  _renameId: null,
  _addAfterCreate: null,
  _draftCover: null,
  _draftCoverTouched: false,
  _confirmAction: null,
  _placeholderCache: {},
  _crop: null,

  init() {
    this.loadFromStorage();
    this.syncBodyClass();
    this.bindEvents();
    this.bindCropper();
    this.renderGrid();
    this.reconcileWithIdb();

    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY) {
        this.loadFromStorage();
        this._afterExternalChange();
      }
    });
  },

  _normalizePlaylist(p) {
    if (!p || typeof p.id !== 'string' || typeof p.title !== 'string') return null;

    let cover = (typeof p.cover === 'string' && p.cover) ? p.cover : null;
    if (cover && /(^|\/)logo[^/]*\.(png|jpe?g|webp|svg)$/i.test(cover.split('?')[0])) cover = null;

    const seen = new Set();
    const tracks = [];
    (Array.isArray(p.tracks) ? p.tracks : []).forEach(t => {
      if (!t || typeof t.src !== 'string' || !t.src || seen.has(t.src)) return;
      seen.add(t.src);
      tracks.push({
        title: t.title || 'Untitled',
        src: t.src,
        sourceProjectId: t.sourceProjectId || null,
        sourceProjectTitle: t.sourceProjectTitle || null
      });
    });

    return {
      id: p.id,
      title: p.title,
      cover,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      tracks
    };
  },

  _normalizeList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(p => this._normalizePlaylist(p)).filter(Boolean);
  },

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.playlists = raw ? this._normalizeList(JSON.parse(raw)) : [];
    } catch (e) {
      this.playlists = [];
    }
  },

  saveToStorage() {
    const savedAt = Date.now();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.playlists));
      localStorage.setItem(this.TS_KEY, String(savedAt));
    } catch (e) {
      console.warn('Could not save playlists to localStorage:', e);
    }
    this.mirrorToIdb(savedAt);
    this.syncBodyClass();
  },

  _openIdb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(this.IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.IDB_STORE)) {
          db.createObjectStore(this.IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  mirrorToIdb(savedAt) {
    const snapshot = JSON.parse(JSON.stringify(this.playlists));
    this._openIdb().then(db => {
      const tx = db.transaction(this.IDB_STORE, 'readwrite');
      tx.objectStore(this.IDB_STORE).put({ key: 'all', data: snapshot, savedAt: savedAt || Date.now() });
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
      tx.onabort = () => db.close();
    }).catch(() => {});
  },

  reconcileWithIdb() {
    this._openIdb().then(db => {
      const tx = db.transaction(this.IDB_STORE, 'readonly');
      const req = tx.objectStore(this.IDB_STORE).get('all');
      req.onsuccess = () => {
        const record = req.result;
        db.close();
        if (!record || !Array.isArray(record.data)) return;

        let localTs = 0;
        try { localTs = Number(localStorage.getItem(this.TS_KEY)) || 0; } catch (e) {}

        const idbNewer = (record.savedAt || 0) > localTs;
        const localEmptyIdbHasData = this.playlists.length === 0 && record.data.length > 0;
        if (!idbNewer && !localEmptyIdbHasData) return;

        this.playlists = this._normalizeList(record.data);
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.playlists));
          localStorage.setItem(this.TS_KEY, String(record.savedAt || Date.now()));
        } catch (e) {}
        this._afterExternalChange();
      };
      req.onerror = () => db.close();
    }).catch(() => {});
  },

  _afterExternalChange() {
    this.syncBodyClass();
    this.renderGrid();
    if (window.Player && Player.currentProject && String(Player.currentProject.id).startsWith('pl-')) {
      Player.syncQueue(Player.currentProject.id);
    }
    if (this.selectedPlaylistId) {
      const pl = this.get(this.selectedPlaylistId);
      if (pl) this.renderDetail(pl);
      else {
        this.selectedPlaylistId = null;
        Sidebar.showPlaylists();
      }
    }
  },

  syncBodyClass() {
    document.body.classList.toggle('has-playlists', this.playlists.length > 0);
    this.syncCreateButtons();
  },

  atLimit() {
    return this.playlists.length >= this.MAX_PLAYLISTS;
  },

  nameTaken(name, exceptId = null) {
    const key = String(name || '').trim().toLowerCase();
    return this.playlists.some(p => p.id !== exceptId && p.title.trim().toLowerCase() === key);
  },

  syncCreateButtons() {
    const full = this.atLimit();
    ['#create-playlist-btn', '#empty-create-playlist-btn'].forEach(sel => {
      const btn = Utils.$(sel);
      if (!btn) return;
      btn.disabled = full;
      btn.classList.toggle('is-disabled', full);
      if (full) btn.title = `Maximum of ${this.MAX_PLAYLISTS} playlists`;
      else btn.removeAttribute('title');
    });
  },

  _setNameError(msg) {
    const el = Utils.$('#playlist-name-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  },

  getAll() {
    return this.playlists;
  },

  get(id) {
    return this.playlists.find(p => p.id === id) || null;
  },

  placeholderCover(id) {
    const key = String(id || 'x');
    if (this._placeholderCache[key]) return this._placeholderCache[key];
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    const h2 = (h + 45) % 360;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',38%,27%)"/>' +
      '<stop offset="1" stop-color="hsl(' + h2 + ',42%,11%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="400" fill="url(#g)"/>' +
      '<g transform="translate(112 112) scale(7)" fill="none" stroke="rgba(255,255,255,0.42)" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' +
      '</g></svg>';
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    this._placeholderCache[key] = url;
    return url;
  },

  coverFor(pl) {
    return (pl && pl.cover) ? pl.cover : this.placeholderCover(pl ? pl.id : '');
  },

  _setImg(img, pl) {
    if (!img) return;
    img.onerror = () => {
      img.onerror = null;
      img.src = this.placeholderCover(pl.id);
    };
    img.src = this.coverFor(pl);
  },

  getProject(id) {
    const pl = this.get(id);
    if (!pl) return null;
    return {
      id: pl.id,
      title: pl.title,
      cover: this.coverFor(pl),
      coverFallback: null,
      durationText: '',
      tracks: pl.tracks
    };
  },

  _commit(pl) {
    if (window.Player) Player.syncQueue(pl.id);
    this.saveToStorage();
    this.renderGrid();
    if (this.selectedPlaylistId === pl.id) this.renderDetail(pl);
  },

  create(name, cover = null) {
    const clean = String(name || '').trim();
    if (!clean || !cover) return null;
    if (this.atLimit() || this.nameTaken(clean)) return null;
    const pl = {
      id: 'pl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      title: clean,
      cover: cover || null,
      createdAt: Date.now(),
      tracks: []
    };
    this.playlists.push(pl);
    this.saveToStorage();
    this.renderGrid();
    return pl;
  },

  rename(id, newName) {
    const pl = this.get(id);
    const clean = String(newName || '').trim();
    if (!pl || !clean || this.nameTaken(clean, id)) return false;
    pl.title = clean;
    this._commit(pl);
    return true;
  },

  setCover(id, dataUrl) {
    const pl = this.get(id);
    if (!pl || !dataUrl) return false;
    pl.cover = dataUrl;
    this._commit(pl);
    return true;
  },

  delete(id) {
    const idx = this.playlists.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.playlists.splice(idx, 1);
    this.saveToStorage();
    this.renderGrid();
    if (this.selectedPlaylistId === id) {
      this.selectedPlaylistId = null;
      Sidebar.showPlaylists();
    }
    return true;
  },

  addTrack(playlistId, trackInfo) {
    const pl = this.get(playlistId);
    if (!pl || !trackInfo || !trackInfo.src) return { added: false, reason: 'invalid' };
    if (pl.tracks.some(t => t.src === trackInfo.src)) {
      return { added: false, reason: 'duplicate' };
    }
    pl.tracks.push({
      title: trackInfo.title || 'Untitled',
      src: trackInfo.src,
      sourceProjectId: trackInfo.sourceProjectId || null,
      sourceProjectTitle: trackInfo.sourceProjectTitle || null
    });
    this._commit(pl);
    return { added: true };
  },

  removeTrack(playlistId, trackIdx, expectedSrc) {
    const pl = this.get(playlistId);
    if (!pl || trackIdx < 0 || trackIdx >= pl.tracks.length) return false;
    if (expectedSrc && pl.tracks[trackIdx].src !== expectedSrc) {
      trackIdx = pl.tracks.findIndex(t => t.src === expectedSrc);
      if (trackIdx === -1) return false;
    }
    pl.tracks.splice(trackIdx, 1);
    this._commit(pl);
    return true;
  },

  _open(modal) {
    if (!modal) return;
    Utils.show(modal);
    this._syncScrollLock();
  },

  _close(modal) {
    if (!modal) return;
    Utils.hide(modal);
    this._syncScrollLock();
  },

  _syncScrollLock() {
    const anyOpen = !!document.querySelector('.app-modal:not(.hidden)');
    document.body.classList.toggle('modal-open', anyOpen);
  },

  _canHover() {
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  },

  bindEvents() {
    const createBtn = Utils.$('#create-playlist-btn');
    const emptyCreateBtn = Utils.$('#empty-create-playlist-btn');
    if (createBtn) createBtn.addEventListener('click', () => this.openNameModal('create'));
    if (emptyCreateBtn) emptyCreateBtn.addEventListener('click', () => this.openNameModal('create'));

    const backBtn = Utils.$('#playlist-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => Sidebar.showPlaylists());

    const playAllBtn = Utils.$('#playlist-play-all-btn');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        const pl = this.get(this.selectedPlaylistId);
        if (pl && pl.tracks.length) Player.loadAndPlay(pl.id, 0);
      });
    }

    const shufflePlayBtn = Utils.$('#playlist-shuffle-play-btn');
    if (shufflePlayBtn) {
      shufflePlayBtn.addEventListener('click', () => {
        const pl = this.get(this.selectedPlaylistId);
        if (!pl) return;
        if (!pl.tracks.length) return;
        if (!Player.shuffleOn) Player.toggleShuffle();
        const randomIdx = Math.floor(Math.random() * pl.tracks.length);
        Player.loadAndPlay(pl.id, randomIdx);
      });
    }

    const renameBtn = Utils.$('#playlist-rename-btn');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => {
        if (this.selectedPlaylistId) this.openNameModal('rename', this.selectedPlaylistId);
      });
    }

    const deleteBtn = Utils.$('#playlist-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const pl = this.get(this.selectedPlaylistId);
        if (!pl) return;
        this.openConfirm({
          title: 'Delete playlist?',
          text: `please confirm you really want to delete "${pl.title}"`,
          confirmLabel: 'Delete',
          onConfirm: () => {
            this.delete(pl.id);
          }
        });
      });
    }

    const nameForm = Utils.$('#playlist-name-form');
    if (nameForm) {
      nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitNameModal();
      });
    }
    ['#playlist-name-close', '#playlist-name-cancel', '#playlist-name-backdrop'].forEach(sel => {
      const el = Utils.$(sel);
      if (el) el.addEventListener('click', () => this.closeNameModal());
    });

    const nameInput = Utils.$('#playlist-name-input');
    if (nameInput) nameInput.addEventListener('input', () => this._setNameError(''));

    const picker = Utils.$('#playlist-cover-picker');
    const chooseBtn = Utils.$('#playlist-cover-choose');
    const modalFile = Utils.$('#playlist-modal-file');

    const pickFile = () => { if (modalFile) { modalFile.value = ''; modalFile.click(); } };
    if (picker) picker.addEventListener('click', pickFile);
    if (chooseBtn) chooseBtn.addEventListener('click', pickFile);
    if (modalFile) {
      modalFile.addEventListener('change', () => {
        const file = modalFile.files && modalFile.files[0];
        if (file) this.chooseDraftCover(file);
      });
    }
    if (picker) {
      ['dragenter', 'dragover'].forEach(type => picker.addEventListener(type, (e) => {
        e.preventDefault();
        picker.classList.add('is-dragover');
      }));
      ['dragleave', 'drop'].forEach(type => picker.addEventListener(type, (e) => {
        e.preventDefault();
        picker.classList.remove('is-dragover');
      }));
      picker.addEventListener('drop', (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) this.chooseDraftCover(file);
      });
    }

    const addClose = Utils.$('#add-to-playlist-close');
    const addBackdrop = Utils.$('#add-to-playlist-backdrop');
    if (addClose) addClose.addEventListener('click', () => this.closeAddModal());
    if (addBackdrop) addBackdrop.addEventListener('click', () => this.closeAddModal());

    const confirmOk = Utils.$('#confirm-ok');
    const confirmCancel = Utils.$('#confirm-cancel');
    const confirmBackdrop = Utils.$('#confirm-backdrop');
    if (confirmOk) {
      confirmOk.addEventListener('click', () => {
        const action = this._confirmAction;
        this.closeConfirm();
        if (action) action();
      });
    }
    if (confirmCancel) confirmCancel.addEventListener('click', () => this.closeConfirm());
    if (confirmBackdrop) confirmBackdrop.addEventListener('click', () => this.closeConfirm());

    const artBox = Utils.$('#playlist-art-box');
    const fileInput = Utils.$('#playlist-cover-input');

    if (artBox && fileInput) {
      const openPicker = () => { fileInput.value = ''; fileInput.click(); };
      artBox.addEventListener('click', (e) => {
        openPicker();
      });
      artBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        const plId = this.selectedPlaylistId;
        if (!file || !plId) return;
        const dataUrl = await this.openCropper(file);
        if (dataUrl && this.get(plId)) {
          this.setCover(plId, dataUrl);
        }
      });
    }

    const ctxAdd = Utils.$('#ctx-add-to-playlist');
    const ctxRemove = Utils.$('#ctx-remove-from-playlist');
    if (ctxAdd) {
      ctxAdd.addEventListener('click', () => {
        const track = this._ctxTrack;
        this.hideContextMenu();
        if (track) this.openAddModal(track);
      });
    }
    if (ctxRemove) {
      ctxRemove.addEventListener('click', () => {
        const plId = this._ctxPlaylistId;
        const idx = this._ctxTrackIdx;
        const src = this._ctxTrack ? this._ctxTrack.src : null;
        this.hideContextMenu();
        if (plId && idx > -1) this.removeTrack(plId, idx, src);
      });
    }

    document.addEventListener('click', (e) => {
      const menu = Utils.$('#track-context-menu');
      if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('scroll', () => this.hideContextMenu(), true);
    window.addEventListener('resize', () => this.hideContextMenu());

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this._crop) { this.closeCropper(null); return; }
      const confirmModal = Utils.$('#confirm-modal');
      if (confirmModal && !confirmModal.classList.contains('hidden')) { this.closeConfirm(); return; }
      const nameModal = Utils.$('#playlist-name-modal');
      if (nameModal && !nameModal.classList.contains('hidden')) { this.closeNameModal(); return; }
      const addModal = Utils.$('#add-to-playlist-modal');
      if (addModal && !addModal.classList.contains('hidden')) { this.closeAddModal(); return; }
      this.hideContextMenu();
    });
  },

  openNameModal(mode = 'create', playlistId = null, options = {}) {
    if (mode !== 'rename' && this.atLimit()) return;
    this._nameMode = mode;
    this._renameId = playlistId;
    this._addAfterCreate = options.addTrack || null;
    this._draftCoverTouched = false;

    const modal = Utils.$('#playlist-name-modal');
    const titleEl = Utils.$('#playlist-name-modal-title');
    const submitBtn = Utils.$('#playlist-name-submit');
    const input = Utils.$('#playlist-name-input');
    if (!modal || !input) return;

    if (mode === 'rename' && playlistId) {
      const pl = this.get(playlistId);
      if (titleEl) titleEl.textContent = 'Edit Playlist';
      if (submitBtn) submitBtn.textContent = 'Save';
      input.value = pl ? pl.title : '';
      this._draftCover = pl ? pl.cover : null;
    } else {
      if (titleEl) titleEl.textContent = 'Create Playlist';
      if (submitBtn) submitBtn.textContent = 'Create';
      input.value = '';
      this._draftCover = null;
    }

    this._setNameError('');
    this.renderCoverPicker();
    this._open(modal);

    if (this._canHover()) {
      setTimeout(() => { input.focus(); input.select(); }, 30);
    }
  },

  closeNameModal() {
    this._close(Utils.$('#playlist-name-modal'));
    this._addAfterCreate = null;
  },

  renderCoverPicker() {
    const preview = Utils.$('#playlist-cover-preview');
    const empty = Utils.$('#playlist-cover-empty');
    const edit = Utils.$('#playlist-cover-edit-badge');
    const chooseBtn = Utils.$('#playlist-cover-choose');
    const has = !!this._draftCover;
    const picker = Utils.$('#playlist-cover-picker');
    if (picker) picker.classList.toggle('has-image', has);

    if (preview) {
      if (has) preview.src = this._draftCover;
      else preview.removeAttribute('src');
      preview.classList.toggle('hidden', !has);
    }
    if (empty) empty.classList.toggle('hidden', has);
    if (edit) edit.classList.toggle('hidden', !has);
    if (chooseBtn) chooseBtn.textContent = has ? 'change picture' : 'upload picture';
    const hint = Utils.$('#playlist-cover-hint');
    if (hint) {
      hint.classList.remove('is-error');
      hint.textContent = 'upload a pic. png, jpg or webp';
    }
  },

  async chooseDraftCover(file) {
    const dataUrl = await this.openCropper(file);
    if (!dataUrl) return;
    this._draftCover = dataUrl;
    this._draftCoverTouched = true;
    this.renderCoverPicker();
  },

  submitNameModal() {
    const input = Utils.$('#playlist-name-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
      if (input) input.focus();
      return;
    }
    const exceptId = (this._nameMode === 'rename') ? this._renameId : null;
    if (this._nameMode !== 'rename' && this.atLimit()) {
      this._setNameError(`You can have up to ${this.MAX_PLAYLISTS} playlists. Delete one to make a new one.`);
      return;
    }
    if (this.nameTaken(val, exceptId)) {
      this._setNameError('you already have a playlist with that name');
      if (input) input.focus();
      return;
    }
    if (!this._draftCover) {
      const hint = Utils.$('#playlist-cover-hint');
      if (hint) {
        hint.textContent = 'upload a picture for this playlist.';
        hint.classList.add('is-error');
      }
      const picker = Utils.$('#playlist-cover-picker');
      if (picker) picker.focus();
      return;
    }

    if (this._nameMode === 'rename' && this._renameId) {
      const pl = this.get(this._renameId);
      if (pl) {
        pl.title = val;
        if (this._draftCoverTouched) pl.cover = this._draftCover;
        this._commit(pl);
      }
    } else {
      const pl = this.create(val, this._draftCover);
      if (pl && this._addAfterCreate) {
        this.addTrack(pl.id, this._addAfterCreate);
      }
    }
    this.closeNameModal();
  },

  openConfirm({ title, text, confirmLabel, onConfirm }) {
    const modal = Utils.$('#confirm-modal');
    if (!modal) { if (onConfirm) onConfirm(); return; }
    const t = Utils.$('#confirm-title');
    const p = Utils.$('#confirm-text');
    const ok = Utils.$('#confirm-ok');
    if (t) t.textContent = title || 'Are you sure?';
    if (p) p.textContent = text || '';
    if (ok) ok.textContent = confirmLabel || 'Confirm';
    this._confirmAction = onConfirm || null;
    this._open(modal);
  },

  closeConfirm() {
    this._close(Utils.$('#confirm-modal'));
    this._confirmAction = null;
  },

  openAddModal(trackInfo) {
    this._pendingTrack = trackInfo;

    const modal = Utils.$('#add-to-playlist-modal');
    const trackNameEl = Utils.$('#add-to-playlist-track-name');
    const listEl = Utils.$('#add-to-playlist-list');
    if (!modal || !listEl) return;

    if (trackNameEl) trackNameEl.textContent = Utils.displayTitle(trackInfo.title || '');

    listEl.innerHTML = '';

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'add-to-playlist-item add-to-playlist-new';
    newBtn.innerHTML = `
      <span class="add-to-playlist-thumb add-to-playlist-new-thumb" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
      </span>
      <div class="add-to-playlist-info"><div class="add-to-playlist-name">New playlist</div></div>
    `;
    newBtn.addEventListener('click', () => {
      const track = this._pendingTrack;
      this.closeAddModal();
      this.openNameModal('create', null, { addTrack: track });
    });
    if (!this.atLimit()) listEl.appendChild(newBtn);

    this.playlists.forEach(pl => {
      const alreadyIn = pl.tracks.some(t => t.src === trackInfo.src);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `add-to-playlist-item${alreadyIn ? ' is-added' : ''}`;
      btn.innerHTML = `
        <img class="add-to-playlist-thumb" alt="">
        <div class="add-to-playlist-info">
          <div class="add-to-playlist-name">${Utils.escapeHtml(pl.title)}</div>
        </div>
        <span class="add-to-playlist-status">${alreadyIn ? 'Added' : '+ Add'}</span>
      `;
      this._setImg(btn.querySelector('img'), pl);

      btn.addEventListener('click', () => {
        this.addTrack(pl.id, trackInfo);
        this.closeAddModal();
      });

      listEl.appendChild(btn);
    });

    this._open(modal);
  },

  closeAddModal() {
    this._close(Utils.$('#add-to-playlist-modal'));
    this._pendingTrack = null;
  },

  attachTrackActions(rowEl, trackInfo, options = {}) {
    if (!rowEl || !trackInfo) return;

    const moreBtn = rowEl.querySelector('.track-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (options.playlistId) {
          const r = moreBtn.getBoundingClientRect();
          this.showContextMenu(r.right, r.bottom + 4, trackInfo, { ...options, alignRight: true });
        } else {
          this.openAddModal(trackInfo);
        }
      });
    }

    rowEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e.clientX, e.clientY, trackInfo, options);
    });
  },

  showContextMenu(x, y, trackInfo, options = {}) {
    const menu = Utils.$('#track-context-menu');
    const removeBtn = Utils.$('#ctx-remove-from-playlist');
    if (!menu) return;

    this._ctxTrack = trackInfo;
    this._ctxPlaylistId = options.playlistId || null;
    this._ctxTrackIdx = typeof options.trackIdx === 'number' ? options.trackIdx : -1;

    if (removeBtn) {
      if (this._ctxPlaylistId && this._ctxTrackIdx > -1) Utils.show(removeBtn);
      else Utils.hide(removeBtn);
    }

    Utils.show(menu);

    const rect = menu.getBoundingClientRect();
    const pad = 8;
    const startX = options.alignRight ? x - rect.width : x;
    const left = Math.min(startX, window.innerWidth - rect.width - pad);
    const top = Math.min(y, window.innerHeight - rect.height - pad);
    menu.style.left = Math.max(pad, left) + 'px';
    menu.style.top = Math.max(pad, top) + 'px';
  },

  hideContextMenu() {
    const menu = Utils.$('#track-context-menu');
    if (menu) Utils.hide(menu);
  },

  _songCountText(pl) {
    const n = pl.tracks.length;
    return `${n} ${n === 1 ? 'song' : 'songs'}`;
  },

  renderGrid() {
    const grid = Utils.$('#playlists-grid');
    const empty = Utils.$('#playlists-empty');
    if (!grid) return;

    grid.innerHTML = '';

    if (!this.playlists.length) {
      if (empty) Utils.show(empty);
      return;
    }
    if (empty) Utils.hide(empty);

    this.playlists.forEach((pl, i) => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.dataset.playlistId = pl.id;
      card.style.setProperty('--card-i', i);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Open playlist ${pl.title}`);

      card.innerHTML = `
        <div class="grid-card-art-wrap">
          <img class="grid-card-art" alt="">
          <button type="button" class="grid-card-play" aria-label="Play ${Utils.escapeHtml(pl.title)}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </button>
        </div>
        <div class="grid-card-body">
          <div class="grid-card-text">
            <div class="grid-card-title">${Utils.escapeHtml(pl.title)}</div>
          </div>
        </div>
      `;
      this._setImg(card.querySelector('.grid-card-art'), pl);

      card.querySelector('.grid-card-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectPlaylist(pl.id);
        if (pl.tracks.length) Player.loadAndPlay(pl.id, 0);
      });

      card.addEventListener('click', () => this.selectPlaylist(pl.id));
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectPlaylist(pl.id);
        }
      });
      grid.appendChild(card);
    });
  },

  selectPlaylist(id) {
    const pl = this.get(id);
    if (!pl) return;
    this.selectedPlaylistId = id;

    Utils.$$('.project-item').forEach(el => el.classList.remove('active'));
    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = Utils.$('#nav-playlists');
    if (navBtn) navBtn.classList.add('active');

    Sidebar._switchView('playlist-detail-view');
    this.renderDetail(pl);
  },

  renderDetail(pl) {
    const art = Utils.$('#playlist-detail-artwork');
    const title = Utils.$('#playlist-detail-title');
    const trackList = Utils.$('#playlist-track-list');
    const emptyNote = Utils.$('#playlist-detail-empty');
    const uploadText = Utils.$('#playlist-art-box .cover-upload-text');

    this._setImg(art, pl);
    if (uploadText) uploadText.textContent = pl.cover ? 'Change Picture' : 'Add Picture';
    if (title) title.textContent = pl.title;

    this.refreshMeta(pl);

    if (emptyNote) {
      pl.tracks.length ? Utils.hide(emptyNote) : Utils.show(emptyNote);
    }

    if (!trackList) return;
    trackList.innerHTML = '';

    pl.tracks.forEach((track, idx) => {
      const isPlaying = Player.currentProject?.id === pl.id && Player.currentTrackIdx === idx;

      const row = document.createElement('div');
      row.className = `track-row${isPlaying ? ' playing' : ''}`;
      row.dataset.projectId = pl.id;
      row.dataset.trackIdx = idx;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');

      row.innerHTML = `
        <div class="track-num">
          <span class="track-num-text">${idx + 1}</span>
          <svg class="track-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          <div class="playing-icon"><span class="playing-bars"><span></span><span></span><span></span></span></div>
        </div>
        <div class="track-title">${Utils.escapeHtml(Utils.displayTitle(track.title))}</div>
        <div class="track-end">
          ${Utils.downloadButtonHtml(track.title)}
          ${Utils.moreButtonHtml(track.title)}
          <div class="track-duration">--:--</div>
        </div>
      `;

      Utils.bindDownloadButton(row.querySelector('.download-btn'), track);

      this.attachTrackActions(row, track, { playlistId: pl.id, trackIdx: idx });

      row.addEventListener('click', () => Player.loadAndPlay(pl.id, idx));
      row.addEventListener('keydown', (e) => {
        if (e.target !== row) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          Player.loadAndPlay(pl.id, idx);
        }
      });

      trackList.appendChild(row);
    });

    this.lazyLoadDurations(pl);
  },

  refreshMeta(pl) {
    const countEl = Utils.$('#playlist-detail-count');
    if (!countEl) return;
    let text = this._songCountText(pl);

    let total = 0;
    let allKnown = pl.tracks.length > 0;
    pl.tracks.forEach(t => {
      const d = Utils.getCachedDuration(t.src);
      if (d === null || isNaN(d)) allKnown = false;
      else total += d;
    });
    if (allKnown && total > 0) {
      const mins = Math.round(total / 60);
      if (mins >= 60) text += `, ${Math.floor(mins / 60)} hr ${mins % 60} min`;
      else text += `, ${Math.max(1, mins)} min`;
    }
    countEl.textContent = text;
  },

  lazyLoadDurations(pl) {
    const rows = Utils.$$('#playlist-track-list .track-row');
    pl.tracks.forEach((track, idx) => {
      const el = rows[idx]?.querySelector('.track-duration');
      const cached = Utils.getCachedDuration(track.src);
      if (cached !== null) {
        if (el) el.textContent = Utils.formatTime(cached);
        return;
      }

      const tmp = new Audio();
      tmp.preload = 'metadata';
      const cleanup = () => { tmp.onloadedmetadata = null; tmp.onerror = null; tmp.src = ''; };
      tmp.onloadedmetadata = () => {
        const duration = tmp.duration;
        Utils.setCachedDuration(track.src, duration);
        const rowEl = rows[idx]?.querySelector('.track-duration');
        if (rowEl) rowEl.textContent = Utils.formatTime(duration);
        cleanup();
        if (this.selectedPlaylistId === pl.id) this.refreshMeta(pl);
      };
      tmp.onerror = cleanup;
      tmp.src = track.src;
    });
  },

  highlightPlaying(projectId, trackIdx) {
    const rows = Utils.$$('#playlist-track-list .track-row');
    rows.forEach(r => r.classList.remove('playing'));

    if (this.selectedPlaylistId === projectId) {
      const row = Utils.$(`#playlist-track-list .track-row[data-project-id="${projectId}"][data-track-idx="${trackIdx}"]`);
      if (row) row.classList.add('playing');
    }
  },

  bindCropper() {
    const stage = Utils.$('#crop-stage');
    const zoom = Utils.$('#crop-zoom');
    if (!stage || !zoom) return;

    const closeCancel = () => this.closeCropper(null);
    ['#cover-crop-close', '#cover-crop-cancel', '#cover-crop-backdrop'].forEach(sel => {
      const el = Utils.$(sel);
      if (el) el.addEventListener('click', closeCancel);
    });

    const apply = () => { if (this._crop) this.closeCropper(this._exportCrop()); };
    const applyBtn = Utils.$('#cover-crop-apply');
    if (applyBtn) applyBtn.addEventListener('click', apply);

    const hideHint = () => {
      const hint = Utils.$('#crop-overlay-hint');
      if (hint) hint.classList.add('is-hidden');
    };

    const resetBtn = Utils.$('#crop-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => this._cropReset());

    const fitBtn = Utils.$('#crop-fit-btn');
    if (fitBtn) fitBtn.addEventListener('click', () => this._cropFit());

    const zoomIn = Utils.$('#crop-zoom-in');
    const zoomOut = Utils.$('#crop-zoom-out');
    if (zoomIn) zoomIn.addEventListener('click', () => { hideHint(); if (this._crop) this._zoomTo(this._crop.s * 1.2); });
    if (zoomOut) zoomOut.addEventListener('click', () => { hideHint(); if (this._crop) this._zoomTo(this._crop.s / 1.2); });

    zoom.addEventListener('input', () => {
      const c = this._crop;
      if (!c) return;
      hideHint();
      const t = Number(zoom.value) / 1000;
      this._zoomTo(c.sMin * Math.pow(c.sMax / c.sMin, t));
    });

    const pointers = new Map();
    let pinch = null;
    const local = (x, y) => {
      const r = stage.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };

    stage.addEventListener('pointerdown', (e) => {
      const c = this._crop;
      if (!c) return;
      e.preventDefault();
      hideHint();
      stage.focus({ preventScroll: true });
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.classList.add('is-dragging');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          s: c.s,
          ix: c.cx + (m.x - c.V / 2) / c.s,
          iy: c.cy + (m.y - c.V / 2) / c.s
        };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      const c = this._crop;
      if (!c || !pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const next = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, next);

      if (pointers.size === 1) {
        c.cx -= (next.x - prev.x) / c.s;
        c.cy -= (next.y - prev.y) / c.s;
        this._renderCrop();
      } else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
        c.s = Math.max(c.sMin, Math.min(c.sMax, pinch.s * (dist / pinch.dist)));
        c.cx = pinch.ix - (m.x - c.V / 2) / c.s;
        c.cy = pinch.iy - (m.y - c.V / 2) / c.s;
        this._renderCrop();
      }
    });

    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('dblclick', (e) => {
      const c = this._crop;
      if (!c) return;
      hideHint();
      const p = local(e.clientX, e.clientY);
      if (c.s > c.sCover * 1.05) this._cropReset();
      else this._zoomTo(c.sCover * 2, p.x, p.y);
    });

    stage.addEventListener('wheel', (e) => {
      const c = this._crop;
      if (!c) return;
      e.preventDefault();
      hideHint();
      const p = local(e.clientX, e.clientY);
      this._zoomTo(c.s * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });

    stage.addEventListener('keydown', (e) => {
      const c = this._crop;
      if (!c) return;
      const step = 12 / c.s;
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft': c.cx -= step; break;
        case 'ArrowRight': c.cx += step; break;
        case 'ArrowUp': c.cy -= step; break;
        case 'ArrowDown': c.cy += step; break;
        case '+': case '=': c.s = Math.min(c.sMax, c.s * 1.08); break;
        case '-': case '_': c.s = Math.max(c.sMin, c.s / 1.08); break;
        case 'Enter': apply(); e.preventDefault(); e.stopPropagation(); return;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        hideHint();
        this._renderCrop();
      }
    });

    window.addEventListener('resize', () => {
      const c = this._crop;
      if (!c) return;
      const oldV = c.V;
      c.V = stage.clientWidth || oldV;
      if (c.V !== oldV) {
        const ratio = c.V / oldV;
        c.s *= ratio;
        this._cropMetrics();
        this._renderCrop();
      }
    });
  },

  _zoomTo(s, px, py) {
    const c = this._crop;
    if (!c) return;
    if (px == null) { px = c.V / 2; py = c.V / 2; }
    const ns = Math.max(c.sMin, Math.min(c.sMax, s));
    const ix = c.cx + (px - c.V / 2) / c.s;
    const iy = c.cy + (py - c.V / 2) / c.s;
    c.s = ns;
    c.cx = ix - (px - c.V / 2) / ns;
    c.cy = iy - (py - c.V / 2) / ns;
    this._renderCrop();
  },

  openCropper(file) {
    return new Promise((resolve) => {
      if (!file || !/^image\//i.test(file.type)) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        this._startCrop(img, url, resolve);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  },

  _startCrop(img, url, resolve) {
    const modal = Utils.$('#cover-crop-modal');
    const stage = Utils.$('#crop-stage');
    const imgEl = Utils.$('#crop-img');
    if (!modal || !stage || !imgEl) {
      this._crop = { img, url, resolve, w: img.naturalWidth, h: img.naturalHeight, V: 1 };
      this._cropMetrics();
      this._cropReset(true);
      this.closeCropper(this._exportCrop());
      return;
    }

    this._crop = {
      img, url, resolve,
      w: img.naturalWidth, h: img.naturalHeight,
      V: 0, s: 1, sMin: 1, sCover: 1, sMax: 4, cx: 0, cy: 0
    };

    imgEl.src = url;
    const hint = Utils.$('#crop-overlay-hint');
    if (hint) hint.classList.remove('is-hidden');
    this._open(modal);

    this._crop.V = stage.clientWidth || 300;
    this._cropMetrics();
    this._cropReset();
    stage.focus({ preventScroll: true });
  },

  _cropMetrics() {
    const c = this._crop;
    c.sCover = Math.max(c.V / c.w, c.V / c.h);
    c.sMin = Math.min(c.V / c.w, c.V / c.h);
    c.sMax = c.sCover * 4;
    if (c.sMax <= c.sMin * 1.05) c.sMax = c.sMin * 4;

    const fitBtn = Utils.$('#crop-fit-btn');
    if (fitBtn) fitBtn.classList.toggle('hidden', c.sCover / c.sMin < 1.02);
  },

  _cropReset(skipRender) {
    const c = this._crop;
    if (!c) return;
    c.s = c.sCover;
    c.cx = c.w / 2;
    c.cy = c.h / 2;
    if (!skipRender) this._renderCrop();
  },

  _cropFit() {
    const c = this._crop;
    if (!c) return;
    c.s = c.sMin;
    c.cx = c.w / 2;
    c.cy = c.h / 2;
    this._renderCrop();
  },

  _clampCrop() {
    const c = this._crop;
    c.s = Math.max(c.sMin, Math.min(c.sMax, c.s));
    const halfW = c.V / (2 * c.s);
    c.cx = (c.w * c.s <= c.V + 0.5) ? c.w / 2 : Math.max(halfW, Math.min(c.w - halfW, c.cx));
    c.cy = (c.h * c.s <= c.V + 0.5) ? c.h / 2 : Math.max(halfW, Math.min(c.h - halfW, c.cy));
  },

  _renderCrop() {
    const c = this._crop;
    if (!c) return;
    this._clampCrop();

    const imgEl = Utils.$('#crop-img');
    const zoom = Utils.$('#crop-zoom');
    if (imgEl) {
      imgEl.style.width = (c.w * c.s) + 'px';
      imgEl.style.height = (c.h * c.s) + 'px';
      imgEl.style.transform = `translate(${c.V / 2 - c.cx * c.s}px, ${c.V / 2 - c.cy * c.s}px)`;
    }
    if (zoom) {
      const t = Math.log(c.s / c.sMin) / Math.log(c.sMax / c.sMin);
      zoom.value = String(Math.round(Math.max(0, Math.min(1, t)) * 1000));
    }
  },

  _exportCrop() {
    const c = this._crop;
    if (!c) return null;
    const out = this.COVER_OUTPUT_SIZE;
    const k = c.s * out / c.V;

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(0, 0, out, out);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c.img, 0, 0, c.w, c.h, out / 2 - c.cx * k, out / 2 - c.cy * k, c.w * k, c.h * k);

    try {
      return canvas.toDataURL('image/jpeg', 0.86);
    } catch (e) {
      console.warn('Failed to export cropped image:', e);
      return null;
    }
  },

  closeCropper(result) {
    const c = this._crop;
    if (!c) return;
    this._crop = null;

    const imgEl = Utils.$('#crop-img');
    if (imgEl) imgEl.removeAttribute('src');
    this._close(Utils.$('#cover-crop-modal'));
    URL.revokeObjectURL(c.url);
    c.resolve(result || null);
  }
};
