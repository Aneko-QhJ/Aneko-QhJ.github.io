(() => {
    let preference = 'system';
    try {
        const saved = localStorage.getItem('aneko-theme');
        if (['system', 'light', 'dark'].includes(saved)) preference = saved;
    } catch (_) {}
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : preference;
})();
