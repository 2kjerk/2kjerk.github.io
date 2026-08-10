window.Settings = {
  presets: ['#ff2d7b', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#af52de', '#ff6482'],
  defaultAccent: '#ff2d7b',
  storageKey: 'fsv-accent',
  eqStorageKey: 'fsv-eq',

  init() {
    this.grid = Utils.$('#accent-swatch-grid');
    this.customInput = Utils.$('#accent-custom-input');
    this.resetBtn = Utils.$('#accent-reset-btn');

    this.renderSwatches();
    this.initEq();

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

  initEq() {
    this.eqGrid = Utils.$('#eq-band-grid');
    this.eqEnabledInput = Utils.$('#eq-enabled');
    this.eqResetBtn = Utils.$('#eq-reset-btn');
    this.eqUnavailableNotice = Utils.$('#eq-unavailable-notice');

    this.renderEqBands();

    const saved = this.loadEqSettings();
    Player.applyEqSettings(saved);
    this.syncEqUI(saved);

    if (!Player.eqAvailable) {
      if (this.eqUnavailableNotice) Utils.show(this.eqUnavailableNotice);
      this.syncEqDisabledState(true);
    }

    if (this.eqEnabledInput) {
      this.eqEnabledInput.addEventListener('change', () => {
        if (!Player.eqAvailable) return;
        Player.setEqEnabled(this.eqEnabledInput.checked);
        this.saveEqSettings(Player.getEqSettings());
        this.syncEqDisabledState();
      });
    }

    if (this.eqResetBtn) {
      this.eqResetBtn.addEventListener('click', () => {
        if (!Player.eqAvailable) return;
        Player.resetEq();
        this.syncEqUI(Player.getEqSettings());
        this.saveEqSettings(Player.getEqSettings());
      });
    }
  },

  renderEqBands() {
    if (!this.eqGrid) return;
    this.eqGrid.innerHTML = '';

    Player.eqBands.forEach((band, index) => {
      const bandEl = document.createElement('div');
      bandEl.className = 'eq-band';

      const valueEl = document.createElement('span');
      valueEl.className = 'eq-band-value';
      valueEl.id = `eq-band-value-${index}`;
      valueEl.textContent = '0 dB';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'eq-band-slider';
      slider.id = `eq-band-${index}`;
      slider.min = String(Player.eqMinDb);
      slider.max = String(Player.eqMaxDb);
      slider.step = '1';
      slider.value = '0';
      slider.setAttribute('aria-label', `${band.label} Hz band`);
      slider.setAttribute('aria-valuemin', String(Player.eqMinDb));
      slider.setAttribute('aria-valuemax', String(Player.eqMaxDb));
      slider.setAttribute('aria-valuenow', '0');

      slider.addEventListener('input', () => {
        if (!Player.eqAvailable) return;
        const gain = parseFloat(slider.value);
        Player.ensureAudioReady();
        Player.setEqBand(index, gain);
        valueEl.textContent = this.formatEqGain(gain);
        slider.setAttribute('aria-valuenow', String(gain));
        this.saveEqSettings(Player.getEqSettings());
      });

      const label = document.createElement('span');
      label.className = 'eq-band-label';
      label.textContent = band.label;

      bandEl.appendChild(valueEl);
      bandEl.appendChild(slider);
      bandEl.appendChild(label);
      this.eqGrid.appendChild(bandEl);
    });
  },

  loadEqSettings() {
    const defaults = {
      enabled: true,
      gains: Player.eqBands.map(() => 0)
    };

    try {
      const raw = localStorage.getItem(this.eqStorageKey);
      if (!raw) return defaults;

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.gains)) return defaults;

      return {
        enabled: parsed.enabled !== false,
        gains: Player.eqBands.map((_, i) => {
          const gain = parsed.gains[i];
          if (typeof gain !== 'number' || Number.isNaN(gain)) return 0;
          return Math.max(Player.eqMinDb, Math.min(Player.eqMaxDb, gain));
        })
      };
    } catch (e) {
      return defaults;
    }
  },

  saveEqSettings(settings) {
    try {
      localStorage.setItem(this.eqStorageKey, JSON.stringify(settings));
    } catch (e) {}
  },

  syncEqUI(settings) {
    if (this.eqEnabledInput) {
      this.eqEnabledInput.checked = settings.enabled;
    }

    settings.gains.forEach((gain, index) => {
      const slider = Utils.$(`#eq-band-${index}`);
      const valueEl = Utils.$(`#eq-band-value-${index}`);
      if (slider) {
        slider.value = String(gain);
        slider.setAttribute('aria-valuenow', String(gain));
      }
      if (valueEl) valueEl.textContent = this.formatEqGain(gain);
    });

    this.syncEqDisabledState();
  },

  syncEqDisabledState(forceDisabled) {
    const disabled = forceDisabled || !Player.eqAvailable || (this.eqEnabledInput && !this.eqEnabledInput.checked);
    if (this.eqGrid) this.eqGrid.classList.toggle('eq-disabled', disabled);
    Utils.$$('.eq-band-slider').forEach(slider => {
      slider.disabled = disabled;
    });
    if (this.eqEnabledInput) this.eqEnabledInput.disabled = !Player.eqAvailable;
    if (this.eqResetBtn) this.eqResetBtn.disabled = !Player.eqAvailable;
  },

  formatEqGain(gain) {
    const rounded = Math.round(gain);
    return rounded > 0 ? `+${rounded} dB` : `${rounded} dB`;
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
