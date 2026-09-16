// ==UserScript==
// @name         Mobile Web ZoomOut
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Atur zoom per situs dengan floating UI yang tahan terhadap Google/YouTube SPA
// @author       Qwen & Assistant
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    const siteKey = 'zoom_' + window.location.hostname;
    let savedZoom = parseInt(GM_getValue(siteKey, 100), 10);

    if (!Number.isFinite(savedZoom)) {
        savedZoom = 100;
    }

    const PRESETS = [100, 90, 80, 70, 60, 50];

    let uiHost = null;
    let shadowRoot = null;
    let panel = null;
    let handle = null;

    // =========================================================
    // VIEWPORT
    // =========================================================

    function getTargetWidth(zoomPercent) {
        const scale = zoomPercent / 100;
        const screenWidth = window.screen.width || 360;
        return Math.round(screenWidth / scale);
    }

    function setViewportMeta(zoomPercent) {
        if (!document.head) return false;

        let meta = document.querySelector('meta[name="viewport"]');

        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }

        if (zoomPercent === 100) {
            meta.setAttribute(
                'content',
                'width=device-width, initial-scale=1.0'
            );
        } else {
            const scale = zoomPercent / 100;
            const targetWidth = getTargetWidth(zoomPercent);

            meta.setAttribute(
                'content',
                `width=${targetWidth}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=3.0, user-scalable=yes`
            );
        }

        return true;
    }

    function applyViewport(zoomPercent) {
        if (!setViewportMeta(zoomPercent)) {
            waitForHead(() => applyViewport(zoomPercent));
            return;
        }

        updateUIScale();

        try {
            window.dispatchEvent(new Event('resize'));
        } catch (_) {}
    }

    function waitForHead(callback) {
        if (document.head) {
            callback();
            return;
        }

        const observer = new MutationObserver(() => {
            if (document.head) {
                observer.disconnect();
                callback();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();

            if (document.head) {
                callback();
            }
        }, 5000);
    }

    // =========================================================
    // FLOATING UI
    // =========================================================

    function createUI() {
        if (!document.documentElement) return;

        // Sudah ada
        if (uiHost && document.documentElement.contains(uiHost)) {
            return;
        }

        // Bersihkan sisa lama
        const old = document.getElementById('zoom-ui-host');
        if (old) old.remove();

        uiHost = document.createElement('div');
        uiHost.id = 'zoom-ui-host';

        // Paksa host tetap fixed dan tidak terpengaruh CSS situs
        uiHost.setAttribute(
            'style',
            [
                'all: initial !important',
                'position: fixed !important',
                'right: 0 !important',
                'top: 50% !important',
                'width: auto !important',
                'height: auto !important',
                'margin: 0 !important',
                'padding: 0 !important',
                'border: 0 !important',
                'outline: 0 !important',
                'background: transparent !important',
                'z-index: 2147483647 !important',
                'display: block !important',
                'visibility: visible !important',
                'opacity: 1 !important',
                'pointer-events: none !important',
                'transform: translateY(-50%) !important',
                'font-size: 16px !important',
                'line-height: normal !important'
            ].join(';')
        );

        shadowRoot = uiHost.attachShadow({ mode: 'open' });

        const style = document.createElement('style');

        style.textContent = `
            :host,
            * {
                box-sizing: border-box;
                -webkit-tap-highlight-color: transparent;
            }

            .wrapper {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                font-family: Arial, Helvetica, sans-serif;
                pointer-events: none;
                transform-origin: right center;
            }

            .handle {
                width: 18px;
                height: 34px;
                background: rgba(30, 30, 30, 0.92);
                border-radius: 7px 0 0 7px;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                border: 1px solid rgba(255,255,255,0.25);
                border-right: none;
                box-shadow: -2px 0 7px rgba(0,0,0,0.3);
                pointer-events: auto;
                opacity: 0.18;
                transition: opacity .18s ease;
                touch-action: manipulation;
            }

            .handle:active,
            .handle.open {
                opacity: 1;
            }

            .panel {
                display: none;
                width: 132px;
                padding: 10px;
                background: rgba(255,255,255,0.98);
                border: 1px solid rgba(0,0,0,0.15);
                border-right: none;
                border-radius: 10px 0 0 10px;
                box-shadow: -4px 0 14px rgba(0,0,0,0.18);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                pointer-events: auto;
            }

            .panel.open {
                display: block;
            }

            .title {
                font-size: 11px;
                font-weight: 700;
                color: #555;
                text-align: center;
                margin-bottom: 7px;
                text-transform: uppercase;
                letter-spacing: .5px;
            }

            .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
            }

            button {
                appearance: none;
                -webkit-appearance: none;
                width: 100%;
                min-height: 30px;
                margin: 0;
                padding: 5px 0;
                border-radius: 5px;
                border: 1px solid #ddd;
                background: #f0f0f0;
                color: #333;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                text-align: center;
                cursor: pointer;
                touch-action: manipulation;
            }

            button:active {
                transform: scale(.96);
            }

            button.active {
                background: #007aff;
                border-color: #007aff;
                color: #fff;
            }
        `;

        shadowRoot.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.className = 'wrapper';

        panel = document.createElement('div');
        panel.className = 'panel';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = 'Pilih Zoom';

        const grid = document.createElement('div');
        grid.className = 'grid';

        PRESETS.forEach(value => {
            const button = document.createElement('button');

            button.textContent = `${value}%`;
            button.dataset.zoom = String(value);

            if (value === savedZoom) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => {
                const newZoom = parseInt(button.dataset.zoom, 10);

                if (!Number.isFinite(newZoom)) return;

                savedZoom = newZoom;

                GM_setValue(siteKey, newZoom);

                panel.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle(
                        'active',
                        parseInt(btn.dataset.zoom, 10) === newZoom
                    );
                });

                applyViewport(newZoom);
            });

            grid.appendChild(button);
        });

        panel.appendChild(title);
        panel.appendChild(grid);

        handle = document.createElement('div');
        handle.className = 'handle';
        handle.textContent = 'Z';

        handle.addEventListener('click', event => {
            event.stopPropagation();

            const open = panel.classList.toggle('open');
            handle.classList.toggle('open', open);
        });

        wrapper.appendChild(panel);
        wrapper.appendChild(handle);

        shadowRoot.appendChild(wrapper);
        document.documentElement.appendChild(uiHost);

        updateUIScale();
    }

    function updateUIScale() {
        if (!shadowRoot || !shadowRoot.querySelector('.wrapper')) {
            return;
        }

        const wrapper = shadowRoot.querySelector('.wrapper');

        // UI tetap berukuran normal walaupun viewport memakai scale
        const scale = savedZoom / 100;
        const inverseScale = 1 / scale;

        wrapper.style.transform =
            `scale(${inverseScale})`;

        wrapper.style.transformOrigin =
            'right center';
    }

    // =========================================================
    // KEEP UI ALIVE
    // =========================================================

    function ensureUI() {
        if (
            !uiHost ||
            !document.documentElement.contains(uiHost)
        ) {
            createUI();
        }
    }

    const domObserver = new MutationObserver(() => {
        ensureUI();
    });

    function startObserver() {
        if (!document.documentElement) return;

        domObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // =========================================================
    // GOOGLE / YOUTUBE SPA SUPPORT
    // =========================================================

    function patchHistory() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            const result = originalPushState.apply(this, arguments);

            setTimeout(() => {
                ensureUI();
                applyViewport(savedZoom);
            }, 100);

            return result;
        };

        history.replaceState = function () {
            const result = originalReplaceState.apply(this, arguments);

            setTimeout(() => {
                ensureUI();
                applyViewport(savedZoom);
            }, 100);

            return result;
        };

        window.addEventListener('popstate', () => {
            setTimeout(() => {
                ensureUI();
                applyViewport(savedZoom);
            }, 100);
        });
    }

    // =========================================================
    // START
    // =========================================================

    function start() {
        waitForHead(() => {
            applyViewport(savedZoom);
        });

        createUI();
        startObserver();
        patchHistory();

        // Fallback tambahan untuk halaman yang agresif mengubah DOM
        setInterval(() => {
            ensureUI();
            updateUIScale();
        }, 1500);
    }

    if (document.documentElement) {
        start();
    } else {
        const bootObserver = new MutationObserver(() => {
            if (document.documentElement) {
                bootObserver.disconnect();
                start();
            }
        });

        bootObserver.observe(document, {
            childList: true,
            subtree: true
        });
    }

})();
