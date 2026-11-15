window.App = {
  init() {
    Player.init();
    Sidebar.init();
    Search.init();
    Footage.init();
    Booth.init();
    Settings.init();

    Player.onTrackChange = (projectId, trackIdx) => {
      Sidebar.highlightPlaying(projectId, trackIdx);
      if (window.Booth) Booth.highlightPlaying(projectId, trackIdx);
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

    const shuffleAllBtn = Utils.$('#shuffle-all-btn');
    if (shuffleAllBtn) {
      shuffleAllBtn.addEventListener('click', () => {
        Player.shuffleAll();
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

    this._s8k2();
    this._v3b7();
    this._k7p9();
    this._m2n8();
    this._b1q5();
    this._f6w3();
    this._d9m4();

    Sidebar.showHome();
  },

  _d9m4() {
    const modal = Utils.$('#discord-modal');
    if (!modal) return;

    const STORAGE_KEY = 'fsv_discord_dont_show';
    const DISCORD_INVITE_URL = 'https://discord.gg/fgTVrGpZW8';

    let hideModal = false;
    try {
      hideModal = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) {
      hideModal = false;
    }

    const checkbox = Utils.$('#discord-dont-show');
    const btnYes = Utils.$('#discord-btn-yes');
    const btnNo = Utils.$('#discord-btn-no');
    const closeBtn = Utils.$('#discord-modal-close');
    const backdrop = Utils.$('#discord-modal-backdrop');

    const _h4c9 = (accepted) => {
      const dontShow = checkbox ? checkbox.checked : true;
      try {
        if (dontShow) {
          localStorage.setItem(STORAGE_KEY, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {}

      Utils.hide(modal);

      if (accepted && DISCORD_INVITE_URL) {
        window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
      }
    };

    if (btnYes) {
      btnYes.addEventListener('click', () => _h4c9(true));
    }

    if (btnNo) {
      btnNo.addEventListener('click', () => _h4c9(false));
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => _h4c9(false));
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => _h4c9(false));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        _h4c9(false);
      }
    });

    if (!hideModal) {
      Utils.show(modal);
    }
  },

  _s8k2() {
    const seekBar = Utils.$('#seek-bar');
    if (!seekBar) return;

    let pendingFraction = null;
    let throttleTimer = null;

    const _c2s7 = (fraction) => {
      pendingFraction = null;
      Player.seekTo(fraction);
    };

    const _f9p1 = () => {
      clearTimeout(throttleTimer);
      throttleTimer = null;
      if (pendingFraction !== null) _c2s7(pendingFraction);
    };

    this._u5x1(seekBar, (fraction) => {
      if (throttleTimer === null && pendingFraction === null) {
        _c2s7(fraction);
        throttleTimer = setTimeout(() => { throttleTimer = null; }, 150);
        return;
      }
      pendingFraction = fraction;
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        if (pendingFraction !== null) _c2s7(pendingFraction);
      }, 150);
    });

    seekBar.addEventListener('pointerup', _f9p1);
    seekBar.addEventListener('pointercancel', _f9p1);
  },

  _v3b7() {
    const volumeBar = Utils.$('#volume-bar');
    if (!volumeBar) return;

    this._u5x1(volumeBar, (fraction) => Player.setVolume(fraction));
  },

  _u5x1(bar, onChange) {
    let dragging = false;

    const _f8e3 = (clientX) => {
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const _s1t4 = (clientX) => {
      dragging = true;
      bar.classList.add('dragging');
      onChange(_f8e3(clientX));
    };

    const _m7v2 = (clientX) => {
      if (!dragging) return;
      onChange(_f8e3(clientX));
    };

    const _e5d8 = () => {
      dragging = false;
      bar.classList.remove('dragging');
    };

    bar.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      _s1t4(e.clientX);
    });
    bar.addEventListener('pointermove', (e) => {
      if (dragging) _m7v2(e.clientX);
    });
    const _f3n9 = (e) => {
      if (dragging) {
        try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      _e5d8();
    };
    bar.addEventListener('pointerup', _f3n9);
    bar.addEventListener('pointercancel', _f3n9);
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

  _k7p9() {
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
        case 'f':
          if (this._fsPlayer && !this._fsPlayer.classList.contains('hidden')) {
            this._c6f2();
          } else if (this._openFullscreen) {
            this._openFullscreen();
          }
          break;
      }
    });
  },

  _m2n8() {
    const toggleBtn = Utils.$('#mobile-sidebar-toggle');
    const sidebar = Utils.$('#left-sidebar');
    const overlay = Utils.$('#sidebar-overlay');

    if (!toggleBtn || !sidebar || !overlay) return;

    const _c8l1 = () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('mobile-open');
    };

    toggleBtn.addEventListener('click', () => {
      const willOpen = !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', willOpen);
      overlay.classList.toggle('mobile-open', willOpen);
    });

    overlay.addEventListener('click', _c8l1);

    Utils.$$('#logo-link, #mobile-logo-link, #nav-home, #nav-booth, #nav-footage, #nav-settings, #nav-library, .project-item').forEach(el => {
      el.addEventListener('click', _c8l1);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _c8l1();
    });
  },

  _f6w3() {
    const fsPlayer = Utils.$('#fullscreen-player');
    const fsBtn = Utils.$('#fullscreen-btn');
    const fsCloseBtn = Utils.$('#fs-close-btn');
    if (!fsPlayer || !fsBtn) return;

    const _o4f7 = () => {
      if (!Player.audio.src) return;
      Player.updateFullscreenInfo();
      Utils.show(fsPlayer);
      requestAnimationFrame(() => fsPlayer.classList.add('fs-player-open'));
      document.body.style.overflow = 'hidden';
    };

    const _c6f2 = () => {
      fsPlayer.classList.remove('fs-player-open');
      setTimeout(() => {
        Utils.hide(fsPlayer);
        document.body.style.overflow = '';
      }, 400);
    };

    fsBtn.addEventListener('click', _o4f7);
    if (fsCloseBtn) fsCloseBtn.addEventListener('click', _c6f2);

    const barLeft = Utils.$('.bar-left');
    if (barLeft) {
      barLeft.style.cursor = 'pointer';
      barLeft.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A') _o4f7();
      });
    }

    const fsPlayBtn = Utils.$('#fs-play-btn');
    if (fsPlayBtn) fsPlayBtn.addEventListener('click', () => Player.togglePlay());

    const fsPrevBtn = Utils.$('#fs-prev-btn');
    const fsNextBtn = Utils.$('#fs-next-btn');
    if (fsPrevBtn) fsPrevBtn.addEventListener('click', () => Player.playPrev());
    if (fsNextBtn) fsNextBtn.addEventListener('click', () => Player.playNext(true));

    const fsShuffleBtn = Utils.$('#fs-shuffle-btn');
    if (fsShuffleBtn) fsShuffleBtn.addEventListener('click', () => Player.toggleShuffle());

    const fsRepeatBtn = Utils.$('#fs-repeat-btn');
    if (fsRepeatBtn) fsRepeatBtn.addEventListener('click', () => {
      Player.setRepeatMode(Player.repeatMode === 'off' ? 'one' : 'off');
    });

    const fsDownloadBtn = Utils.$('#fs-download-btn');
    if (fsDownloadBtn) fsDownloadBtn.addEventListener('click', () => {
      const track = Player.getCurrentTrack();
      if (track) Utils.downloadTrack(track, fsDownloadBtn);
    });

    const fsSeekBar = Utils.$('#fs-seek-bar');
    if (fsSeekBar) {
      this._u5x1(fsSeekBar, (fraction) => Player.seekTo(fraction));
    }

    const fsVolumeBar = Utils.$('#fs-volume-bar');
    if (fsVolumeBar) {
      this._u5x1(fsVolumeBar, (fraction) => Player.setVolume(fraction));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !fsPlayer.classList.contains('hidden')) {
        _c6f2();
      }
    });

    this._openFullscreen = _o4f7;
    this._c6f2 = _c6f2;
    this._fsPlayer = fsPlayer;
  },

  _b1q5() {
    const modal = Utils.$('#bug-modal');
    const openBtn = Utils.$('#nav-library');
    if (!modal || !openBtn) return;

    const closeBtn = Utils.$('#bug-modal-close');
    const backdrop = Utils.$('#bug-modal .modal-backdrop');
    const _c8l1 = () => Utils.hide(modal);

    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Utils.show(modal);
    });

    if (closeBtn) closeBtn.addEventListener('click', _c8l1);
    if (backdrop) backdrop.addEventListener('click', _c8l1);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _c8l1();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
