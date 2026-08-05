window.Footage = {
  videos: [
    {
      type: 'youtube',
      youtubeId: 'IKD_z8z-Gvk',
      title: 'punkandyo session',
      description: 'Studio session'
    },
    {
      type: 'youtube',
      youtubeId: 'jgG_avNpvkY',
      title: 'comethru session',
      description: 'Studio session'
    },
    {
      type: 'youtube',
      youtubeId: 'yz9T4WTyoiI',
      title: 'die about session',
      description: 'Studio session'
    }
  ],

  currentVideo: null,
  playbackRates: [0.5, 1, 1.25, 1.5, 2],
  rateIdx: 1,
  volume: 1,
  isMuted: false,
  hideTimer: null,

  init() {
    this.render();
    this.setupViewer();
  },

  render() {
    const grid = Utils.$('#footage-grid');
    const empty = Utils.$('#footage-empty');
    if (!grid) return;

    grid.innerHTML = '';

    if (this.videos.length === 0) {
      if (empty) Utils.show(empty);
      return;
    }
    if (empty) Utils.hide(empty);

    this.videos.forEach((video, idx) => {
      const card = document.createElement('div');
      card.className = 'footage-card';
      card.dataset.idx = idx;

      const isYoutube = video.type === 'youtube';
      const thumbMarkup = isYoutube
        ? `<img class="footage-thumb" src="https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg" alt="${video.title}" onerror="this.onerror=null;this.src='${Utils.getCoverUrl(null)}'">`
        : `<video class="footage-thumb" src="footage/${video.file}" muted preload="metadata"></video>`;

      card.innerHTML = `
        <div class="footage-thumb-wrap">
          ${thumbMarkup}
          <div class="footage-play-overlay">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="footage-card-title">${video.title}</div>
      `;

      if (!isYoutube) {
        const thumbVideo = card.querySelector('.footage-thumb');
        thumbVideo.addEventListener('loadeddata', () => {
          thumbVideo.currentTime = 1;
        });
      }

      card.addEventListener('click', () => this.openViewer(idx));
      grid.appendChild(card);
    });
  },

  setupViewer() {
    const video = Utils.$('#footage-video');
    const stage = Utils.$('#footage-stage');
    const viewer = Utils.$('#footage-viewer');
    const closeBtn = Utils.$('#footage-viewer-close');
    const prevBtn = Utils.$('#footage-prev-btn');
    const nextBtn = Utils.$('#footage-next-btn');
    const playBtn = Utils.$('#footage-play-btn');
    const centerPlayBtn = Utils.$('#footage-center-play');
    const volBtn = Utils.$('#footage-volume-btn');
    const speedBtn = Utils.$('#footage-speed-btn');
    const fsBtn = Utils.$('#footage-fullscreen-btn');

    if (!video || !stage) return;

    const savedVol = localStorage.getItem('fsv-footage-volume');
    if (savedVol !== null) this.volume = parseFloat(savedVol);
    const savedMuted = localStorage.getItem('fsv-footage-muted');
    if (savedMuted !== null) this.isMuted = savedMuted === 'true';
    video.volume = this.volume;
    video.muted = this.isMuted;
    this.updateVolumeUI();

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeViewer());

    if (viewer) {
      viewer.addEventListener('click', (e) => {
        if (e.target === viewer) this.closeViewer();
      });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => this.step(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.step(1));
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
    if (centerPlayBtn) centerPlayBtn.addEventListener('click', () => this.togglePlay());
    if (volBtn) volBtn.addEventListener('click', () => this.toggleMute());
    if (fsBtn) fsBtn.addEventListener('click', () => this.toggleFullscreen());
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        this.rateIdx = (this.rateIdx + 1) % this.playbackRates.length;
        const rate = this.playbackRates[this.rateIdx];
        video.playbackRate = rate;
        speedBtn.textContent = `${rate}x`;
      });
    }

    video.addEventListener('click', () => this.togglePlay());

    video.addEventListener('play', () => this.updatePlayUI(true));
    video.addEventListener('pause', () => this.updatePlayUI(false));
    video.addEventListener('timeupdate', () => this.updateTimeUI());
    video.addEventListener('progress', () => this.updateBufferedUI());
    video.addEventListener('loadedmetadata', () => this.updateTimeUI());
    video.addEventListener('waiting', () => Utils.show(Utils.$('#footage-loading')));
    video.addEventListener('canplay', () => Utils.hide(Utils.$('#footage-loading')));
    video.addEventListener('ended', () => {
      if (this.currentVideo !== null && this.currentVideo < this.videos.length - 1) {
        this.step(1);
      }
    });

    document.addEventListener('fullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenUI());

    this._setupSlider(Utils.$('#footage-seek-bar'), (fraction) => {
      if (video.duration) video.currentTime = fraction * video.duration;
    });
    this._setupSlider(Utils.$('#footage-volume-bar'), (fraction) => {
      this.setVolume(fraction);
    });

    ['mousemove', 'touchstart', 'click'].forEach(evt => {
      stage.addEventListener(evt, () => this.showControls());
    });

    stage.addEventListener('mouseleave', () => this.hideControlsNow());

    const controlsEl = Utils.$('#footage-controls');
    if (controlsEl) {
      controlsEl.addEventListener('mouseenter', () => clearTimeout(this.hideTimer));
      controlsEl.addEventListener('mouseleave', () => this.scheduleHide());
    }

    document.addEventListener('keydown', (e) => {
      if (this.currentVideo === null) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

      const activeVideo = this.videos[this.currentVideo];
      const isYoutube = activeVideo && activeVideo.type === 'youtube';

      switch (e.key === ' ' ? ' ' : e.key.toLowerCase()) {
        case 'escape':
          this.closeViewer();
          break;
        case ' ':
          if (!isYoutube) { e.preventDefault(); this.togglePlay(); }
          break;
        case 'arrowleft':
          if (!isYoutube) { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); }
          break;
        case 'arrowright':
          if (!isYoutube) { e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); }
          break;
        case 'arrowup':
          if (!isYoutube) { e.preventDefault(); this.setVolume(Math.min(1, this.volume + 0.05)); }
          break;
        case 'arrowdown':
          if (!isYoutube) { e.preventDefault(); this.setVolume(Math.max(0, this.volume - 0.05)); }
          break;
        case 'm':
          if (!isYoutube) this.toggleMute();
          break;
        case 'f':
          this.toggleFullscreen();
          break;
        case 'n':
          this.step(1);
          break;
        case 'p':
          this.step(-1);
          break;
      }
      if (!isYoutube) this.showControls();
    });
  },

  _setupSlider(bar, onChange) {
    if (!bar) return;
    let dragging = false;

    const fractionFromEvent = (clientX) => {
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const start = (clientX) => {
      dragging = true;
      bar.classList.add('dragging');
      onChange(fractionFromEvent(clientX));
    };
    const move = (clientX) => {
      if (dragging) onChange(fractionFromEvent(clientX));
    };
    const end = () => {
      dragging = false;
      bar.classList.remove('dragging');
    };

    bar.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      bar.setPointerCapture(e.pointerId);
      start(e.clientX);
    });
    bar.addEventListener('pointermove', (e) => { if (dragging) move(e.clientX); });
    const finish = (e) => {
      if (dragging) { try { bar.releasePointerCapture(e.pointerId); } catch (_) {} }
      end();
    };
    bar.addEventListener('pointerup', finish);
    bar.addEventListener('pointercancel', finish);

    bar.setAttribute('tabindex', '0');
  },

  openViewer(idx) {
    const video = this.videos[idx];
    if (!video) return;

    this.currentVideo = idx;
    const isYoutube = video.type === 'youtube';
    const viewer = Utils.$('#footage-viewer');
    const videoEl = Utils.$('#footage-video');
    const youtubeEl = Utils.$('#footage-youtube');
    const controls = Utils.$('#footage-controls');

    this.rateIdx = 1;
    const speedBtn = Utils.$('#footage-speed-btn');
    if (speedBtn) speedBtn.textContent = '1x';

    if (isYoutube) {
      if (videoEl) { videoEl.pause(); videoEl.src = ''; Utils.hide(videoEl); }
      if (youtubeEl) {
        youtubeEl.title = video.title || '';
        youtubeEl.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`;
        Utils.show(youtubeEl);
      }
      if (controls) Utils.hide(controls);
    } else {
      if (youtubeEl) { youtubeEl.src = ''; Utils.hide(youtubeEl); }
      if (videoEl) {
        Utils.show(videoEl);
        videoEl.src = `footage/${video.file}`;
        videoEl.playbackRate = this.playbackRates[this.rateIdx];
        videoEl.play().catch(() => {});
      }
      if (controls) Utils.show(controls);
    }

    if (viewer) Utils.show(viewer);

    const titleEl = Utils.$('#footage-video-title');
    const descEl = Utils.$('#footage-video-desc');
    const counterEl = Utils.$('#footage-video-counter');
    if (titleEl) titleEl.textContent = video.title || '';
    if (descEl) descEl.textContent = video.description || '';
    if (counterEl) counterEl.textContent = `${idx + 1} / ${this.videos.length}`;

    this.updateNavArrows();
    if (!isYoutube) this.showControls();

    if (Player.isPlaying) Player.togglePlay();
  },

  closeViewer() {
    this.currentVideo = null;
    const viewer = Utils.$('#footage-viewer');
    const videoEl = Utils.$('#footage-video');
    const youtubeEl = Utils.$('#footage-youtube');

    if (videoEl) {
      videoEl.pause();
      videoEl.src = '';
    }
    if (youtubeEl) youtubeEl.src = '';
    if (viewer) Utils.hide(viewer);
    clearTimeout(this.hideTimer);

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
  },

  step(direction) {
    if (this.currentVideo === null) return;
    const nextIdx = this.currentVideo + direction;
    const inRange = nextIdx >= 0 && nextIdx < this.videos.length;
    if (inRange) this.openViewer(nextIdx);
  },

  updateNavArrows() {
    const prevBtn = Utils.$('#footage-prev-btn');
    const nextBtn = Utils.$('#footage-next-btn');
    if (prevBtn) prevBtn.classList.toggle('hidden', this.currentVideo <= 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', this.currentVideo >= this.videos.length - 1);
  },

  togglePlay() {
    const video = Utils.$('#footage-video');
    if (!video || !video.src) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  },

  setVolume(fraction) {
    const video = Utils.$('#footage-video');
    this.volume = Math.max(0, Math.min(1, fraction));
    if (video) video.volume = this.volume;
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
      if (video) video.muted = false;
    }
    localStorage.setItem('fsv-footage-volume', this.volume);
    localStorage.setItem('fsv-footage-muted', this.isMuted);
    this.updateVolumeUI();
  },

  toggleMute() {
    const video = Utils.$('#footage-video');
    this.isMuted = !this.isMuted;
    if (video) video.muted = this.isMuted;
    localStorage.setItem('fsv-footage-muted', this.isMuted);
    this.updateVolumeUI();
  },

  toggleFullscreen() {
    const stage = Utils.$('#footage-stage');
    if (!stage) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(() => {});
    }
  },

  showControls() {
    const controls = Utils.$('#footage-controls');
    if (controls) controls.classList.remove('controls-hidden');
    this.scheduleHide();
  },

  scheduleHide() {
    clearTimeout(this.hideTimer);
    const video = Utils.$('#footage-video');
    if (!video || video.paused) return;
    this.hideTimer = setTimeout(() => {
      const controls = Utils.$('#footage-controls');
      if (controls) controls.classList.add('controls-hidden');
    }, 3000);
  },

  hideControlsNow() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      const controls = Utils.$('#footage-controls');
      if (controls) controls.classList.add('controls-hidden');
    }, 250);
  },

  updatePlayUI(isPlaying) {
    Utils.$$('.footage-icon-play').forEach(icon => icon.classList.toggle('hidden', isPlaying));
    Utils.$$('.footage-icon-pause').forEach(icon => icon.classList.toggle('hidden', !isPlaying));
    if (isPlaying) this.scheduleHide();
    else { clearTimeout(this.hideTimer); this.showControls(); }
  },

  updateTimeUI() {
    const video = Utils.$('#footage-video');
    const curr = Utils.$('#footage-current-time');
    const tot = Utils.$('#footage-total-time');
    const progress = Utils.$('#footage-seek-progress');
    const thumb = Utils.$('#footage-seek-thumb');
    const seekBar = Utils.$('#footage-seek-bar');
    if (!video) return;

    if (curr) curr.textContent = Utils.formatTime(video.currentTime);
    if (tot) tot.textContent = Utils.formatTime(video.duration);

    if (video.duration) {
      const pct = (video.currentTime / video.duration) * 100;
      if (progress) progress.style.width = `${pct}%`;
      if (thumb) thumb.style.left = `${pct}%`;
      if (seekBar) {
        seekBar.setAttribute('aria-valuenow', Math.round(pct));
        seekBar.setAttribute('aria-valuetext', `${Utils.formatTime(video.currentTime)} of ${Utils.formatTime(video.duration)}`);
      }
    }
  },

  updateBufferedUI() {
    const video = Utils.$('#footage-video');
    const buffered = Utils.$('#footage-seek-buffered');
    if (!video || !buffered) return;
    if (video.buffered.length > 0 && video.duration) {
      const end = video.buffered.end(video.buffered.length - 1);
      buffered.style.width = `${(end / video.duration) * 100}%`;
    }
  },

  updateVolumeUI() {
    const fill = Utils.$('#footage-volume-fill');
    const thumb = Utils.$('#footage-volume-thumb');
    const bar = Utils.$('#footage-volume-bar');
    const effectiveVol = this.isMuted ? 0 : this.volume;
    const pct = effectiveVol * 100;

    if (fill) fill.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    if (bar) {
      bar.setAttribute('aria-valuenow', Math.round(pct));
      bar.setAttribute('aria-valuetext', `${Math.round(pct)}%${this.isMuted ? ' (muted)' : ''}`);
    }

    const high = Utils.$('.footage-icon-vol-high');
    const low = Utils.$('.footage-icon-vol-low');
    const mute = Utils.$('.footage-icon-vol-mute');
    const showMute = this.isMuted || effectiveVol === 0;
    const showLow = !showMute && effectiveVol > 0 && effectiveVol < 0.5;
    if (high) high.classList.toggle('hidden', showMute || showLow);
    if (low) low.classList.toggle('hidden', !showLow);
    if (mute) mute.classList.toggle('hidden', !showMute);
  },

  updateFullscreenUI() {
    const enter = Utils.$('.footage-icon-fs-enter');
    const exit = Utils.$('.footage-icon-fs-exit');
    const isFs = !!document.fullscreenElement;
    if (enter) enter.classList.toggle('hidden', isFs);
    if (exit) exit.classList.toggle('hidden', !isFs);
  }
};
