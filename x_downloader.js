// ==UserScript==
// @name         X Video Downloader - Firefox Android
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Download video X/Twitter - Optimized for Firefox/Iceraven Android
// @author       Assistant
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.x.com/*
// @match        https://mobile.twitter.com/*
// @icon         https://abs.twimg.com/favicons/twitter.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.vxtwitter.com
// @connect      video.twimg.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        /* FAB Button */
        .xvd-fab {
            position: fixed;
            bottom: 80px;
            right: 15px;
            z-index: 2147483647;
            background: #1d9bf0;
            color: white;
            border: none;
            border-radius: 50%;
            width: 58px;
            height: 58px;
            font-size: 26px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }

        .xvd-fab:active {
            transform: scale(0.93);
        }

        /* Video Overlay Button */
        .xvd-vbtn {
            position: absolute;
            bottom: 50px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.75);
            color: white;
            border: 2px solid rgba(255,255,255,0.8);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }

        .xvd-vbtn:active {
            background: #1d9bf0;
        }

        /* Modal Backdrop */
        .xvd-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 2147483646;
            display: none;
            overflow-y: auto;
            padding: 10px;
            box-sizing: border-box;
        }

        .xvd-backdrop.show {
            display: block;
        }

        /* Modal Box */
        .xvd-box {
            background: #16181c;
            border-radius: 16px;
            max-width: 450px;
            margin: 20px auto;
            overflow: hidden;
        }

        /* Header */
        .xvd-head {
            background: #1d1f23;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #2f3336;
        }

        .xvd-head-title {
            color: #e7e9ea;
            font-size: 17px;
            font-weight: bold;
        }

        .xvd-head-close {
            background: #2f3336;
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 16px;
            cursor: pointer;
        }

        /* Body */
        .xvd-body {
            padding: 16px;
        }

        /* Spinner */
        .xvd-spin {
            width: 32px;
            height: 32px;
            border: 3px solid #2f3336;
            border-top-color: #1d9bf0;
            border-radius: 50%;
            animation: xvd-rotate 0.7s linear infinite;
            margin: 30px auto;
        }

        @keyframes xvd-rotate {
            to { transform: rotate(360deg); }
        }

        .xvd-loading-text {
            text-align: center;
            color: #71767b;
            margin-top: 10px;
        }

        /* Video Container */
        .xvd-vid-container {
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 16px;
        }

        .xvd-vid {
            width: 100%;
            max-height: 280px;
            display: block;
        }

        /* Instruction Banner - PENTING! */
        .xvd-instruction {
            background: linear-gradient(135deg, #1d9bf0 0%, #0d8ed9 100%);
            color: white;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 16px;
            text-align: center;
        }

        .xvd-instruction-icon {
            font-size: 36px;
            margin-bottom: 8px;
        }

        .xvd-instruction-main {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 6px;
        }

        .xvd-instruction-sub {
            font-size: 14px;
            opacity: 0.9;
        }

        /* Download Link - INI YANG PALING PENTING */
        .xvd-download-link {
            display: block;
            background: #00ba7c;
            color: white !important;
            text-decoration: none !important;
            padding: 18px 20px;
            border-radius: 12px;
            text-align: center;
            font-size: 17px;
            font-weight: bold;
            margin-bottom: 12px;
            -webkit-tap-highlight-color: transparent;
        }

        .xvd-download-link:active {
            background: #00a06a;
        }

        /* Secondary Buttons */
        .xvd-btn-row {
            display: flex;
            gap: 10px;
        }

        .xvd-btn-sec {
            flex: 1;
            background: #2f3336;
            color: #e7e9ea;
            border: none;
            padding: 14px 10px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
        }

        .xvd-btn-sec:active {
            background: #3f4448;
        }

        /* Steps */
        .xvd-steps {
            background: #1d1f23;
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
        }

        .xvd-steps-title {
            color: #1d9bf0;
            font-weight: bold;
            font-size: 15px;
            margin-bottom: 12px;
        }

        .xvd-step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 10px;
            color: #e7e9ea;
            font-size: 14px;
            line-height: 1.5;
        }

        .xvd-step:last-child {
            margin-bottom: 0;
        }

        .xvd-step-num {
            background: #1d9bf0;
            color: white;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
            flex-shrink: 0;
        }

        /* URL Box */
        .xvd-url-box {
            background: #000;
            border: 1px solid #2f3336;
            border-radius: 8px;
            padding: 12px;
            margin-top: 16px;
        }

        .xvd-url-label {
            color: #71767b;
            font-size: 12px;
            margin-bottom: 6px;
        }

        .xvd-url-text {
            color: #1d9bf0;
            font-size: 11px;
            word-break: break-all;
            font-family: monospace;
            user-select: all;
            -webkit-user-select: all;
        }

        /* Error */
        .xvd-error {
            text-align: center;
            padding: 30px 15px;
        }

        .xvd-error-icon {
            font-size: 45px;
            margin-bottom: 12px;
        }

        .xvd-error-msg {
            color: #e7e9ea;
            font-size: 16px;
            margin-bottom: 5px;
        }

        .xvd-error-detail {
            color: #71767b;
            font-size: 14px;
        }

        /* Toast */
        .xvd-toast {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #22c55e;
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }

        .xvd-toast.show {
            opacity: 1;
        }

        .xvd-toast.err {
            background: #ef4444;
        }
    `);

    // ========== TOAST ==========
    function toast(msg, isError = false) {
        let t = document.querySelector('.xvd-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'xvd-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.toggle('err', isError);
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ========== COPY ==========
    function copyText(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand('copy');
            toast('✓ URL disalin ke clipboard!');
        } catch (e) {
            toast('Gagal menyalin', true);
        }
        document.body.removeChild(ta);
    }

    // ========== EXTRACT TWEET ID ==========
    function getTweetId(url) {
        const m = url.match(/status\/(\d+)/);
        return m ? m[1] : null;
    }

    // ========== FETCH VIDEO ==========
    function fetchVideo(tweetUrl) {
        return new Promise((resolve, reject) => {
            const id = getTweetId(tweetUrl);
            if (!id) return reject('URL tidak valid');

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.vxtwitter.com/Twitter/status/${id}`,
                timeout: 20000,
                onload: (r) => {
                    try {
                        const d = JSON.parse(r.responseText);
                        if (d.media_extended) {
                            const vids = d.media_extended
                                .filter(m => m.type === 'video' || m.type === 'gif')
                                .map(v => ({
                                    url: v.url,
                                    thumb: v.thumbnail_url || '',
                                    type: v.type
                                }));
                            if (vids.length) {
                                return resolve({
                                    videos: vids,
                                    user: d.user_name || 'user',
                                    id: id
                                });
                            }
                        }
                        reject('Tweet ini tidak mengandung video');
                    } catch (e) {
                        reject('Gagal memproses data');
                    }
                },
                onerror: () => reject('Koneksi gagal'),
                ontimeout: () => reject('Request timeout')
            });
        });
    }

    // ========== MODAL ==========
    let backdrop = null;

    function getModal() {
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.className = 'xvd-backdrop';
        backdrop.innerHTML = `
            <div class="xvd-box">
                <div class="xvd-head">
                    <span class="xvd-head-title">📥 Download Video</span>
                    <button class="xvd-head-close">✕</button>
                </div>
                <div class="xvd-body"></div>
            </div>
        `;

        backdrop.querySelector('.xvd-head-close').onclick = closeModal;
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        document.body.appendChild(backdrop);
        return backdrop;
    }

    function openModal() {
        getModal().classList.add('show');
    }

    function closeModal() {
        if (backdrop) backdrop.classList.remove('show');
    }

    function setBody(html) {
        const body = getModal().querySelector('.xvd-body');
        if (body) body.innerHTML = html;
    }

    function showLoading() {
        setBody(`
            <div class="xvd-spin"></div>
            <div class="xvd-loading-text">Mengambil video...</div>
        `);
    }

    function showError(msg) {
        setBody(`
            <div class="xvd-error">
                <div class="xvd-error-icon">😕</div>
                <div class="xvd-error-msg">Gagal</div>
                <div class="xvd-error-detail">${msg}</div>
            </div>
        `);
    }

    function showResult(data) {
        const v = data.videos[0];
        const filename = `${data.user}_${data.id}.mp4`;

        setBody(`
            <div class="xvd-instruction">
                <div class="xvd-instruction-icon">👇</div>
                <div class="xvd-instruction-main">TEKAN TAHAN TOMBOL HIJAU</div>
                <div class="xvd-instruction-sub">Lalu pilih "Download link" atau "Simpan tautan"</div>
            </div>

            <a href="${v.url}" 
               class="xvd-download-link" 
               download="${filename}"
               type="video/mp4">
                📥 TEKAN TAHAN DI SINI UNTUK DOWNLOAD
            </a>

            <div class="xvd-vid-container">
                <video class="xvd-vid" 
                       src="${v.url}" 
                       controls 
                       playsinline
                       poster="${v.thumb}"
                       preload="metadata">
                </video>
            </div>

            <div class="xvd-btn-row">
                <button class="xvd-btn-sec" id="xvd-copy-btn">📋 Salin URL</button>
                <button class="xvd-btn-sec" id="xvd-newtab-btn">🔗 Tab Baru</button>
            </div>

            <div class="xvd-steps">
                <div class="xvd-steps-title">📱 Cara Download di Firefox/Iceraven:</div>
                <div class="xvd-step">
                    <span class="xvd-step-num">1</span>
                    <span><strong>Tekan tahan</strong> tombol hijau di atas</span>
                </div>
                <div class="xvd-step">
                    <span class="xvd-step-num">2</span>
                    <span>Pilih <strong>"Download link"</strong> atau <strong>"Simpan tautan"</strong></span>
                </div>
                <div class="xvd-step">
                    <span class="xvd-step-num">3</span>
                    <span>Video tersimpan di folder <strong>Download</strong></span>
                </div>
            </div>

            <div class="xvd-url-box">
                <div class="xvd-url-label">URL Video (tap untuk select all):</div>
                <div class="xvd-url-text">${v.url}</div>
            </div>
        `);

        // Event handlers
        document.getElementById('xvd-copy-btn').onclick = () => copyText(v.url);
        document.getElementById('xvd-newtab-btn').onclick = () => {
            // Untuk Firefox Android, buat anchor dan trigger click
            const a = document.createElement('a');
            a.href = v.url;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    }

    // ========== MAIN ==========
    async function processUrl(url) {
        openModal();
        showLoading();

        try {
            const data = await fetchVideo(url);
            showResult(data);
        } catch (e) {
            showError(e);
        }
    }

    function findTweetUrl() {
        // Dari URL saat ini
        if (getTweetId(location.href)) return location.href;

        // Dari artikel yang terlihat
        const articles = document.querySelectorAll('article');
        for (const art of articles) {
            const rect = art.getBoundingClientRect();
            if (rect.top >= -50 && rect.top < window.innerHeight * 0.6) {
                const link = art.querySelector('a[href*="/status/"]');
                if (link) return link.href;
            }
        }

        // Fallback
        const any = document.querySelector('a[href*="/status/"]');
        return any ? any.href : null;
    }

    // ========== FAB ==========
    function createFab() {
        if (document.querySelector('.xvd-fab')) return;

        const fab = document.createElement('button');
        fab.className = 'xvd-fab';
        fab.textContent = '📥';
        fab.onclick = () => {
            const url = findTweetUrl();
            if (url) {
                processUrl(url);
            } else {
                toast('Buka tweet dengan video dulu', true);
            }
        };
        document.body.appendChild(fab);
    }

    // ========== VIDEO BUTTONS ==========
    function addVideoButtons() {
        document.querySelectorAll('video').forEach(vid => {
            const parent = vid.closest('[data-testid="videoComponent"]')
                         || vid.closest('[data-testid="videoPlayer"]')
                         || vid.parentElement;

            if (!parent || parent.dataset.xvdDone) return;
            parent.dataset.xvdDone = '1';
            parent.style.position = 'relative';

            const btn = document.createElement('button');
            btn.className = 'xvd-vbtn';
            btn.textContent = '📥';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                let url = location.href;
                const article = parent.closest('article');
                if (article) {
                    const link = article.querySelector('a[href*="/status/"]');
                    if (link) url = link.href;
                }

                if (getTweetId(url)) {
                    processUrl(url);
                } else {
                    toast('Tweet tidak ditemukan', true);
                }
            };
            parent.appendChild(btn);
        });
    }

    // ========== OBSERVER ==========
    const obs = new MutationObserver(addVideoButtons);

    // ========== INIT ==========
    function init() {
        console.log('📥 X Video Downloader v5 - Firefox Android Edition');
        createFab();
        addVideoButtons();
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 800);
    }

})();
