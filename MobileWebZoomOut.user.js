// ==UserScript==
// @name         Mobile Web ZoomOut
// @namespace    MobileWebZoomOut
// @version      20.0
// @description  Mobile web zoom with persistent zoom per website/domain
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    const PRESETS = [100, 90, 80, 70, 60, 50];

    const hostname = location.hostname
        .toLowerCase()
        .replace(/^www\./, '');

    const GM_KEY = 'MobileWebZoomOut::' + hostname;
    const LS_KEY = 'MobileWebZoomOut::' + hostname;
    const COOKIE_KEY = 'MobileWebZoomOutZoom';

    let savedZoom = loadZoom();

    // =========================================================
    // STORAGE
    // =========================================================

    function normalizeZoom(value) {
        const zoom = parseInt(value, 10);
        return PRESETS.includes(zoom) ? zoom : 100;
    }

    function readCookie() {
        try {
            const cookies = document.cookie.split(';');

            for (const cookie of cookies) {
                const parts = cookie.trim().split('=');

                if (parts[0] === COOKIE_KEY) {
                    return normalizeZoom(
                        decodeURIComponent(
                            parts.slice(1).join('=')
                        )
                    );
                }
            }
        } catch {}

        return null;
    }

    function writeCookie(zoom) {
        try {
            document.cookie =
                COOKIE_KEY +
                '=' +
                encodeURIComponent(zoom) +
                ';path=/;max-age=31536000;SameSite=Lax';
        } catch {}
    }

    function readLocalStorage() {
        try {
            const value = localStorage.getItem(LS_KEY);

            if (value !== null) {
                return normalizeZoom(value);
            }
        } catch {}

        return null;
    }

    function writeLocalStorage(zoom) {
        try {
            localStorage.setItem(
                LS_KEY,
                String(zoom)
            );
        } catch {}
    }

    function readGM() {
        try {
            const value = GM_getValue(
                GM_KEY,
                null
            );

            if (value !== null) {
                return normalizeZoom(value);
            }
        } catch {}

        return null;
    }

    function writeGM(zoom) {
        try {
            GM_setValue(
                GM_KEY,
                String(zoom)
            );
        } catch {}
    }

    function loadZoom() {
        const gmZoom = readGM();

        if (gmZoom !== null) {
            return gmZoom;
        }

        const localZoom = readLocalStorage();

        if (localZoom !== null) {
            writeGM(localZoom);
            return localZoom;
        }

        const cookieZoom = readCookie();

        if (cookieZoom !== null) {
            writeGM(cookieZoom);
            writeLocalStorage(cookieZoom);
            return cookieZoom;
        }

        return 100;
    }

    function saveZoom(zoom) {
        zoom = normalizeZoom(zoom);

        savedZoom = zoom;

        writeGM(zoom);
        writeLocalStorage(zoom);
        writeCookie(zoom);

        applyViewport();
        updateUI();
    }

    // =========================================================
    // VIEWPORT
    // =========================================================

    function getViewportContent(zoom) {

        const scale =
            (zoom / 100).toFixed(2);

        return [
            'width=device-width',
            `initial-scale=${scale}`,
            'minimum-scale=0.1',
            'maximum-scale=5',
            'user-scalable=yes'
        ].join(',');
    }

    function getViewportMeta() {

        let meta =
            document.querySelector(
                'meta[name="viewport"]'
            );

        if (!meta && document.head) {

            meta =
                document.createElement('meta');

            meta.name = 'viewport';

            document.head.insertBefore(
                meta,
                document.head.firstChild
            );
        }

        return meta;
    }

    function applyViewport() {

        const meta =
            getViewportMeta();

        if (!meta) return;

        const target =
            getViewportContent(
                savedZoom
            );

        if (
            meta.getAttribute('content') !==
            target
        ) {
            meta.setAttribute(
                'content',
                target
            );
        }
    }

    function applyInitialViewport() {
        applyViewport();
    }

    // =========================================================
    // FLOATING UI
    // =========================================================

    function getUI() {
        return document.getElementById(
            'mobile-web-zoomout-ui'
        );
    }

    function updateUIScale() {

        const ui = getUI();

        if (!ui) return;

        const scale =
            100 / savedZoom;

        ui.style.transform =
            `translateY(-50%) scale(${scale})`;
    }

    function updateUI() {

        const ui = getUI();

        if (!ui || !ui.shadowRoot) {
            return;
        }

        const buttons =
            ui.shadowRoot.querySelectorAll(
                '.zoom-option'
            );

        buttons.forEach(button => {

            const value =
                parseInt(
                    button.dataset.zoom,
                    10
                );

            button.classList.toggle(
                'active',
                value === savedZoom
            );
        });

        updateUIScale();
    }

    function createUI() {

        if (getUI()) {
            updateUI();
            return;
        }

        const ui =
            document.createElement('div');

        ui.id =
            'mobile-web-zoomout-ui';

        Object.assign(ui.style, {
            position: 'fixed',
            right: '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            transformOrigin: 'right center',
            zIndex: '2147483647',
            margin: '0',
            padding: '0',
            border: '0',
            background: 'transparent',
            boxShadow: 'none',
            pointerEvents: 'auto'
        });

        const shadow =
            ui.attachShadow({
                mode: 'open'
            });

        const style =
            document.createElement('style');

        style.textContent = `

            * {
                box-sizing: border-box;
                -webkit-tap-highlight-color: transparent;
            }

            .container {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                margin: 0;
                padding: 0;
            }

            .main {
                width: 13px;
                height: 32px;

                margin: 0;
                padding: 0;

                border: 0;
                border-left: 1px solid rgba(255,255,255,.30);

                border-radius: 4px 0 0 4px;

                background: rgba(0,0,0,.28);

                color: rgba(255,255,255,.82);

                font-family: Arial, sans-serif;
                font-size: 8px;
                font-weight: 700;

                display: flex;
                align-items: center;
                justify-content: center;

                writing-mode: vertical-rl;

                outline: none;
                appearance: none;
                -webkit-appearance: none;

                box-shadow: none;

                cursor: pointer;
            }

            .main:active {
                background: rgba(0,0,0,.45);
            }

            .panel {
                display: none;

                flex-direction: column;

                width: 38px;

                margin: 0;
                padding: 2px;

                border: 1px solid rgba(255,255,255,.18);

                border-radius: 4px;

                background: rgba(0,0,0,.78);

                box-shadow: none;
            }

            .panel.open {
                display: flex;
            }

            .zoom-option {
                width: 100%;
                height: 23px;

                margin: 0;
                padding: 0;

                border: 0;
                border-radius: 3px;

                background: transparent;

                color: rgba(255,255,255,.82);

                font-family: Arial, sans-serif;
                font-size: 8px;
                font-weight: 600;

                outline: none;
                appearance: none;
                -webkit-appearance: none;
            }

            .zoom-option.active {
                background: rgba(255,255,255,.18);
                color: #fff;
            }

            .zoom-option:active {
                background: rgba(255,255,255,.28);
            }
        `;

        const container =
            document.createElement('div');

        container.className =
            'container';

        const panel =
            document.createElement('div');

        panel.className =
            'panel';

        panel.id =
            'zoom-panel';

        PRESETS.forEach(zoom => {

            const button =
                document.createElement('button');

            button.className =
                'zoom-option';

            button.dataset.zoom =
                String(zoom);

            button.textContent =
                zoom + '%';

            button.addEventListener(
                'click',
                event => {

                    event.stopPropagation();

                    saveZoom(zoom);

                    panel.classList.remove(
                        'open'
                    );
                }
            );

            panel.appendChild(button);
        });

        const main =
            document.createElement('button');

        main.className =
            'main';

        main.textContent =
            'Z';

        main.addEventListener(
            'click',
            event => {

                event.stopPropagation();

                panel.classList.toggle(
                    'open'
                );
            }
        );

        container.appendChild(panel);
        container.appendChild(main);

        shadow.appendChild(style);
        shadow.appendChild(container);

        document.documentElement.appendChild(ui);

        updateUI();
    }

    function ensureUI() {

        if (!document.documentElement) {
            return;
        }

        if (!getUI()) {
            createUI();
        } else {
            updateUI();
        }
    }

    // =========================================================
    // PROTECT VIEWPORT
    // =========================================================

    function protectViewport() {

        if (!document.head) return;

        const observer =
            new MutationObserver(() => {

                const meta =
                    document.querySelector(
                        'meta[name="viewport"]'
                    );

                if (!meta) {
                    applyViewport();
                    return;
                }

                const expected =
                    getViewportContent(
                        savedZoom
                    );

                if (
                    meta.getAttribute(
                        'content'
                    ) !== expected
                ) {

                    meta.setAttribute(
                        'content',
                        expected
                    );
                }
            });

        observer.observe(
            document.head,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'content'
                ]
            }
        );
    }

    // =========================================================
    // NAVIGATION
    // =========================================================

    function setupNavigationWatcher() {

        const originalPushState =
            history.pushState;

        const originalReplaceState =
            history.replaceState;

        function afterNavigation() {

            setTimeout(() => {

                savedZoom =
                    loadZoom();

                applyViewport();
                ensureUI();

            }, 50);
        }

        history.pushState =
            function () {

                const result =
                    originalPushState.apply(
                        this,
                        arguments
                    );

                afterNavigation();

                return result;
            };

        history.replaceState =
            function () {

                const result =
                    originalReplaceState.apply(
                        this,
                        arguments
                    );

                afterNavigation();

                return result;
            };

        window.addEventListener(
            'popstate',
            afterNavigation
        );

        window.addEventListener(
            'pageshow',
            () => {

                savedZoom =
                    loadZoom();

                applyViewport();
                ensureUI();
            }
        );
    }

    // =========================================================
    // START
    // =========================================================

    function start() {

        applyInitialViewport();

        if (document.documentElement) {
            createUI();
        }

        if (document.head) {
            protectViewport();
        }

        setupNavigationWatcher();

        if (!document.documentElement) {

            const observer =
                new MutationObserver(() => {

                    if (
                        document.documentElement
                    ) {

                        applyInitialViewport();
                        createUI();

                        observer.disconnect();
                    }
                });

            observer.observe(
                document,
                {
                    childList: true,
                    subtree: true
                }
            );
        }

        window.addEventListener(
            'load',
            () => {

                savedZoom =
                    loadZoom();

                applyViewport();
                ensureUI();

            },
            { once: true }
        );
    }

    start();

})();
