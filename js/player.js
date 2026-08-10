window.Player = {
  audio: new Audio(),

  eqBands: [
    { freq: 60, label: '60' },
    { freq: 230, label: '230' },
    { freq: 910, label: '910' },
    { freq: 3600, label: '3.6k' },
    { freq: 14000, label: '14k' }
  ],
  eqGains: [0, 0, 0, 0, 0],
  eqEnabled: true,
  eqMinDb: -12,
  eqMaxDb: 12,

  audioContext: null,
  sourceNode: null,
  eqFilters: [],
  _audioGraphReady: false,
  eqAvailable: false,

  currentProject: null,
  currentTrackIdx: -1,
  playlist: [],
  shuffledPlaylist: [],
  queuePos: 0,
  isPlaying: false,
  repeatMode: 'off',
  shuffleOn: false,
  volume: 1,
  isMuted: false,
  isLoading: false,
  isAllShuffle: false,

  onTrackChange: null,
  onPlayStateChange: null,

  init() {
    const savedVol = localStorage.getItem('fsv-volume');
    if (savedVol !== null) {
      this.volume = parseFloat(savedVol);
      this.audio.volume = this.volume;
    }

    const savedMuted = localStorage.getItem('fsv-muted');
    if (savedMuted !== null) {
      this.isMuted = savedMuted === 'true';
      this.audio.muted = this.isMuted;
    }

    const savedRepeat = localStorage.getItem('fsv-repeat');
    if (savedRepeat !== null) {
      this.repeatMode = savedRepeat;
    }

    const savedShuffle = localStorage.getItem('fsv-shuffle');
    if (savedShuffle !== null) {
      this.shuffleOn = savedShuffle === 'true';
    }

    this.audio.addEventListener('timeupdate', () => this.updateTimeUI());
    this.audio.addEventListener('progress', () => this.updateBufferedUI());
    this.audio.addEventListener('ended', () => this.handleTrackEnded());
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayPauseUI();
      if (this.onPlayStateChange) this.onPlayStateChange(true);
    });
    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayPauseUI();
      if (this.onPlayStateChange) this.onPlayStateChange(false);
    });
    this.audio.addEventListener('waiting', () => this.setLoading(true));
    this.audio.addEventListener('canplay', () => this.setLoading(false));
    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error:', e);
      this.setLoading(false);
    });

    this.eqAvailable = window.location.protocol === 'http:' || window.location.protocol === 'https:';

    this.updateVolumeUI();
    this.updateRepeatUI();
    this.updateShuffleUI();
  },

  initAudioGraph() {
    if (this._audioGraphReady || !this.eqAvailable) return false;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      this.audioContext = new AudioCtx();
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.eqFilters = this.eqBands.map((band) => {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });

      let node = this.sourceNode;
      this.eqFilters.forEach((filter) => {
        node.connect(filter);
        node = filter;
      });
      node.connect(this.audioContext.destination);

      this.eqBands.forEach((_, i) => {
        if (this.eqFilters[i]) {
          this.eqFilters[i].gain.value = this.eqEnabled ? this.eqGains[i] : 0;
        }
      });

      this._audioGraphReady = true;
      return true;
    } catch (e) {
      console.warn('Web Audio EQ unavailable:', e);
      return false;
    }
  },

  ensureAudioReady() {
    if (!this.eqAvailable) return Promise.resolve();
    this.initAudioGraph();
    if (!this.audioContext) return Promise.resolve();
    if (this.audioContext.state === 'running') return Promise.resolve();
    return this.audioContext.resume().catch(() => {});
  },

  playAudio() {
    if (!this.eqAvailable) return this.audio.play();
    return this.ensureAudioReady().then(() => this.audio.play());
  },

  setEqBand(index, gainDb) {
    if (index < 0 || index >= this.eqBands.length) return;
    const clamped = Math.max(this.eqMinDb, Math.min(this.eqMaxDb, gainDb));
    this.eqGains[index] = clamped;
    if (this.eqFilters[index] && this.eqEnabled) {
      this.eqFilters[index].gain.value = clamped;
    }
  },

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    this.eqBands.forEach((_, i) => {
      if (this.eqFilters[i]) {
        this.eqFilters[i].gain.value = enabled ? this.eqGains[i] : 0;
      }
    });
  },

  applyEqSettings(settings) {
    if (!settings) return;
    if (typeof settings.enabled === 'boolean') this.eqEnabled = settings.enabled;
    if (Array.isArray(settings.gains)) {
      settings.gains.forEach((gain, i) => {
        if (typeof gain === 'number') this.eqGains[i] = Math.max(this.eqMinDb, Math.min(this.eqMaxDb, gain));
      });
    }
    this.eqBands.forEach((_, i) => {
      if (this.eqFilters[i]) {
        this.eqFilters[i].gain.value = this.eqEnabled ? this.eqGains[i] : 0;
      }
    });
  },

  getEqSettings() {
    return {
      enabled: this.eqEnabled,
      gains: [...this.eqGains]
    };
  },

  resetEq() {
    this.eqGains = this.eqBands.map(() => 0);
    this.setEqEnabled(this.eqEnabled);
  },

  setLoading(isLoading) {
    this.isLoading = isLoading;
    const indicator = Utils.$('#loading-indicator');
    isLoading ? Utils.show(indicator) : Utils.hide(indicator);
  },

  loadAndPlay(projectId, trackIdx) {
    const project = getProject(projectId);
    if (!project || !project.tracks[trackIdx]) return;

    const projectChanged = !this.currentProject || this.currentProject.id !== projectId;
    this.currentProject = project;
    this.currentTrackIdx = trackIdx;

    if (projectChanged || this.isAllShuffle) {
      this.isAllShuffle = false;
      this.buildPlaylist(projectId);
    }

    const activeList = this.shuffleOn ? this.shuffledPlaylist : this.playlist;
    this.queuePos = activeList.findIndex(item => item.trackIdx === trackIdx);
    if (this.queuePos === -1) this.queuePos = 0;

    const track = project.tracks[trackIdx];
    this.audio.src = track.src;
    this.playAudio().catch(err => console.warn('Play interrupted:', err));

    const playerBar = Utils.$('#player-bar');
    if (playerBar) playerBar.classList.remove('player-hidden');
    const appEl = Utils.$('#app');
    if (appEl) appEl.classList.add('player-active');

    this.updateNowPlayingInfo();
    if (this.onTrackChange) this.onTrackChange(projectId, trackIdx);
  },

  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.playAudio().catch(err => console.warn(err));
    }
  },

  playNext(manual = false) {
    if (!this.currentProject) return;

    const isShuffle = this.shuffleOn;
    const activeList = isShuffle ? this.shuffledPlaylist : this.playlist;
    if (!activeList || activeList.length === 0) return;

    let nextPos = this.queuePos + 1;

    if (nextPos >= activeList.length) {
      if (this.repeatMode === 'all' || manual || isShuffle) {
        if (isShuffle) {
          this.buildShuffledPlaylist();
          const endedIdx = this.shuffledPlaylist.findIndex(item => item.trackIdx === this.currentTrackIdx);
          if (endedIdx > -1) {
            this.shuffledPlaylist.push(this.shuffledPlaylist.splice(endedIdx, 1)[0]);
          }
        }
        nextPos = 0;
      } else {
        this.isPlaying = false;
        this.updatePlayPauseUI();
        return;
      }
    }

    this.queuePos = nextPos;
    const nextItem = (isShuffle ? this.shuffledPlaylist : this.playlist)[nextPos];
    if (!nextItem) return;

    if (this.isAllShuffle && nextItem.projectId) {
      const nextProject = getProject(nextItem.projectId);
      if (nextProject) this.currentProject = nextProject;
    }

    this.currentTrackIdx = nextItem.trackIdx;
    const track = this.currentProject.tracks[nextItem.trackIdx];
    if (!track) return;

    this.audio.src = track.src;
    this.playAudio().catch(err => console.warn('Play interrupted:', err));

    this.updateNowPlayingInfo();
    if (this.onTrackChange) this.onTrackChange(nextItem.projectId, nextItem.trackIdx);
  },

  playPrev() {
    if (!this.currentProject) return;

    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    const activeList = this.shuffleOn ? this.shuffledPlaylist : this.playlist;
    if (!activeList || activeList.length === 0) return;

    let prevPos = this.queuePos - 1;
    if (prevPos < 0) {
      this.audio.currentTime = 0;
      return;
    }

    this.queuePos = prevPos;
    const prevItem = activeList[prevPos];
    if (!prevItem) return;

    if (this.isAllShuffle && prevItem.projectId) {
      const prevProject = getProject(prevItem.projectId);
      if (prevProject) this.currentProject = prevProject;
    }

    this.currentTrackIdx = prevItem.trackIdx;
    const track = this.currentProject.tracks[prevItem.trackIdx];
    if (!track) return;

    this.audio.src = track.src;
    this.playAudio().catch(err => console.warn('Play interrupted:', err));

    this.updateNowPlayingInfo();
    if (this.onTrackChange) this.onTrackChange(prevItem.projectId, prevItem.trackIdx);
  },

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.playAudio().catch(err => console.warn(err));
    } else {
      this.playNext();
    }
  },

  seekTo(fraction) {
    if (this.audio.duration) {
      this.audio.currentTime = fraction * this.audio.duration;
    }
  },

  setVolume(fraction) {
    this.volume = Math.max(0, Math.min(1, fraction));
    this.audio.volume = this.volume;
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
      this.audio.muted = false;
    }
    localStorage.setItem('fsv-volume', this.volume);
    localStorage.setItem('fsv-muted', this.isMuted);
    this.updateVolumeUI();
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    localStorage.setItem('fsv-muted', this.isMuted);
    this.updateVolumeUI();
  },

  setRepeatMode(mode) {
    this.repeatMode = mode;
    localStorage.setItem('fsv-repeat', mode);
    this.updateRepeatUI();
  },

  toggleShuffle() {
    this.shuffleOn = !this.shuffleOn;
    localStorage.setItem('fsv-shuffle', this.shuffleOn);

    if (this.shuffleOn && this.currentProject) {
      this.buildShuffledPlaylist();
      this.queuePos = this.shuffledPlaylist.findIndex(item => item.trackIdx === this.currentTrackIdx);
      if (this.queuePos === -1) this.queuePos = 0;
    } else if (!this.shuffleOn) {
      this.queuePos = this.playlist.findIndex(item => item.trackIdx === this.currentTrackIdx);
      if (this.queuePos === -1) this.queuePos = 0;
    }
    this.updateShuffleUI();
  },

  buildPlaylist(projectId) {
    const project = getProject(projectId);
    if (!project) return;
    this.playlist = project.tracks.map((t, idx) => ({
      projectId,
      trackIdx: idx,
      track: t
    }));
    if (this.shuffleOn) {
      this.buildShuffledPlaylist();
    }
  },

  buildShuffledPlaylist() {
    const list = [...this.playlist];
    let i = list.length - 1;
    while (i > 0) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
      i--;
    }
    this.shuffledPlaylist = list;
  },

  buildAllProjectsPlaylist() {
    this.playlist = [];
    MUSIC_LIBRARY.forEach(project => {
      project.tracks.forEach((track, idx) => {
        this.playlist.push({
          projectId: project.id,
          trackIdx: idx,
          track: track
        });
      });
    });
    if (this.shuffleOn) {
      this.buildShuffledPlaylist();
    }
  },

  shuffleAll() {
    this.buildAllProjectsPlaylist();
    this.shuffleOn = true;
    try { localStorage.setItem('fsv-shuffle', 'true'); } catch (e) {}
    this.buildShuffledPlaylist();
    this.updateShuffleUI();
    
    const first = this.shuffledPlaylist[0];
    if (!first) return;
    
    const project = getProject(first.projectId);
    if (!project) return;
    
    this.currentProject = project;
    this.currentTrackIdx = first.trackIdx;
    this.queuePos = 0;
    this.isAllShuffle = true;
    
    const track = project.tracks[first.trackIdx];
    this.audio.src = track.src;
    this.playAudio().catch(err => console.warn('Play interrupted:', err));
    
    const playerBar = Utils.$('#player-bar');
    if (playerBar) playerBar.classList.remove('player-hidden');
    const appEl = Utils.$('#app');
    if (appEl) appEl.classList.add('player-active');
    
    this.updateNowPlayingInfo();
    if (this.onTrackChange) this.onTrackChange(first.projectId, first.trackIdx);
  },

  updateTimeUI() {
    const currTime = Utils.$('#current-time');
    const totTime = Utils.$('#total-time');
    const seekProgress = Utils.$('#seek-progress');
    const seekThumb = Utils.$('#seek-thumb');

    const formattedCurr = Utils.formatTime(this.audio.currentTime);
    const formattedTot = Utils.formatTime(this.audio.duration);

    if (currTime) currTime.textContent = formattedCurr;
    if (totTime) totTime.textContent = formattedTot;

    if (this.audio.duration) {
      const pct = (this.audio.currentTime / this.audio.duration) * 100;
      if (seekProgress) seekProgress.style.width = `${pct}%`;
      if (seekThumb) seekThumb.style.left = `${pct}%`;

      const seekBar = Utils.$('#seek-bar');
      if (seekBar) {
        seekBar.setAttribute('aria-valuenow', Math.round(pct));
        seekBar.setAttribute('aria-valuetext', `${formattedCurr} of ${formattedTot}`);
      }
    }

    const fsCurrTime = Utils.$('#fs-current-time');
    const fsTotTime = Utils.$('#fs-total-time');
    const fsSeekProgress = Utils.$('#fs-seek-progress');
    const fsSeekThumb = Utils.$('#fs-seek-thumb');
    if (fsCurrTime) fsCurrTime.textContent = formattedCurr;
    if (fsTotTime) fsTotTime.textContent = formattedTot;
    if (this.audio.duration) {
      const pct = (this.audio.currentTime / this.audio.duration) * 100;
      if (fsSeekProgress) fsSeekProgress.style.width = `${pct}%`;
      if (fsSeekThumb) fsSeekThumb.style.left = `${pct}%`;
    }
  },

  updateBufferedUI() {
    const seekBuffered = Utils.$('#seek-buffered');
    if (this.audio.buffered.length > 0 && this.audio.duration) {
      const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
      const pct = (bufferedEnd / this.audio.duration) * 100;
      if (seekBuffered) seekBuffered.style.width = `${pct}%`;
    }
  },

  updatePlayPauseUI() {
    Utils.$$('.icon-play').forEach(icon => {
      this.isPlaying ? Utils.hide(icon) : Utils.show(icon);
    });
    Utils.$$('.icon-pause').forEach(icon => {
      this.isPlaying ? Utils.show(icon) : Utils.hide(icon);
    });
  },

  updateNowPlayingInfo() {
    if (!this.currentProject || this.currentTrackIdx === -1) return;
    const track = this.currentProject.tracks[this.currentTrackIdx];

    const titleEl = Utils.$('#now-playing-title');
    const projEl = Utils.$('#now-playing-project');
    const artEl = Utils.$('#now-playing-artwork');

    if (titleEl) titleEl.textContent = Utils.displayTitle(track.title);
    if (projEl) projEl.textContent = this.currentProject.title;
    if (artEl) {
      artEl.src = Utils.getCoverUrl(this.currentProject);
      artEl.onerror = () => { artEl.src = Utils.getCoverUrl(null); };
    }
    this.updateFullscreenInfo();
  },

  updateFullscreenInfo() {
    if (!this.currentProject || this.currentTrackIdx === -1) return;
    const track = this.currentProject.tracks[this.currentTrackIdx];
    const fsTitle = Utils.$('#fs-title');
    const fsArtist = Utils.$('#fs-artist');
    const fsArt = Utils.$('#fs-artwork');
    const fsBgArt = Utils.$('#fs-bg-art');
    
    if (fsTitle) fsTitle.textContent = Utils.displayTitle(track.title);
    if (fsArtist) fsArtist.textContent = this.currentProject.title;
    const coverUrl = Utils.getCoverUrl(this.currentProject);
    if (fsArt) { fsArt.src = coverUrl; fsArt.onerror = () => { fsArt.src = Utils.getCoverUrl(null); }; }
    if (fsBgArt) { fsBgArt.src = coverUrl; fsBgArt.onerror = () => { fsBgArt.src = Utils.getCoverUrl(null); }; }
    
    const fsShuffleBtn = Utils.$('#fs-shuffle-btn');
    const fsRepeatBtn = Utils.$('#fs-repeat-btn');
    const fsRepeatBadge = Utils.$('.fs-repeat-badge');
    if (fsShuffleBtn) fsShuffleBtn.classList.toggle('active', this.shuffleOn);
    if (fsRepeatBtn) fsRepeatBtn.classList.toggle('active', this.repeatMode !== 'off');
    if (fsRepeatBadge) fsRepeatBadge.classList.toggle('is-visible', this.repeatMode !== 'off');
    
    const fsFill = Utils.$('#fs-volume-fill');
    const fsThumb = Utils.$('#fs-volume-thumb');
    const effectiveVol = this.isMuted ? 0 : this.volume;
    const pct = effectiveVol * 100;
    if (fsFill) fsFill.style.width = `${pct}%`;
    if (fsThumb) fsThumb.style.left = `${pct}%`;
  },

  updateVolumeUI() {
    const fill = Utils.$('#volume-fill');
    const thumb = Utils.$('#volume-thumb');
    const bar = Utils.$('#volume-bar');
    const volBtn = Utils.$('#volume-btn');

    const effectiveVol = this.isMuted ? 0 : this.volume;
    const pct = effectiveVol * 100;
    if (fill) fill.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;

    if (bar) {
      bar.setAttribute('aria-valuenow', Math.round(pct));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuetext', `${Math.round(pct)}%${this.isMuted ? ' (muted)' : ''}`);
    }
    if (volBtn) {
      volBtn.setAttribute('aria-pressed', String(this.isMuted));
      volBtn.title = this.isMuted ? 'Unmute (M)' : 'Mute (M)';
    }

    const high = Utils.$('.icon-vol-high');
    const low = Utils.$('.icon-vol-low');
    const mute = Utils.$('.icon-vol-mute');
    const showMute = this.isMuted || effectiveVol === 0;
    const showLow = !showMute && effectiveVol > 0 && effectiveVol < 0.5;
    if (high) high.classList.toggle('hidden', showMute || showLow);
    if (low) low.classList.toggle('hidden', !showLow);
    if (mute) mute.classList.toggle('hidden', !showMute);

    const fsFill = Utils.$('#fs-volume-fill');
    const fsThumb = Utils.$('#fs-volume-thumb');
    if (fsFill) fsFill.style.width = `${pct}%`;
    if (fsThumb) fsThumb.style.left = `${pct}%`;
  },

  updateRepeatUI() {
    const btn = Utils.$('#repeat-btn');
    const badge = Utils.$('.repeat-badge');

    if (!btn) return;
    const active = this.repeatMode !== 'off';
    btn.classList.toggle('active', active);
    btn.title = active ? 'Repeat One is on (R)' : 'Repeat (R)';

    if (badge) badge.classList.toggle('is-visible', active);
    const fsRepeatBtn = Utils.$('#fs-repeat-btn');
    const fsBadge = Utils.$('.fs-repeat-badge');
    if (fsRepeatBtn) fsRepeatBtn.classList.toggle('active', active);
    if (fsBadge) fsBadge.classList.toggle('is-visible', active);
  },

  updateShuffleUI() {
    const btn = Utils.$('#shuffle-btn');
    if (!btn) return;
    if (this.shuffleOn) btn.classList.add('active');
    else btn.classList.remove('active');
    const fsShuffleBtn = Utils.$('#fs-shuffle-btn');
    if (fsShuffleBtn) fsShuffleBtn.classList.toggle('active', this.shuffleOn);
  }
};
