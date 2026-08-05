window.App = {
  init() {
    Player.init();
    Sidebar.init();
    Search.init();
    Footage.init();
    Settings.init();

    Player.onTrackChange = (projectId, trackIdx) => {
      Sidebar.highlightPlaying(projectId, trackIdx);
    };

    const playAllBtn = Utils.$('#play-all-btn');
    const shufflePlayBtn = Utils.$('#shuffle-play-btn');

    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        if (Sidebar.selectedProjectId) {
          Player.loadAndPlay(Sidebar.selectedProjectId, 0);
        }
      });
    }

    if (shufflePlayBtn) {
      shufflePlayBtn.addEventListener('click', () => {
        if (Sidebar.selectedProjectId) {
          const project = getProject(Sidebar.selectedProjectId);
          if (!project) return;
          if (!Player.shuffleOn) Player.toggleShuffle();
          const randomIdx = Math.floor(Math.random() * project.tracks.length);
          Player.loadAndPlay(Sidebar.selectedProjectId, randomIdx);
        }
      });
    }

    Utils.$$('#play-btn').forEach(btn => btn.addEventListener('click', () => Player.togglePlay()));
    Utils.$$('#prev-btn').forEach(btn => btn.addEventListener('click', () => Player.playPrev()));
    Utils.$$('#next-btn').forEach(btn => btn.addEventListener('click', () => Player.playNext(true)));
    Utils.$$('#shuffle-btn').forEach(btn => btn.addEventListener('click', () => Player.toggleShuffle()));
    Utils.$$('#repeat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Player.setRepeatMode(Player.repeatMode === 'off' ? 'one' : 'off');
      });
    });
    Utils.$$('#volume-btn').forEach(btn => btn.addEventListener('click', () => Player.toggleMute()));

    this.setupSeekBar();
    this.setupVolumeBar();
    this.setupKeyboardShortcuts();
    this.setupMobileNavigation();
    this.setupBugModal();

    Sidebar.showHome();

    this.playIntro();
  },

  playIntro() {
    const splash = Utils.$('#intro-splash');
    if (!splash) return;

    const prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      splash.remove();
      return;
    }

    setTimeout(() => {
      splash.classList.add('intro-hide');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    }, 2200);
  },

  setupSeekBar() {
    const seekBar = Utils.$('#seek-bar');
    if (!seekBar) return;

    let pendingFraction = null;
    let throttleTimer = null;

    const commitSeek = (fraction) => {
      pendingFraction = null;
      Player.seekTo(fraction);
    };

    const flushPending = () => {
      clearTimeout(throttleTimer);
      throttleTimer = null;
      if (pendingFraction !== null) commitSeek(pendingFraction);
    };

    this._setupSlider(seekBar, (fraction) => {
      if (throttleTimer === null && pendingFraction === null) {
        commitSeek(fraction);
        throttleTimer = setTimeout(() => { throttleTimer = null; }, 150);
        return;
      }
      pendingFraction = fraction;
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        if (pendingFraction !== null) commitSeek(pendingFraction);
      }, 150);
    });

    seekBar.addEventListener('pointerup', flushPending);
    seekBar.addEventListener('pointercancel', flushPending);
  },

  setupVolumeBar() {
    const volumeBar = Utils.$('#volume-bar');
    if (!volumeBar) return;

    this._setupSlider(volumeBar, (fraction) => Player.setVolume(fraction));
  },

  _setupSlider(bar, onChange) {
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
      if (!dragging) return;
      onChange(fractionFromEvent(clientX));
    };

    const end = () => {
      dragging = false;
      bar.classList.remove('dragging');
    };

    bar.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      start(e.clientX);
    });
    bar.addEventListener('pointermove', (e) => {
      if (dragging) move(e.clientX);
    });
    const finish = (e) => {
      if (dragging) {
        try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      end();
    };
    bar.addEventListener('pointerup', finish);
    bar.addEventListener('pointercancel', finish);
    bar.addEventListener('pointerleave', (e) => {
      if (!dragging && e.buttons === 0) {
        try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    bar.setAttribute('tabindex', '0');
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.addEventListener('keydown', (e) => {
      if (bar === Utils.$('#volume-bar')) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          Player.setVolume(Math.max(0, Player.volume - 0.05));
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          Player.setVolume(Math.min(1, Player.volume + 0.05));
        }
      } else {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          Player.seekTo(Math.max(0, (Player.audio.currentTime - 5) / (Player.audio.duration || 1)));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          Player.seekTo(Math.min(1, (Player.audio.currentTime + 5) / (Player.audio.duration || 1)));
        }
      }
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (Footage.currentVideo !== null) return;

      if (e.key === 'Escape') {
        const input = Utils.$('#search-input');
        if (input && document.activeElement === input) {
          input.value = '';
          input.blur();
          Utils.hide(Utils.$('#search-clear'));
          Sidebar.clearFilter();
          return;
        }
      }

      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          Player.togglePlay();
          break;
        case 'arrowleft':
          if (!e.target.classList || !e.target.matches('#seek-bar, #volume-bar')) {
            e.preventDefault();
            Player.seekTo(Math.max(0, (Player.audio.currentTime - 5) / (Player.audio.duration || 1)));
          }
          break;
        case 'arrowright':
          if (!e.target.classList || !e.target.matches('#seek-bar, #volume-bar')) {
            e.preventDefault();
            Player.seekTo(Math.min(1, (Player.audio.currentTime + 5) / (Player.audio.duration || 1)));
          }
          break;
        case 'arrowup':
          if (!e.target.classList || !e.target.matches('#volume-bar')) {
            e.preventDefault();
            Player.setVolume(Math.min(1, Player.volume + 0.05));
          }
          break;
        case 'arrowdown':
          if (!e.target.classList || !e.target.matches('#volume-bar')) {
            e.preventDefault();
            Player.setVolume(Math.max(0, Player.volume - 0.05));
          }
          break;
        case 'n':
          Player.playNext(true);
          break;
        case 'p':
          Player.playPrev();
          break;
        case 'm':
          Player.toggleMute();
          break;
        case 's':
          Player.toggleShuffle();
          break;
        case 'r':
          Player.setRepeatMode(Player.repeatMode === 'off' ? 'one' : 'off');
          break;
      }
    });
  },

  setupMobileNavigation() {
    const toggleBtn = Utils.$('#mobile-sidebar-toggle');
    const sidebar = Utils.$('#left-sidebar');
    const overlay = Utils.$('#sidebar-overlay');

    if (!toggleBtn || !sidebar || !overlay) return;

    const close = () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('mobile-open');
    };

    toggleBtn.addEventListener('click', () => {
      const willOpen = !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', willOpen);
      overlay.classList.toggle('mobile-open', willOpen);
    });

    overlay.addEventListener('click', close);

    Utils.$$('#logo-link, #mobile-logo-link, #nav-home, #nav-footage, #nav-settings, #nav-library, .project-item').forEach(el => {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  },

  setupBugModal() {
    const modal = Utils.$('#bug-modal');
    const openBtn = Utils.$('#nav-library');
    if (!modal || !openBtn) return;

    const closeBtn = Utils.$('#bug-modal-close');
    const backdrop = Utils.$('#bug-modal .modal-backdrop');
    const close = () => Utils.hide(modal);

    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Utils.show(modal);
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
