// ==UserScript==
// @name         X/Twitter Video Downloader Mobile
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Download videos from X.com with mobile-friendly interface
// @author       Assistant
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.x.com/*
// @match        https://mobile.twitter.com/*
// @icon         https://abs.twimg.com/favicons/twitter.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @connect      twitter.com
// @connect      x.com
// @connect      twimg.com
// @connect      video.twimg.com
// @connect      api.twitter.com
// @connect      api.x.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== STYLES ====================
    GM_addStyle(`
        /* Tombol Download pada Video */
        .xvd-download-btn {
            position: absolute;
            bottom: 60px;
            right: 10px;
            z-index: 9999;
            background: linear-gradient(135deg, #1d9bf0 0%, #0d8bd9 100%);
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 22px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(29, 155, 240, 0.4);
            transition: all 0.3s ease;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }

        .xvd-download-btn:hover,
        .xvd-download-btn:active {
            transform: scale(1.1);
            background: linear-gradient(135deg, #0d8bd9 0%, #0a7bc4 100%);
            box-shadow: 0 6px 20px rgba(29, 155, 240, 0.6);
        }

        .xvd-download-btn.loading {
            pointer-events: none;
            opacity: 0.7;
        }

        .xvd-download-btn.loading::after {
            content: '';
            position: absolute;
            width: 30px;
            height: 30px;
            border: 3px solid transparent;
            border-top-color: white;
            border-radius: 50%;
            animation: xvd-spin 1s linear infinite;
        }

        @keyframes xvd-spin {
            to { transform: rotate(360deg); }
        }

        /* Floating Action Button */
        .xvd-fab {
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 99999;
            background: linear-gradient(135deg, #1d9bf0 0%, #0d8bd9 100%);
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 26px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            touch-action: manipulation;
        }

        .xvd-fab:hover,
        .xvd-fab:active {
            transform: scale(1.1) rotate(10deg);
        }

        /* Modal Panel */
        .xvd-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 999999;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }

        .xvd-modal-overlay.show {
            opacity: 1;
            visibility: visible;
        }

        .xvd-modal {
            background: #15202b;
            border-radius: 20px 20px 0 0;
            width: 100%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            transform: translateY(100%);
            transition: transform 0.3s ease;
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }

        .xvd-modal-overlay.show .xvd-modal {
            transform: translateY(0);
        }

        .xvd-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px;
            border-bottom: 1px solid #38444d;
            position: sticky;
            top: 0;
            background: #15202b;
        }

        .xvd-modal-title {
            color: white;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .xvd-modal-close {
            background: #38444d;
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .xvd-modal-body {
            padding: 20px;
        }

        /* Video Item dalam Modal */
        .xvd-video-item {
            background: #192734;
            border-radius: 15px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid #38444d;
        }

        .xvd-video-preview {
            width: 100%;
            border-radius: 10px;
            margin-bottom: 15px;
            max-height: 200px;
            object-fit: cover;
        }

        .xvd-quality-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .xvd-quality-btn {
            flex: 1;
            min-width: 80px;
            padding: 15px 10px;
            background: #1d9bf0;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }

        .xvd-quality-btn:hover,
        .xvd-quality-btn:active {
            background: #0d8bd9;
            transform: scale(0.98);
        }

        .xvd-quality-btn .quality-label {
            font-size: 16px;
        }

        .xvd-quality-btn .quality-size {
            font-size: 11px;
            opacity: 0.8;
        }

        /* Status Messages */
        .xvd-status {
            padding: 15px;
            border-radius: 10px;
            margin-top: 15px;
            text-align: center;
            font-size: 14px;
        }

        .xvd-status.success {
            background: rgba(0, 186, 124, 0.2);
            color: #00ba7c;
        }

        .xvd-status.error {
            background: rgba(244, 33, 46, 0.2);
            color: #f4212e;
        }

        .xvd-status.loading {
            background: rgba(29, 155, 240, 0.2);
            color: #1d9bf0;
        }

        /* No Video Message */
        .xvd-no-video {
            text-align: center;
            padding: 40px 20px;
            color: #8899a6;
        }

        .xvd-no-video-icon {
            font-size: 50px;
            margin-bottom: 15px;
        }

        /* Drag Handle */
        .xvd-drag-handle {
            width: 40px;
            height: 5px;
            background: #38444d;
            border-radius: 3px;
            margin: 10px auto;
        }

        /* Tombol di Tweet */
        .xvd-tweet-btn {
            background: transparent;
            border: none;
            color: #8899a6;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            min-width: 44px;
            min-height: 44px;
        }

        .xvd-tweet-btn:hover {
            background: rgba(29, 155, 240, 0.1);
            color: #1d9bf0;
        }

        .xvd-tweet-btn svg {
            width: 20px;
            height: 20px;
        }

        /* Toast Notification */
        .xvd-toast {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #1d9bf0;
            color: white;
            padding: 15px 25px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 9999999;
            opacity: 0;
            transition: all 0.3s ease;
            white-space: nowrap;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }

        .xvd-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .xvd-toast.error {
            background: #f4212e;
        }

        .xvd-toast.success {
            background: #00ba7c;
        }

        /* Progress Bar */
        .xvd-progress-container {
            width: 100%;
            height: 6px;
            background: #38444d;
            border-radius: 3px;
            margin-top: 10px;
            overflow: hidden;
        }

        .xvd-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #1d9bf0, #00ba7c);
            border-radius: 3px;
            transition: width 0.3s ease;
            width: 0%;
        }

        /* Responsive */
        @media (min-width: 500px) {
            .xvd-modal {
                border-radius: 20px;
                margin: 20px;
                margin-bottom: 40px;
            }

            .xvd-fab {
                bottom: 30px;
                right: 30px;
            }
        }
    `);

    // ==================== HELPER FUNCTIONS ====================
    const SVG_ICONS = {
        download: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-5H7l5-7 5 7h-4v5h-2z" transform="rotate(180 12 12)"/></svg>`,
        close: '✕',
        video: '🎬',
        noVideo: '📭',
        loading: '⏳'
    };

    function showToast(message, type = 'info') {
        const existingToast = document.querySelector('.xvd-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `xvd-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function getTweetId(element) {
        // Cari dari URL di tweet
        const link = element.querySelector('a[href*="/status/"]');
        if (link) {
            const match = link.href.match(/\/status\/(\d+)/);
            if (match) return match[1];
        }
        
        // Cari dari URL halaman
        const urlMatch = window.location.href.match(/\/status\/(\d+)/);
        if (urlMatch) return urlMatch[0];
        
        return null;
    }

    function extractVideoFromTweet(tweetElement) {
        const videos = [];
        
        // Cari video element
        const videoElements = tweetElement.querySelectorAll('video');
        videoElements.forEach((video, index) => {
            const sources = [];
            
            // Cek src langsung
            if (video.src && !video.src.startsWith('blob:')) {
                sources.push({ url: video.src, quality: 'Default' });
            }
            
            // Cek source elements
            video.querySelectorAll('source').forEach(source => {
                if (source.src && !source.src.startsWith('blob:')) {
                    sources.push({ url: source.src, quality: 'Source' });
                }
            });
            
            // Cek poster untuk thumbnail
            const poster = video.poster || '';
            
            videos.push({
                element: video,
                poster: poster,
                sources: sources,
                index: index
            });
        });
        
        return videos;
    }

    async function getVideoInfo(tweetId) {
        return new Promise((resolve, reject) => {
            // Gunakan API tidak resmi untuk mendapatkan info video
            const apiUrl = `https://api.vxtwitter.com/Twitter/status/${tweetId}`;
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.media_extended) {
                            resolve(data.media_extended.filter(m => m.type === 'video'));
                        } else {
                            reject('No video found');
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject
            });
        });
    }

    async function getVideoFromPage(tweetUrl) {
        return new Promise((resolve, reject) => {
            // Coba berbagai API alternatif
            const apis = [
                `https://api.vxtwitter.com${new URL(tweetUrl).pathname}`,
                `https://twitsave.com/info?url=${encodeURIComponent(tweetUrl)}`
            ];
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: apis[0],
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.media_extended) {
                            const videos = data.media_extended
                                .filter(m => m.type === 'video' || m.type === 'gif')
                                .map(v => ({
                                    url: v.url,
                                    thumbnail: v.thumbnail_url,
                                    type: v.type
                                }));
                            resolve(videos);
                        } else {
                            reject('No video found');
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject
            });
        });
    }

    function downloadVideo(url, filename) {
        showToast('Memulai unduhan...', 'info');
        
        // Metode 1: GM_download
        if (typeof GM_download !== 'undefined') {
            GM_download({
                url: url,
                name: filename || `x_video_${Date.now()}.mp4`,
                onload: () => showToast('Unduhan selesai!', 'success'),
                onerror: (e) => {
                    console.error('GM_download error:', e);
                    // Fallback ke metode 2
                    downloadViaLink(url, filename);
                }
            });
        } else {
            downloadViaLink(url, filename);
        }
    }

    function downloadViaLink(url, filename) {
        // Untuk mobile, buka di tab baru
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.open(url, '_blank');
            showToast('Video dibuka di tab baru. Tekan tahan untuk menyimpan.', 'info');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `x_video_${Date.now()}.mp4`;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast('Unduhan dimulai!', 'success');
        }
    }

    // ==================== MODAL ====================
    function createModal() {
        const overlay = document.createElement('div');
        overlay.className = 'xvd-modal-overlay';
        overlay.innerHTML = `
            <div class="xvd-modal">
                <div class="xvd-drag-handle"></div>
                <div class="xvd-modal-header">
                    <span class="xvd-modal-title">
                        ${SVG_ICONS.video} Video Downloader
                    </span>
                    <button class="xvd-modal-close">${SVG_ICONS.close}</button>
                </div>
                <div class="xvd-modal-body">
                    <div class="xvd-loading">
                        <div class="xvd-status loading">🔍 Mencari video di halaman...</div>
                    </div>
                </div>
            </div>
        `;

        overlay.querySelector('.xvd-modal-close').onclick = () => hideModal();
        overlay.onclick = (e) => {
            if (e.target === overlay) hideModal();
        };

        document.body.appendChild(overlay);
        return overlay;
    }

    function showModal() {
        let modal = document.querySelector('.xvd-modal-overlay');
        if (!modal) modal = createModal();
        
        setTimeout(() => modal.classList.add('show'), 10);
        scanForVideos();
    }

    function hideModal() {
        const modal = document.querySelector('.xvd-modal-overlay');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async function scanForVideos() {
        const modalBody = document.querySelector('.xvd-modal-body');
        if (!modalBody) return;

        modalBody.innerHTML = '<div class="xvd-status loading">🔍 Mencari video...</div>';

        // Cari semua tweet dengan video di halaman
        const tweetLinks = [...document.querySelectorAll('a[href*="/status/"]')]
            .map(a => a.href)
            .filter(href => /\/status\/\d+/.test(href))
            .filter((v, i, a) => a.indexOf(v) === i);

        const currentUrl = window.location.href;
        if (/\/status\/\d+/.test(currentUrl) && !tweetLinks.includes(currentUrl)) {
            tweetLinks.unshift(currentUrl);
        }

        if (tweetLinks.length === 0) {
            modalBody.innerHTML = `
                <div class="xvd-no-video">
                    <div class="xvd-no-video-icon">${SVG_ICONS.noVideo}</div>
                    <div>Tidak ada tweet ditemukan di halaman ini</div>
                    <div style="margin-top:10px;font-size:12px;">Buka tweet yang berisi video terlebih dahulu</div>
                </div>
            `;
            return;
        }

        // Scan untuk video
        let videosFound = [];
        
        for (const tweetUrl of tweetLinks.slice(0, 10)) { // Batasi 10 tweet
            try {
                const videos = await getVideoFromPage(tweetUrl);
                if (videos && videos.length > 0) {
                    videosFound.push({
                        tweetUrl,
                        videos
                    });
                }
            } catch (e) {
                console.log('Error scanning:', tweetUrl, e);
            }
        }

        if (videosFound.length === 0) {
            modalBody.innerHTML = `
                <div class="xvd-no-video">
                    <div class="xvd-no-video-icon">${SVG_ICONS.noVideo}</div>
                    <div>Tidak ada video ditemukan</div>
                    <div style="margin-top:10px;font-size:12px;">Pastikan tweet memiliki video</div>
                </div>
            `;
            return;
        }

        // Tampilkan video yang ditemukan
        let html = '';
        videosFound.forEach((item, idx) => {
            item.videos.forEach((video, vidIdx) => {
                html += `
                    <div class="xvd-video-item">
                        ${video.thumbnail ? `<img class="xvd-video-preview" src="${video.thumbnail}" alt="Video preview">` : ''}
                        <div class="xvd-quality-buttons">
                            <button class="xvd-quality-btn" data-url="${video.url}" data-idx="${idx}-${vidIdx}">
                                <span class="quality-label">📥 Download</span>
                                <span class="quality-size">${video.type === 'gif' ? 'GIF' : 'MP4'}</span>
                            </button>
                            <button class="xvd-quality-btn" onclick="window.open('${video.url}', '_blank')" style="background:#38444d;">
                                <span class="quality-label">👁️ Preview</span>
                                <span class="quality-size">Buka di tab baru</span>
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        modalBody.innerHTML = html || '<div class="xvd-status error">Tidak ada video ditemukan</div>';

        // Add click handlers
        modalBody.querySelectorAll('.xvd-quality-btn[data-url]').forEach(btn => {
            btn.onclick = () => {
                const url = btn.dataset.url;
                downloadVideo(url, `x_video_${Date.now()}.mp4`);
            };
        });
    }

    // ==================== FAB BUTTON ====================
    function createFAB() {
        if (document.querySelector('.xvd-fab')) return;

        const fab = document.createElement('button');
        fab.className = 'xvd-fab';
        fab.innerHTML = SVG_ICONS.download;
        fab.title = 'Download Video';
        fab.onclick = showModal;

        document.body.appendChild(fab);
    }

    // ==================== TWEET BUTTONS ====================
    function addDownloadButtonToTweet(tweetElement) {
        if (tweetElement.querySelector('.xvd-tweet-btn')) return;
        if (!tweetElement.querySelector('video')) return;

        // Cari action bar
        const actionBar = tweetElement.querySelector('[role="group"]');
        if (!actionBar) return;

        const btn = document.createElement('button');
        btn.className = 'xvd-tweet-btn';
        btn.innerHTML = SVG_ICONS.download;
        btn.title = 'Download Video';
        
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            btn.classList.add('loading');
            
            // Cari tweet URL
            const link = tweetElement.querySelector('a[href*="/status/"]');
            if (link) {
                try {
                    const videos = await getVideoFromPage(link.href);
                    if (videos && videos.length > 0) {
                        downloadVideo(videos[0].url, `x_video_${Date.now()}.mp4`);
                    } else {
                        showToast('Video tidak ditemukan', 'error');
                    }
                } catch (e) {
                    showToast('Gagal mengambil video', 'error');
                }
            }
            
            btn.classList.remove('loading');
        };

        actionBar.appendChild(btn);
    }

    function addVideoOverlayButtons() {
        document.querySelectorAll('video').forEach(video => {
            const container = video.closest('div[data-testid="videoComponent"]') || video.parentElement;
            if (!container || container.querySelector('.xvd-download-btn')) return;

            container.style.position = 'relative';

            const btn = document.createElement('button');
            btn.className = 'xvd-download-btn';
            btn.innerHTML = '📥';
            btn.title = 'Download Video';
            
            btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                btn.classList.add('loading');
                btn.innerHTML = '';
                
                // Cari tweet parent
                const tweet = container.closest('article');
                if (tweet) {
                    const link = tweet.querySelector('a[href*="/status/"]');
                    if (link) {
                        try {
                            const videos = await getVideoFromPage(link.href);
                            if (videos && videos.length > 0) {
                                downloadVideo(videos[0].url, `x_video_${Date.now()}.mp4`);
                            } else {
                                showToast('Video tidak ditemukan', 'error');
                            }
                        } catch (e) {
                            showToast('Gagal mengambil video', 'error');
                        }
                    }
                }
                
                btn.classList.remove('loading');
                btn.innerHTML = '📥';
            };

            container.appendChild(btn);
        });
    }

    // ==================== OBSERVER ====================
    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Cek jika node adalah article (tweet)
                        if (node.matches && node.matches('article')) {
                            addDownloadButtonToTweet(node);
                        }
                        // Cek children
                        node.querySelectorAll && node.querySelectorAll('article').forEach(addDownloadButtonToTweet);
                    }
                });
            });
            
            // Update video overlay buttons
            addVideoOverlayButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== INIT ====================
    function init() {
        console.log('🎬 X/Twitter Video Downloader initialized');
        
        // Create FAB
        createFAB();
        
        // Add buttons to existing tweets
        document.querySelectorAll('article').forEach(addDownloadButtonToTweet);
        addVideoOverlayButtons();
        
        // Observe for new content
        observeDOM();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
