window.Player = {
  audio: new Audio(),

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

    this.updateVolumeUI();
    this.updateRepeatUI();
    this.updateShuffleUI();
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

    if (projectChanged) {
      this.buildPlaylist(projectId);
    }

    const activeList = this.shuffleOn ? this.shuffledPlaylist : this.playlist;
    this.queuePos = activeList.findIndex(item => item.trackIdx === trackIdx);
    if (this.queuePos === -1) this.queuePos = 0;

    const track = project.tracks[trackIdx];
    this.audio.src = track.src;
    this.audio.play().catch(err => console.warn('Play interrupted:', err));

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
      this.audio.play().catch(err => console.warn(err));
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

    this.currentTrackIdx = nextItem.trackIdx;
    const track = this.currentProject.tracks[nextItem.trackIdx];
    if (!track) return;

    this.audio.src = track.src;
    this.audio.play().catch(err => console.warn('Play interrupted:', err));

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

    this.currentTrackIdx = prevItem.trackIdx;
    const track = this.currentProject.tracks[prevItem.trackIdx];
    if (!track) return;

    this.audio.src = track.src;
    this.audio.play().catch(err => console.warn('Play interrupted:', err));

    this.updateNowPlayingInfo();
    if (this.onTrackChange) this.onTrackChange(prevItem.projectId, prevItem.trackIdx);
  },

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play().catch(err => console.warn(err));
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
  },

  updateRepeatUI() {
    const btn = Utils.$('#repeat-btn');
    const badge = Utils.$('.repeat-badge');

    if (!btn) return;
    const active = this.repeatMode !== 'off';
    btn.classList.toggle('active', active);
    btn.title = active ? 'Repeat One is on (R)' : 'Repeat (R)';

    if (badge) badge.classList.toggle('is-visible', active);
  },

  updateShuffleUI() {
    const btn = Utils.$('#shuffle-btn');
    if (!btn) return;
    if (this.shuffleOn) btn.classList.add('active');
    else btn.classList.remove('active');
  }
};
