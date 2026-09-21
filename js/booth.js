window.Booth = {
  selectedProjectId: null,

  projects: [
    {
      id: 'slayr',
      title: 'Slayr',
      folder: 'slayr',
      cover: 'https://pbs.twimg.com/media/HSrl3eOWgAAfkqb.jpg',
      coverFallback: null,
      durationText: '',
      tracks: [
        { title: '1v1', src: 'music/inthebooth/slayr/1v1.mp3' },
        { title: 'DO OR DIE', src: 'music/inthebooth/slayr/DO OR DIE.mp3' },
        { title: 'HELLO MOLLY', src: 'music/inthebooth/slayr/HELLO MOLLY.mp3' },
        { title: 'LAVENDER TOWN', src: 'music/inthebooth/slayr/LAVENDER TOWN.mp3' },
        { title: 'SECOND CHANCES', src: 'music/inthebooth/slayr/SECOND CHANCES.mp3' }
      ]
    }
  ],



  getProject(id) {
    return this.projects.find(p => p.id === id) || null;
  },

  init() {
    this.renderGrid();

    const playAllBtn = Utils.$('#booth-play-all-btn');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        if (this.selectedProjectId) Player.loadAndPlay(this.selectedProjectId, 0);
      });
    }

    const shufflePlayBtn = Utils.$('#booth-shuffle-play-btn');
    if (shufflePlayBtn) {
      shufflePlayBtn.addEventListener('click', () => {
        if (!this.selectedProjectId) return;
        const project = this.getProject(this.selectedProjectId);
        if (!project || !project.tracks.length) return;
        if (!Player.shuffleOn) Player.toggleShuffle();
        const randomIdx = Math.floor(Math.random() * project.tracks.length);
        Player.loadAndPlay(project.id, randomIdx);
      });
    }
  },

  renderGrid() {
    const grid = Utils.$('#booth-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.projects.forEach((project, i) => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.dataset.projectId = project.id;
      card.style.setProperty('--card-i', i);
      const coverUrl = Utils.getCoverUrl(project);

      card.innerHTML = `
        <div class="grid-card-art-wrap">
          <img class="grid-card-art" src="${coverUrl}" alt="${project.title}" onerror="this.src='${Utils.getCoverUrl(null)}'">
          <button class="grid-card-play" aria-label="Open ${project.title}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="grid-card-body">
          <div class="grid-card-text">
            <div class="grid-card-title">${project.title}</div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.selectProject(project.id));

      grid.appendChild(card);
    });

    const empty = Utils.$('#booth-empty');
    if (empty) {
      this.projects.length ? Utils.hide(empty) : Utils.show(empty);
    }
  },

  selectProject(projectId) {
    const project = this.getProject(projectId);
    if (!project) return;

    this.selectedProjectId = projectId;

    Utils.$$('.nav-item').forEach(n => n.classList.remove('active'));
    const boothBtn = Utils.$('#nav-booth');
    if (boothBtn) boothBtn.classList.add('active');

    Sidebar._switchView('booth-project-view');

    this.renderProjectDetail(project);
  },

  renderProjectDetail(project) {
    const art = Utils.$('#booth-project-artwork');
    const title = Utils.$('#booth-project-title');
    const note = Utils.$('#booth-note');
    const trackList = Utils.$('#booth-track-list');
    const coverUrl = Utils.getCoverUrl(project);

    if (art) {
      art.src = coverUrl;
      art.onerror = () => { art.src = Utils.getCoverUrl(null); };
    }
    if (title) title.textContent = project.title;
    if (note) {
      project.tracks.length ? Utils.hide(note) : Utils.show(note);
    }

    if (!trackList) return;
    trackList.innerHTML = '';

    if (!project.tracks.length) return;

    project.tracks.forEach((track, idx) => {
      const isPlaying = Player.currentProject?.id === project.id && Player.currentTrackIdx === idx;

      const row = document.createElement('div');
      row.className = `track-row${isPlaying ? ' playing' : ''}`;
      row.dataset.projectId = project.id;
      row.dataset.trackIdx = idx;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');

      row.innerHTML = `
        <div class="track-num">
          <span class="track-num-text">${idx + 1}</span>
          <svg class="track-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <div class="playing-icon"><span class="playing-bars"><span></span><span></span><span></span></span></div>
        </div>
        <div class="track-title">${Utils.displayTitle(track.title)}</div>
        <div class="track-end">
          <div class="track-duration">--:--</div>
          ${Utils.downloadButtonHtml(track.title)}
        </div>
      `;

      Utils.bindDownloadButton(row.querySelector('.download-btn'), track);

      row.addEventListener('click', () => Player.loadAndPlay(project.id, idx));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          Player.loadAndPlay(project.id, idx);
        }
      });
      trackList.appendChild(row);
    });

    this.lazyLoadDurations(project);
  },

  lazyLoadDurations(project) {
    const rows = Utils.$$('#booth-track-list .track-row');
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
    const rows = Utils.$$('#booth-track-list .track-row');
    rows.forEach(r => r.classList.remove('playing'));

    if (this.selectedProjectId === projectId) {
      const row = Utils.$(`#booth-track-list .track-row[data-project-id="${projectId}"][data-track-idx="${trackIdx}"]`);
      if (row) row.classList.add('playing');
    }
  }
};
