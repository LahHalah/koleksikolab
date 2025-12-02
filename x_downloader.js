// ==UserScript==
// @name         X/Twitter Video Downloader Mobile Fixed
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Download videos from X.com - Mobile Friendly & Working!
// @author       Assistant
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.x.com/*
// @match        https://mobile.twitter.com/*
// @icon         https://abs.twimg.com/favicons/twitter.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== DETECT MOBILE ====================
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
            width: 56px;
            height: 56px;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(29, 155, 240, 0.5);
            transition: all 0.3s ease;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }

        .xvd-download-btn:active {
            transform: scale(0.95);
        }

        /* Floating Action Button */
        .xvd-fab {
            position: fixed;
            bottom: 90px;
            right: 20px;
            z-index: 99999;
            background: linear-gradient(135deg, #1d9bf0 0%, #0d8bd9 100%);
            color: white;
            border: none;
            border-radius: 50%;
            width: 64px;
            height: 64px;
            font-size: 28px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            touch-action: manipulation;
        }

        .xvd-fab:active {
            transform: scale(0.95);
        }

        .xvd-fab-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #f4212e;
            color: white;
            font-size: 12px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 10px;
            min-width: 20px;
            text-align: center;
        }

        /* Modal Panel - Bottom Sheet Style */
        .xvd-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
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
            border-radius: 24px 24px 0 0;
            width: 100%;
            max-width: 500px;
            max-height: 85vh;
            overflow-y: auto;
            transform: translateY(100%);
            transition: transform 0.3s ease;
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }

        .xvd-modal-overlay.show .xvd-modal {
            transform: translateY(0);
        }

        .xvd-drag-handle {
            width: 40px;
            height: 5px;
            background: #38444d;
            border-radius: 3px;
            margin: 12px auto;
        }

        .xvd-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px 20px;
            border-bottom: 1px solid #38444d;
        }

        .xvd-modal-title {
            color: white;
            font-size: 18px;
            font-weight: bold;
        }

        .xvd-modal-close {
            background: #38444d;
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
        }

        .xvd-modal-body {
            padding: 20px;
        }

        /* Video Card */
        .xvd-video-card {
            background: #192734;
            border-radius: 16px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid #38444d;
        }

        .xvd-video-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            color: #8899a6;
            font-size: 13px;
        }

        .xvd-video-thumb {
            width: 100%;
            height: 180px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 15px;
            background: #000;
        }

        .xvd-video-info {
            color: #8899a6;
            font-size: 12px;
            margin-bottom: 15px;
            padding: 10px;
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
        }

        /* Download Buttons */
        .xvd-btn-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .xvd-btn {
            width: 100%;
            padding: 16px 20px;
            border: none;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s ease;
            touch-action: manipulation;
        }

        .xvd-btn-primary {
            background: linear-gradient(135deg, #1d9bf0 0%, #0d8bd9 100%);
            color: white;
        }

        .xvd-btn-primary:active {
            transform: scale(0.98);
            background: #0d8bd9;
        }

        .xvd-btn-secondary {
            background: #38444d;
            color: white;
        }

        .xvd-btn-secondary:active {
            background: #4a5568;
        }

        .xvd-btn-success {
            background: linear-gradient(135deg, #00ba7c 0%, #00a06a 100%);
            color: white;
        }

        .xvd-btn-icon {
            font-size: 20px;
        }

        /* Status */
        .xvd-status {
            padding: 20px;
            text-align: center;
            color: #8899a6;
        }

        .xvd-status-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }

        .xvd-status-text {
            font-size: 16px;
            margin-bottom: 5px;
        }

        .xvd-status-subtext {
            font-size: 13px;
            opacity: 0.7;
        }

        /* Loading Spinner */
        .xvd-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #38444d;
            border-top-color: #1d9bf0;
            border-radius: 50%;
            animation: xvd-spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        @keyframes xvd-spin {
            to { transform: rotate(360deg); }
        }

        /* Toast */
        .xvd-toast {
            position: fixed;
            bottom: 170px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: #192734;
            color: white;
            padding: 14px 24px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 9999999;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            border: 1px solid #38444d;
            max-width: 90%;
            text-align: center;
        }

        .xvd-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .xvd-toast.success {
            background: #00ba7c;
            border-color: #00ba7c;
        }

        .xvd-toast.error {
            background: #f4212e;
            border-color: #f4212e;
        }

        /* Progress */
        .xvd-progress {
            width: 100%;
            height: 8px;
            background: #38444d;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }

        .xvd-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #1d9bf0, #00ba7c);
            border-radius: 4px;
            transition: width 0.3s ease;
        }

        /* Mobile Tips */
        .xvd-mobile-tip {
            background: rgba(29, 155, 240, 0.1);
            border: 1px solid rgba(29, 155, 240, 0.3);
            border-radius: 12px;
            padding: 12px 15px;
            margin-top: 15px;
            color: #1d9bf0;
            font-size: 13px;
            line-height: 1.5;
        }

        .xvd-mobile-tip strong {
            display: block;
            margin-bottom: 5px;
        }

        /* Hide on desktop modal */
        @media (min-width: 768px) {
            .xvd-mobile-tip {
                display: none;
            }
        }
    `);

    // ==================== UTILITIES ====================
    function showToast(message, type = 'info', duration = 3000) {
        const existing = document.querySelector('.xvd-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `xvd-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function extractTweetId(url) {
        const match = url.match(/status\/(\d+)/);
        return match ? match[1] : null;
    }

    // ==================== VIDEO FETCHER ====================
    async function fetchVideoInfo(tweetUrl) {
        const tweetId = extractTweetId(tweetUrl);
        if (!tweetId) throw new Error('Invalid tweet URL');

        // API yang lebih reliable
        const apiUrl = `https://api.vxtwitter.com/Twitter/status/${tweetId}`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                timeout: 15000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        
                        if (data.media_extended && data.media_extended.length > 0) {
                            const videos = data.media_extended
                                .filter(m => m.type === 'video' || m.type === 'gif')
                                .map(v => ({
                                    url: v.url,
                                    thumbnail: v.thumbnail_url || '',
                                    type: v.type,
                                    duration: v.duration_millis ? Math.round(v.duration_millis / 1000) : 0
                                }));
                            
                            if (videos.length > 0) {
                                resolve({
                                    videos,
                                    author: data.user_name || 'unknown',
                                    text: data.text || '',
                                    tweetId
                                });
                                return;
                            }
                        }
                        reject(new Error('No video found in tweet'));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    }

    // ==================== DOWNLOAD METHODS ====================
    
    // Method 1: Direct Link (Paling reliable untuk mobile)
    function downloadDirect(url, filename) {
        // Buka di tab baru - user bisa long press untuk save
        const newTab = window.open(url, '_blank');
        
        if (newTab) {
            showToast('📱 Video dibuka di tab baru. Tekan tahan video untuk menyimpan!', 'success', 5000);
        } else {
            // Popup blocked, coba cara lain
            window.location.href = url;
        }
    }

    // Method 2: Blob Download (Untuk desktop atau jika method 1 gagal)
    function downloadBlob(url, filename) {
        showToast('⏳ Mengunduh video...', 'info', 10000);

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            onprogress: function(progress) {
                if (progress.lengthComputable) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    updateProgress(percent);
                }
            },
            onload: function(response) {
                try {
                    const blob = response.response;
                    const blobUrl = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    }, 1000);

                    showToast('✅ Video berhasil diunduh!', 'success');
                    hideProgress();
                } catch (e) {
                    console.error('Blob download error:', e);
                    showToast('❌ Gagal menyimpan. Mencoba cara lain...', 'error');
                    downloadDirect(url, filename);
                }
            },
            onerror: function(e) {
                console.error('Download error:', e);
                showToast('⚠️ Gagal mengunduh. Membuka video...', 'error');
                hideProgress();
                downloadDirect(url, filename);
            }
        });
    }

    // Method 3: Copy URL
    function copyVideoUrl(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => showToast('📋 URL video disalin!', 'success'))
                .catch(() => fallbackCopy(url));
        } else {
            fallbackCopy(url);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showToast('📋 URL video disalin!', 'success');
        } catch (e) {
            showToast('❌ Gagal menyalin URL', 'error');
        }
        
        document.body.removeChild(textarea);
    }

    // Smart Download - pilih method terbaik
    function smartDownload(url, filename) {
        if (isMobile) {
            // Di mobile, langsung buka di tab baru
            downloadDirect(url, filename);
        } else {
            // Di desktop, coba blob download
            downloadBlob(url, filename);
        }
    }

    // ==================== PROGRESS UI ====================
    let progressElement = null;

    function showProgress() {
        if (!progressElement) {
            progressElement = document.createElement('div');
            progressElement.className = 'xvd-progress';
            progressElement.innerHTML = '<div class="xvd-progress-bar" style="width: 0%"></div>';
        }
        return progressElement;
    }

    function updateProgress(percent) {
        if (progressElement) {
            const bar = progressElement.querySelector('.xvd-progress-bar');
            if (bar) bar.style.width = `${percent}%`;
        }
    }

    function hideProgress() {
        if (progressElement && progressElement.parentElement) {
            progressElement.remove();
        }
    }

    // ==================== MODAL ====================
    function createModal() {
        const overlay = document.createElement('div');
        overlay.className = 'xvd-modal-overlay';
        overlay.id = 'xvd-modal';
        overlay.innerHTML = `
            <div class="xvd-modal">
                <div class="xvd-drag-handle"></div>
                <div class="xvd-modal-header">
                    <span class="xvd-modal-title">📥 Download Video</span>
                    <button class="xvd-modal-close">✕</button>
                </div>
                <div class="xvd-modal-body" id="xvd-modal-body">
                    <div class="xvd-status">
                        <div class="xvd-spinner"></div>
                        <div class="xvd-status-text">Mencari video...</div>
                    </div>
                </div>
            </div>
        `;

        overlay.querySelector('.xvd-modal-close').onclick = hideModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) hideModal();
        };

        // Swipe down to close
        let startY = 0;
        const modal = overlay.querySelector('.xvd-modal');
        modal.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });
        modal.addEventListener('touchmove', (e) => {
            const diff = e.touches[0].clientY - startY;
            if (diff > 100) hideModal();
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function showModal(tweetUrl = null) {
        let overlay = document.getElementById('xvd-modal');
        if (!overlay) overlay = createModal();
        
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        if (tweetUrl) {
            loadVideoForModal(tweetUrl);
        } else {
            findAndLoadVideos();
        }
    }

    function hideModal() {
        const overlay = document.getElementById('xvd-modal');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    async function loadVideoForModal(tweetUrl) {
        const body = document.getElementById('xvd-modal-body');
        if (!body) return;

        body.innerHTML = `
            <div class="xvd-status">
                <div class="xvd-spinner"></div>
                <div class="xvd-status-text">Memproses video...</div>
            </div>
        `;

        try {
            const info = await fetchVideoInfo(tweetUrl);
            renderVideoCards(info);
        } catch (e) {
            body.innerHTML = `
                <div class="xvd-status">
                    <div class="xvd-status-icon">😕</div>
                    <div class="xvd-status-text">Tidak dapat memuat video</div>
                    <div class="xvd-status-subtext">${e.message}</div>
                </div>
                <button class="xvd-btn xvd-btn-secondary" onclick="window.open('${tweetUrl}', '_blank')">
                    <span class="xvd-btn-icon">🔗</span>
                    Buka Tweet
                </button>
            `;
        }
    }

    async function findAndLoadVideos() {
        const body = document.getElementById('xvd-modal-body');
        if (!body) return;

        // Cari URL tweet di halaman saat ini
        let tweetUrl = window.location.href;
        
        if (!extractTweetId(tweetUrl)) {
            // Cari dari tweet yang visible
            const tweetLink = document.querySelector('a[href*="/status/"]');
            if (tweetLink) {
                tweetUrl = tweetLink.href;
            } else {
                body.innerHTML = `
                    <div class="xvd-status">
                        <div class="xvd-status-icon">🔍</div>
                        <div class="xvd-status-text">Tidak ada video ditemukan</div>
                        <div class="xvd-status-subtext">Buka tweet yang berisi video terlebih dahulu</div>
                    </div>
                `;
                return;
            }
        }

        await loadVideoForModal(tweetUrl);
    }

    function renderVideoCards(info) {
        const body = document.getElementById('xvd-modal-body');
        if (!body) return;

        let html = '';

        info.videos.forEach((video, index) => {
            const filename = `${info.author}_${info.tweetId}_${index + 1}.mp4`;
            const duration = video.duration ? `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}` : '';

            html += `
                <div class="xvd-video-card">
                    <div class="xvd-video-card-header">
                        <span>📹 Video ${info.videos.length > 1 ? index + 1 : ''}</span>
                        ${duration ? `<span>⏱️ ${duration}</span>` : ''}
                        <span>${video.type.toUpperCase()}</span>
                    </div>
                    
                    ${video.thumbnail ? `<img class="xvd-video-thumb" src="${video.thumbnail}" alt="Thumbnail">` : ''}
                    
                    <div class="xvd-btn-group">
                        <button class="xvd-btn xvd-btn-primary" data-action="download" data-url="${video.url}" data-filename="${filename}">
                            <span class="xvd-btn-icon">📥</span>
                            ${isMobile ? 'Buka & Simpan Video' : 'Download Video'}
                        </button>
                        
                        <button class="xvd-btn xvd-btn-secondary" data-action="copy" data-url="${video.url}">
                            <span class="xvd-btn-icon">📋</span>
                            Salin URL Video
                        </button>
                        
                        <button class="xvd-btn xvd-btn-secondary" data-action="preview" data-url="${video.url}">
                            <span class="xvd-btn-icon">👁️</span>
                            Preview di Tab Baru
                        </button>
                    </div>
                    
                    ${isMobile ? `
                        <div class="xvd-mobile-tip">
                            <strong>💡 Cara menyimpan di HP:</strong>
                            1. Tekan "Buka & Simpan Video"<br>
                            2. Video akan terbuka di tab baru<br>
                            3. <strong>Tekan tahan</strong> pada video<br>
                            4. Pilih "Download" atau "Simpan Video"
                        </div>
                    ` : ''}
                </div>
            `;
        });

        body.innerHTML = html;

        // Event listeners
        body.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                const url = btn.dataset.url;
                const filename = btn.dataset.filename;

                switch(action) {
                    case 'download':
                        smartDownload(url, filename);
                        break;
                    case 'copy':
                        copyVideoUrl(url);
                        break;
                    case 'preview':
                        window.open(url, '_blank');
                        break;
                }
            };
        });
    }

    // ==================== FAB BUTTON ====================
    function createFAB() {
        if (document.querySelector('.xvd-fab')) return;

        const fab = document.createElement('button');
        fab.className = 'xvd-fab';
        fab.innerHTML = '📥';
        fab.onclick = () => showModal();
        document.body.appendChild(fab);
    }

    // ==================== VIDEO OVERLAY BUTTON ====================
    function addOverlayButtons() {
        document.querySelectorAll('video').forEach(video => {
            const container = video.closest('[data-testid="videoComponent"]') 
                            || video.closest('[data-testid="tweetPhoto"]')
                            || video.parentElement;
            
            if (!container || container.querySelector('.xvd-download-btn')) return;
            if (container.closest('.xvd-modal')) return; // Skip modal videos

            container.style.position = 'relative';

            const btn = document.createElement('button');
            btn.className = 'xvd-download-btn';
            btn.innerHTML = '📥';
            
            btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳';
                btn.disabled = true;

                try {
                    // Cari tweet URL
                    const article = container.closest('article');
                    let tweetUrl = window.location.href;
                    
                    if (article) {
                        const link = article.querySelector('a[href*="/status/"]');
                        if (link) tweetUrl = link.href;
                    }

                    const info = await fetchVideoInfo(tweetUrl);
                    if (info.videos.length > 0) {
                        const filename = `${info.author}_${info.tweetId}.mp4`;
                        smartDownload(info.videos[0].url, filename);
                    }
                } catch (e) {
                    showToast('❌ ' + e.message, 'error');
                }

                btn.innerHTML = originalText;
                btn.disabled = false;
            };

            container.appendChild(btn);
        });
    }

    // ==================== OBSERVER ====================
    function startObserver() {
        const observer = new MutationObserver(() => {
            addOverlayButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== INIT ====================
    function init() {
        console.log('🎬 X Video Downloader v3.0 loaded');
        console.log('📱 Mobile mode:', isMobile);

        createFAB();
        addOverlayButtons();
        startObserver();
    }

    // Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }

})();
