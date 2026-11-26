window.Utils = {
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  },

  $(selector) {
    return document.querySelector(selector);
  },
  $$(selector) {
    return document.querySelectorAll(selector);
  },

  show(el) {
    if (el) el.classList.remove('hidden');
  },
  hide(el) {
    if (el) el.classList.add('hidden');
  },
  toggle(el) {
    if (el) el.classList.toggle('hidden');
  },

  debounce(fn, ms = 200) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  displayTitle(title) {
    if (!title) return '';
    return title
      .replace(/^_\s*/, '')
      .replace(/\s*_$/, '')
      .replace(/_/g, ' ')
      .trim();
  },

  getCachedDuration(src) {
    try {
      const v = localStorage.getItem('fsv-dur-' + src);
      return v === null ? null : parseFloat(v);
    } catch (e) {
      return null;
    }
  },

  setCachedDuration(src, duration) {
    try {
      localStorage.setItem('fsv-dur-' + src, duration);
    } catch (e) {}
  },

  getDownloadUrl(src) {
    if (!src) return '';
    if (/^https?:/i.test(src)) return src;
    const path = src.split('/').map(encodeURIComponent).join('/');
    return 'https://github.com/2kjerk/2kjerk.github.io/raw/refs/heads/master/' + path;
  },

  downloadButtonHtml(title) {
    const label = Utils.escapeHtml(Utils.displayTitle(title) || 'track');
    return `
      <button class="download-btn" aria-label="Download ${label}" title="Download">
        <svg class="icon-dl" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        <svg class="icon-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    `;
  },

  moreButtonHtml(title) {
    const label = Utils.escapeHtml(Utils.displayTitle(title) || 'track');
    return `
      <button type="button" class="track-more-btn" aria-label="More options for ${label}" title="Add to playlist">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
      </button>
    `;
  },

  bindDownloadButton(btn, track) {
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Utils.downloadTrack(track, btn);
    });
  },

  downloadTrack(track, btn) {
    if (!track || !track.src) return;
    const a = document.createElement('a');
    a.href = this.getDownloadUrl(track.src);
    a.download = (this.displayTitle(track.title) || 'track') + track.src.slice(track.src.lastIndexOf('.'));
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (btn) {
      btn.classList.add('is-done');
      clearTimeout(btn._dlTimer);
      btn._dlTimer = setTimeout(() => btn.classList.remove('is-done'), 1600);
    }
  },

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  },

  DEFAULT_LOGO: 'images/logo.png',

  getCoverUrl(project) {
    if (project && project.cover) return project.cover;
    if (project && project.coverFallback) return project.coverFallback;
    return this.DEFAULT_LOGO;
  }
};
