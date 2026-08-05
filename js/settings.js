window.Settings = {
  presets: ['#ff2d7b', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#af52de', '#ff6482'],
  defaultAccent: '#ff2d7b',
  storageKey: 'fsv-accent',

  init() {
    this.grid = Utils.$('#accent-swatch-grid');
    this.customInput = Utils.$('#accent-custom-input');
    this.resetBtn = Utils.$('#accent-reset-btn');

    this.renderSwatches();

    let saved = null;
    try { saved = localStorage.getItem(this.storageKey); } catch (e) {}

    this.applyAccent(this.isValidHex(saved) ? saved : this.defaultAccent, false);

    if (this.customInput) {
      this.customInput.addEventListener('input', () => {
        this.applyAccent(this.customInput.value, true);
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.applyAccent(this.defaultAccent, true);
      });
    }
  },

  isValidHex(hex) {
    return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex);
  },

  renderSwatches() {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    this.presets.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-swatch';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      btn.setAttribute('aria-label', `Set accent color to ${color}`);
      btn.addEventListener('click', () => this.applyAccent(color, true));
      this.grid.appendChild(btn);
    });
  },

  applyAccent(hex, save) {
    if (!this.isValidHex(hex)) hex = this.defaultAccent;
    hex = hex.toLowerCase();

    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-hover', this.shade(hex, 0.2));
    root.setProperty('--accent-dim', this.toRgba(hex, 0.1));

    if (this.customInput) this.customInput.value = hex;

    Utils.$$('.accent-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color.toLowerCase() === hex);
    });

    if (save) {
      try { localStorage.setItem(this.storageKey, hex); } catch (e) {}
    }
  },

  shade(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    const nr = Math.min(255, Math.round(r + (255 - r) * percent));
    const ng = Math.min(255, Math.round(g + (255 - g) * percent));
    const nb = Math.min(255, Math.round(b + (255 - b) * percent));
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
  },

  toRgba(hex, alpha) {
    const num = parseInt(hex.slice(1), 16);
    const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
};
