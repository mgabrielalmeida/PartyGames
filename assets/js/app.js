/* =========================================
   app.js — Lógica Global, Transições & Tema
   ========================================= */

(function () {
    'use strict';

    /* ─── THEME TOGGLE ─────────────────────── */
    const THEME_KEY = 'party-games-theme';

    function getPreferredTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    }

    // Aplica o tema o mais cedo possível (antes do DOM render)
    applyTheme(getPreferredTheme());

    /* ─── INJECT THEME TOGGLE BUTTON ─────── */
    function injectThemeToggle() {
        if (document.getElementById('theme-toggle-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Alternar tema claro/escuro');
        btn.setAttribute('title', 'Alternar tema');
        btn.innerHTML = `
            <span class="icon-sun">☀️</span>
            <span class="icon-moon">🌙</span>
        `;
        btn.addEventListener('click', toggleTheme);
        document.body.appendChild(btn);
    }

    /* ─── OVERLAY DE TRANSIÇÃO ─────────────── */
    // Cria o overlay que cobre a página e faz o fade-in/out
    function getOrCreateOverlay() {
        let overlay = document.getElementById('page-transition-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'page-transition-overlay';
            overlay.className = 'page-transition-overlay';
            document.body.prepend(overlay);
        }
        return overlay;
    }

    /* ─── RESOLVE AUDIO PATH ─────────────── */
    function resolveAudioPath() {
        const scripts = document.querySelectorAll('script[src*="app.js"]');
        let basePath = 'assets/';
        if (scripts.length > 0) {
            const src = scripts[0].getAttribute('src');
            basePath = src.substring(0, src.lastIndexOf('js/app.js'));
        }
        return basePath + 'audio/click.mp3';
    }

    /* ─── INICIALIZAÇÃO ────────────────────── */
    window.addEventListener('pageshow', () => {
        applyTheme(getPreferredTheme());
        injectThemeToggle();

        // Cria o overlay e faz o fade-in (overlay some, conteúdo aparece)
        const overlay = getOrCreateOverlay();
        // Força o overlay opaco primeiro, depois desvanece
        overlay.classList.remove('transparent');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('transparent');
            });
        });

        // CLICK SOUND
        const clickSound = new Audio(resolveAudioPath());
        clickSound.volume = 0.5;

        // INTERCEPT LINKS — fade-out antes de navegar
        document.querySelectorAll('a').forEach(link => {
            // Evita duplicar listeners
            if (link.dataset.transitionBound) return;
            link.dataset.transitionBound = 'true';

            link.addEventListener('click', (e) => {
                // Som de clique
                clickSound.cloneNode(true).play().catch(() => {});

                // Transição de saída
                if (link.href && link.target !== '_blank' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    const targetUrl = link.href;
                    const ov = getOrCreateOverlay();
                    ov.classList.remove('transparent');
                    ov.classList.add('fade-out');

                    // Navega após a transição (250ms = duração do CSS)
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 200);
                }
            });
        });
    });
})();