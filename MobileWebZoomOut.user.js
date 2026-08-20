// ==UserScript==
// @name         Mobile Desktop Zoom Control (Low Opacity Handle)
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Atur zoom per situs dengan tombol handle Z transparan (25%).
// @author       Qwen & Assistant
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    const siteKey = 'zoom_' + window.location.hostname;
    let savedZoom = parseInt(GM_getValue(siteKey, 100), 10);
    
    applyViewport(savedZoom);
    observeViewport();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }

    function applyViewport(zoomPercent) {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }

        if (zoomPercent === 100) {
            meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
        } else {
            const scale = zoomPercent / 100;
            const screenWidth = window.screen.width || 360;
            const targetWidth = Math.round(screenWidth / scale);
            meta.setAttribute('content', `width=${targetWidth}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=3.0, user-scalable=yes`);
        }
        
        updateUIScale(zoomPercent);
        window.dispatchEvent(new Event('resize'));
    }

    function updateUIScale(zoomPercent) {
        const wrapper = document.getElementById('zoom-ui-wrapper');
        if (!wrapper) return;

        const scale = zoomPercent / 100;
        const inverseScale = 1 / scale;
        
        wrapper.style.transformOrigin = 'right center';
        wrapper.style.transform = `translateY(-50%) scale(${inverseScale})`;
    }

    function observeViewport() {
        const observer = new MutationObserver(() => {
            if (savedZoom !== 100) {
                const scale = savedZoom / 100;
                const targetWidth = Math.round((window.screen.width || 360) / scale);
                const meta = document.querySelector('meta[name="viewport"]');
                if (meta && !meta.getAttribute('content').includes(`width=${targetWidth}`)) {
                    meta.setAttribute('content', `width=${targetWidth}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=3.0, user-scalable=yes`);
                }
            }
            updateUIScale(savedZoom);
        });
        observer.observe(document.head || document.documentElement, { childList: true, subtree: true, attributes: true });
    }

    function injectUI() {
        if (document.getElementById('zoom-ui-wrapper')) return;

        const style = document.createElement('style');
        style.textContent = `
            #zoom-ui-wrapper {
                position: fixed;
                right: 0;
                top: 50%;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                pointer-events: none;
            }
            #zoom-handle {
                width: 28px;
                height: 38px;
                background: rgba(30, 30, 30, 0.9);
                border-radius: 6px 0 0 6px;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.2);
                border-right: none;
                pointer-events: auto;
                box-shadow: -2px 0 6px rgba(0,0,0,0.3);
                /* OPASITAS 25% */
                opacity: 0.25;
                transition: opacity 0.2s ease;
            }
            #zoom-handle:active {
                opacity: 1.0;
            }
            #zoom-panel {
                display: none;
                background: rgba(255, 255, 255, 0.98);
                padding: 10px;
                border-radius: 10px 0 0 10px;
                border: 1px solid rgba(0, 0, 0, 0.15);
                pointer-events: auto;
                width: 130px;
                backdrop-filter: blur(10px);
                box-shadow: -4px 0 12px rgba(0,0,0,0.15);
            }
            #zoom-panel.open { display: block; }
            .zoom-title {
                font-size: 11px;
                font-weight: bold;
                color: #555;
                text-align: center;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .zoom-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
            }
            .zoom-btn {
                background: #f0f0f0;
                border: 1px solid #ddd;
                color: #333;
                padding: 6px 0;
                border-radius: 5px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                text-align: center;
                transition: background 0.15s, color 0.15s;
            }
            .zoom-btn:active {
                transform: scale(0.96);
            }
            .zoom-btn.active {
                background: #007aff;
                border-color: #007aff;
                color: #fff;
            }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.id = 'zoom-ui-wrapper';

        const panel = document.createElement('div');
        panel.id = 'zoom-panel';
        
        const presets = [100, 90, 80, 70, 60, 50];
        let buttonsHTML = '';
        presets.forEach(p => {
            const activeClass = p === savedZoom ? 'active' : '';
            buttonsHTML += `<button class="zoom-btn ${activeClass}" data-zoom="${p}">${p}%</button>`;
        });

        panel.innerHTML = `
            <div class="zoom-title">Pilih Zoom</div>
            <div class="zoom-grid">${buttonsHTML}</div>
        `;

        const handle = document.createElement('div');
        handle.id = 'zoom-handle';
        handle.innerText = 'Z';

        handle.addEventListener('click', () => {
            panel.classList.toggle('open');
        });

        panel.addEventListener('click', (e) => {
            if (e.target.classList.contains('zoom-btn')) {
                const val = parseInt(e.target.getAttribute('data-zoom'), 10);
                
                panel.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                savedZoom = val;
                applyViewport(val);
                GM_setValue(siteKey, val);
            }
        });

        wrapper.appendChild(panel);
        wrapper.appendChild(handle);
        document.documentElement.appendChild(wrapper);

        updateUIScale(savedZoom);
    }
})();
                        
