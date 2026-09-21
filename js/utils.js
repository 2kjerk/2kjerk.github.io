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
        <svg class="icon-dl" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4h14v-2H5v2z"/></svg>
        <svg class="icon-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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

  getCoverUrl(project) {
    if (project && project.cover) return project.cover;
    if (project && project.coverFallback) return project.coverFallback;
    return 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22><defs><linearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22><stop offset=%220%22 stop-color=%22%23191429%22/><stop offset=%221%22 stop-color=%22%230b0d13%22/></linearGradient></defs><rect width=%22200%22 height=%22200%22 fill=%22url(%23g)%22/><g><circle cx=%2276%22 cy=%22148%22 r=%2218%22 fill=%22%23ff2d7b%22/><circle cx=%22132%22 cy=%22108%22 r=%2218%22 fill=%22%23ff2d7b%22/><path d=%22M94 130 V64 L150 50 V90%22 fill=%22none%22 stroke=%22%23ff2d7b%22 stroke-width=%2211%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></g></svg>';
  }
};
