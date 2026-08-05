window.Sidebar = {
  selectedProjectId: null,
  nodes: {},

  init() {
    this.buildNodes();
    this.renderAlbumGrid();
    this.updateCounts();

    const logoLink = Utils.$('#logo-link');
    if (logoLink) {
      logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHome();
      });
    }

    const mobileLogoLink = Utils.$('#mobile-logo-link');
    if (mobileLogoLink) {
      mobileLogoLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHome();
      });
    }

    const homeBtn = Utils.$('#nav-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHome();
      });
    }

    const footageBtn = Utils.$('#nav-footage');
    if (footageBtn) {
      footageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showFootage();
      });
    }

    const settingsBtn = Utils.$('#nav-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSettings();
      });
    }

    const heroPlay = Utils.$('#hero-play-btn');
    if (heroPlay) {
      heroPlay.addEventListener('click', () => {
        const first = MUSIC_LIBRARY[0];
        if (first) {
          this.selectProject(first.id);
          Player.loadAndPlay(first.id, 0);
        }
      });
    }
    const heroShuffle = Utils.$('#hero-shuffle-btn');
    if (heroShuffle) {
      heroShuffle.addEventListener('click', () => {
        const first = MUSIC_LIBRARY[0];
        if (first) {
          this.selectProject(first.id);
          if (!Player.shuffleOn) Player.toggleShuffle();
          const randomIdx = Math.floor(Math.random() * first.tracks.length);
          Player.loadAndPlay(first.id, randomIdx);
        }
      });
    }
  },

  buildNodes() {
    const list = Utils.$('#project-list');
    if (!list) return;
    list.innerHTML = '';
    this.nodes = {};

    MUSIC_LIBRARY.forEach(project => {
      const el = this.createProjectNode(project);
      this.nodes[project.id] = el;
      list.appendChild(el);
    });
  },

  createProjectNode(project) {
    const el = document.createElement('div');
    el.className = 'project-item';
    el.dataset.projectId = project.id;
    const coverUrl = Utils.getCoverUrl(project);
    const fallback = Utils.getCoverUrl(null);

    el.innerHTML = `
      <img class="project-thumb" src="${coverUrl}" alt="${project.title}" onerror="this.src='${fallback}'">
      <div class="project-item-info">
        <div class="project-item-title">${project.title}</div>
      </div>
    `;

    el.addEventListener('click', () => {
      this.selectProject(project.id);
    });

    return el;
  },

  showHome() {
    this.selectedProjectId = null;
    Utils.$$('.project-item').forEach(el => el.classList.remove('active'));
    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));
    const homeBtn = Utils.$('#nav-home');
    if (homeBtn) homeBtn.classList.add('active');
    this._switchView('home-view');
  },

  showFootage() {
    this.selectedProjectId = null;
    Utils.$$('.project-item').forEach(el => el.classList.remove('active'));
    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));
    const footageBtn = Utils.$('#nav-footage');
    if (footageBtn) footageBtn.classList.add('active');
    this._switchView('footage-view');
  },

  showSettings() {
    this.selectedProjectId = null;
    Utils.$$('.project-item').forEach(el => el.classList.remove('active'));
    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));
    const settingsBtn = Utils.$('#nav-settings');
    if (settingsBtn) settingsBtn.classList.add('active');
    this._switchView('settings-view');
  },

  _switchView(viewId) {
    const home = Utils.$('#home-view');
    const project = Utils.$('#project-view');
    const footage = Utils.$('#footage-view');
    const settings = Utils.$('#settings-view');
    Utils.hide(home);
    Utils.hide(project);
    if (footage) Utils.hide(footage);
    if (settings) Utils.hide(settings);

    const target = Utils.$('#' + viewId);
    if (target) Utils.show(target);
  },

  renderAlbumGrid() {
    const grid = Utils.$('#quick-grid');
    if (!grid) return;
    grid.innerHTML = '';

    MUSIC_LIBRARY.forEach((project, i) => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.dataset.projectId = project.id;
      card.style.setProperty('--card-i', i);
      const coverUrl = Utils.getCoverUrl(project);

      card.innerHTML = `
        <div class="grid-card-art-wrap">
          <img class="grid-card-art" src="${coverUrl}" alt="${project.title}" onerror="this.src='${Utils.getCoverUrl(null)}'">
          <button class="grid-card-play" aria-label="Play ${project.title}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="grid-card-body">
          <div class="grid-card-text">
            <div class="grid-card-title">${project.title}</div>
          </div>
        </div>
      `;

      card.querySelector('.grid-card-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectProject(project.id);
        Player.loadAndPlay(project.id, 0);
      });

      card.addEventListener('click', () => this.selectProject(project.id));

      grid.appendChild(card);
    });
  },

  updateCounts() {
    const albumCount = Utils.$('#album-count');
    if (!albumCount) return;
    albumCount.textContent = MUSIC_LIBRARY.length;
  },

  selectProject(projectId) {
    const project = getProject(projectId);
    if (!project) return;

    this.selectedProjectId = projectId;

    Utils.$$('.project-item').forEach(el => el.classList.remove('active'));
    const active = Utils.$(`.project-item[data-project-id="${projectId}"]`);
    if (active) active.classList.add('active');

    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));

    this._switchView('project-view');

    this.renderProjectDetail(project);
  },

  renderProjectDetail(project) {
    const art = Utils.$('#project-artwork');
    const title = Utils.$('#project-title');
    const duration = Utils.$('#total-duration');
    const trackList = Utils.$('#track-list');
    const coverUrl = Utils.getCoverUrl(project);

    if (art) { art.src = coverUrl; art.onerror = () => { art.src = Utils.getCoverUrl(null); }; }
    if (title) title.textContent = project.title;
    if (duration) duration.textContent = project.durationText ? project.durationText.split('•')[1]?.trim() : '';

    if (!trackList) return;
    trackList.innerHTML = '';

    project.tracks.forEach((track, idx) => {
      const isPlaying = Player.currentProject?.id === project.id && Player.currentTrackIdx === idx;

      const row = document.createElement('div');
      row.className = `track-row${isPlaying ? ' playing' : ''}`;
      row.dataset.projectId = project.id;
      row.dataset.trackIdx = idx;

      row.innerHTML = `
        <div class="track-num">
          <span class="track-num-text">${idx + 1}</span>
          <svg class="track-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <div class="playing-icon"><span class="playing-bars"><span></span><span></span><span></span></span></div>
        </div>
        <div class="track-title">${Utils.displayTitle(track.title)}</div>
        <div class="track-duration">--:--</div>
      `;

      row.addEventListener('click', () => Player.loadAndPlay(project.id, idx));
      trackList.appendChild(row);
    });

    this.lazyLoadDurations(project);
  },

  lazyLoadDurations(project) {
    const rows = Utils.$$('.track-row');
    project.tracks.forEach((track, idx) => {
      const el = rows[idx]?.querySelector('.track-duration');

      const cached = Utils.getCachedDuration(track.src);
      if (cached !== null) {
        if (el) el.textContent = Utils.formatTime(cached);
        return;
      }

      const tmp = new Audio();
      tmp.src = track.src;
      tmp.addEventListener('loadedmetadata', () => {
        const duration = tmp.duration;
        Utils.setCachedDuration(track.src, duration);
        const rowEl = rows[idx]?.querySelector('.track-duration');
        if (rowEl) rowEl.textContent = Utils.formatTime(duration);
        tmp.src = '';
      });
    });
  },

  highlightPlaying(projectId, trackIdx) {
    Utils.$$('.track-row').forEach(r => r.classList.remove('playing'));

    if (this.selectedProjectId === projectId) {
      const row = Utils.$(`.track-row[data-project-id="${projectId}"][data-track-idx="${trackIdx}"]`);
      if (row) row.classList.add('playing');
    }
  },

  filter(query) {
    const q = query.toLowerCase();

    MUSIC_LIBRARY.forEach(p => {
      const el = this.nodes[p.id];
      const match = p.title.toLowerCase().includes(q) || p.tracks.some(t => t.title.toLowerCase().includes(q));
      if (el) match ? Utils.show(el) : Utils.hide(el);
    });

    this.renderSearchResults(q);
  },

  clearFilter() {
    MUSIC_LIBRARY.forEach(p => {
      const el = this.nodes[p.id];
      if (el) Utils.show(el);
    });

    this.clearSearchResults();
  },

  findMatchingTracks(query) {
    const results = [];
    for (const project of MUSIC_LIBRARY) {
      const albumMatches = project.title.toLowerCase().includes(query);
      project.tracks.forEach((track, idx) => {
        if (albumMatches || track.title.toLowerCase().includes(query)) {
          results.push({ project, track, idx });
        }
      });
    }
    return results;
  },

  renderSearchResults(query) {
    const grid = Utils.$('#quick-grid');
    const resultsEl = Utils.$('#search-results');
    if (!resultsEl) return;

    const results = this.findMatchingTracks(query);
    resultsEl.innerHTML = '';

    if (grid) Utils.hide(grid);
    Utils.show(resultsEl);

    results.forEach(({ project, track, idx }) => {
      const coverUrl = Utils.getCoverUrl(project);
      const fallback = Utils.getCoverUrl(null);

      const row = document.createElement('div');
      row.className = 'search-track-row';

      row.innerHTML = `
        <div class="search-track-art-wrap">
          <img class="search-track-art" src="${coverUrl}" alt="${project.title}" onerror="this.src='${fallback}'">
          <button class="search-track-play" aria-label="Play ${Utils.displayTitle(track.title)}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="search-track-info">
          <div class="search-track-title">${Utils.displayTitle(track.title)}</div>
          <div class="search-track-project">${project.title}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        this.selectProject(project.id);
        Player.loadAndPlay(project.id, idx);
      });

      resultsEl.appendChild(row);
    });

    this.toggleNoResults(results.length === 0, query);
  },

  clearSearchResults() {
    const grid = Utils.$('#quick-grid');
    const resultsEl = Utils.$('#search-results');
    if (resultsEl) {
      resultsEl.innerHTML = '';
      Utils.hide(resultsEl);
    }
    if (grid) Utils.show(grid);
    this.toggleNoResults(false);
  },

  toggleNoResults(show, term) {
    const el = Utils.$('#no-results');
    if (!el) return;
    if (show) {
      const termEl = Utils.$('#no-results-term');
      if (termEl) termEl.textContent = term || '';
      Utils.show(el);
    } else {
      Utils.hide(el);
    }
  }
};
