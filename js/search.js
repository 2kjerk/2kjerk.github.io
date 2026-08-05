window.Search = {
  init() {
    const input = Utils.$('#search-input');
    const clearBtn = Utils.$('#search-clear');
    if (!input) return;

    const onInput = () => {
      const val = input.value.trim();
      if (!val.length) {
        Utils.hide(clearBtn);
        Sidebar.clearFilter();
        return;
      }
      Utils.show(clearBtn);
      Sidebar.showHome();
      Sidebar.filter(val);
    };

    input.addEventListener('input', Utils.debounce(onInput, 150));

    if (!clearBtn) return;
    clearBtn.addEventListener('click', () => {
      input.value = '';
      Utils.hide(clearBtn);
      Sidebar.clearFilter();
      input.focus();
    });
  }
};
