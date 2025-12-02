// ==UserScript==
// @name         X Video Downloader - DOM Mode (Firefox Android)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Download video X/Twitter termasuk dari akun terkunci - DOM Direct Access
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

    // ... (CSS tetap sama) ...

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

    // ========== GET VIDEO FROM DOM (IMPROVED) ==========
    function getVideoFromDOM() {
        console.log('🔍 Mencari video di DOM (Enhanced Mode)...');
        
        const results = [];
        
        // METODE 1: Cari semua video element
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} video elements`);
        
        for (const vid of videos) {
            let videoUrl = null;
            let thumb = vid.poster || '';
            
            // Priority 1: currentSrc (video yang sedang dimuat)
            if (vid.currentSrc && vid.currentSrc.includes('video.twimg.com')) {
                videoUrl = vid.currentSrc;
            }
            // Priority 2: src langsung
            else if (vid.src && vid.src.includes('video.twimg.com')) {
                videoUrl = vid.src;
            }
            // Priority 3: source element
            else if (!videoUrl) {
                const source = vid.querySelector('source');
                if (source && source.src && source.src.includes('video.twimg.com')) {
                    videoUrl = source.src;
                }
            }
            // Priority 4: Blob URL (akun terkunci sering pakai ini)
            else if (vid.src && vid.src.startsWith('blob:')) {
                // Coba ambil dari event/playback
                try {
                    if (vid.readyState >= 2) { // HAVE_CURRENT_DATA atau lebih
                        // Untuk blob, kita perlu menunggu video dimuat sepenuhnya
                        videoUrl = vid.src;
                    }
                } catch (e) {
                    console.log('Blob video belum siap');
                }
            }
            
            if (videoUrl) {
                console.log('✓ Video ditemukan:', videoUrl.substring(0, 100) + '...');
                results.push({
                    url: videoUrl,
                    thumb: thumb,
                    element: vid,
                    isBlob: videoUrl.startsWith('blob:'),
                    quality: 'unknown'
                });
            }
        }
        
        // METODE 2: Cari di Twitter's media container (untuk akun terkunci)
        if (results.length === 0) {
            console.log('🔍 Mencari di media containers...');
            
            // Cari semua container media
            const mediaContainers = document.querySelectorAll('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[role="presentation"]');
            
            for (const container of mediaContainers) {
                // Coba cari video di dalamnya
                const vid = container.querySelector('video');
                if (vid) {
                    const videoUrl = vid.src || vid.currentSrc;
                    if (videoUrl && (videoUrl.includes('video.twimg.com') || videoUrl.startsWith('blob:'))) {
                        results.push({
                            url: videoUrl,
                            thumb: vid.poster || '',
                            element: vid,
                            isBlob: videoUrl.startsWith('blob:'),
                            quality: 'unknown'
                        });
                        break;
                    }
                }
                
                // Cari URL video di data attributes
                const dataUrl = container.getAttribute('data-video-url') || 
                               container.getAttribute('data-src') ||
                               container.querySelector('a[href*="video.twimg.com"]')?.href;
                
                if (dataUrl && dataUrl.includes('video.twimg.com')) {
                    results.push({
                        url: dataUrl,
                        thumb: '',
                        element: null,
                        isBlob: false,
                        quality: 'HD'
                    });
                    break;
                }
            }
        }
        
        // METODE 3: Cari di tweet container untuk akun terkunci
        if (results.length === 0) {
            console.log('🔍 Mencari di tweet containers...');
            
            const articles = document.querySelectorAll('article');
            for (const article of articles) {
                // Cari semua link yang kemungkinan video
                const links = article.querySelectorAll('a[href*="video.twimg.com"]');
                for (const link of links) {
                    if (link.href.includes('.mp4') || link.href.includes('.m3u8')) {
                        results.push({
                            url: link.href,
                            thumb: '',
                            element: null,
                            isBlob: false,
                            quality: 'HD'
                        });
                        break;
                    }
                }
                
                // Cari data attributes yang berisi video URL
                const tweetDiv = article.closest('div[data-testid="tweet"]');
                if (tweetDiv) {
                    const tweetText = tweetDiv.innerText || tweetDiv.textContent;
                    const videoMatch = tweetText.match(/https:\/\/video\.twimg\.com\/[^\s]+/);
                    if (videoMatch) {
                        results.push({
                            url: videoMatch[0],
                            thumb: '',
                            element: null,
                            isBlob: false,
                            quality: 'HD'
                        });
                    }
                }
            }
        }
        
        // METODE 4: Untuk Blob URL, coba force video load
        if (results.length === 0) {
            const blobVideos = Array.from(document.querySelectorAll('video')).filter(v => v.src.startsWith('blob:'));
            if (blobVideos.length > 0) {
                console.log('🎯 Mencoba memuat blob video...');
                const vid = blobVideos[0];
                
                // Coba play video sebentar untuk memastikan blob terisi
                try {
                    if (vid.paused) {
                        vid.play().catch(e => console.log('Auto-play diblokir:', e));
                        await new Promise(resolve => setTimeout(resolve, 300));
                        vid.pause();
                    }
                    
                    if (vid.readyState >= 2) {
                        results.push({
                            url: vid.src,
                            thumb: vid.poster || '',
                            element: vid,
                            isBlob: true,
                            quality: 'unknown'
                        });
                    }
                } catch (e) {
                    console.log('Gagal memuat blob video:', e);
                }
            }
        }
        
        return results.length > 0 ? results : null;
    }

    // ========== FETCH VIDEO VIA API (FALLBACK) ==========
    function fetchVideoAPI(tweetUrl) {
        return new Promise((resolve, reject) => {
            const id = getTweetId(tweetUrl);
            if (!id) return reject('URL tidak valid');

            console.log('📡 Mencoba API untuk tweet:', id);

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.vxtwitter.com/Twitter/status/${id}`,
                timeout: 15000,
                onload: (r) => {
                    try {
                        const d = JSON.parse(r.responseText);
                        if (d.media_extended) {
                            const vids = d.media_extended
                                .filter(m => m.type === 'video' || m.type === 'gif')
                                .map(v => ({
                                    url: v.url,
                                    thumb: v.thumbnail_url || '',
                                    type: v.type,
                                    quality: 'HD'
                                }));
                            if (vids.length) {
                                console.log('✓ API berhasil');
                                return resolve({
                                    videos: vids,
                                    user: d.user_name || 'user',
                                    id: id,
                                    mode: 'api'
                                });
                            }
                        }
                        reject('API: Tweet tidak mengandung video');
                    } catch (e) {
                        reject('API: Gagal memproses data');
                    }
                },
                onerror: () => reject('API: Koneksi gagal'),
                ontimeout: () => reject('API: Request timeout')
            });
        });
    }

    // ========== HANDLE BLOB VIDEO ==========
    function blobToDataURL(blobUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: blobUrl,
                responseType: 'blob',
                onload: (response) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(response.response);
                },
                onerror: reject
            });
        });
    }

    // ========== GET DIRECT VIDEO URL (Khusus untuk akun terkunci) ==========
    function extractProtectedVideoURL() {
        console.log('🛡️ Mencari URL video protected...');
        
        // Metode 1: Cari di semua script yang berisi video URL
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent || script.innerText;
            if (content.includes('video.twimg.com')) {
                const matches = content.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.(mp4|m3u8)/g);
                if (matches && matches.length > 0) {
                    return matches[0];
                }
            }
        }
        
        // Metode 2: Cari di video player yang mungkin disembunyikan
        const hiddenVideos = document.querySelectorAll('video[style*="display: none"], video[hidden]');
        for (const vid of hiddenVideos) {
            if (vid.src && vid.src.includes('video.twimg.com')) {
                return vid.src;
            }
        }
        
        // Metode 3: Coba ambil dari network data yang disimpan di memori
        try {
            const performanceEntries = performance.getEntriesByType('resource');
            const videoEntries = performanceEntries.filter(entry => 
                entry.name.includes('video.twimg.com') && 
                (entry.name.endsWith('.mp4') || entry.name.includes('.m3u8'))
            );
            
            if (videoEntries.length > 0) {
                return videoEntries[videoEntries.length - 1].name;
            }
        } catch (e) {
            console.log('Tidak bisa akses performance API');
        }
        
        return null;
    }

    // ========== MODAL (sama seperti sebelumnya, dengan sedikit perbaikan) ==========
    let backdrop = null;

    function getModal() {
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.className = 'xvd-backdrop';
        backdrop.innerHTML = `
            <div class="xvd-box">
                <div class="xvd-head">
                    <span class="xvd-head-title">🔥 Download Video</span>
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

    function showLoading(msg = 'Mengambil video...') {
        setBody(`
            <div class="xvd-spin"></div>
            <div class="xvd-loading-text">${msg}</div>
        `);
    }

    function showError(msg) {
        setBody(`
            <div class="xvd-error">
                <div class="xvd-error-icon">😕</div>
                <div class="xvd-error-msg">Gagal Mendeteksi Video</div>
                <div class="xvd-error-detail">${msg}</div>
            </div>
            <div class="xvd-steps">
                <div class="xvd-steps-title">💡 Tips untuk Akun Terkunci:</div>
                <div class="xvd-step">
                    <span class="xvd-step-num">1</span>
                    <span><strong>Tunggu video selesai dimuat sepenuhnya</strong></span>
                </div>
                <div class="xvd-step">
                    <span class="xvd-step-num">2</span>
                    <span><strong>Putar video sampai selesai minimal 1x</strong></span>
                </div>
                <div class="xvd-step">
                    <span class="xvd-step-num">3</span>
                    <span><strong>Scroll sedikit ke atas/bawah lalu coba lagi</strong></span>
                </div>
                <div class="xvd-step">
                    <span class="xvd-step-num">4</span>
                    <span><strong>Buka tweet di tab baru (tekam tahan link tweet)</strong></span>
                </div>
            </div>
        `);
    }

    function showResult(data) {
        const v = data.videos[0];
        const id = data.id || Date.now().toString();
        const user = data.user || 'protected';
        const mode = data.mode || 'dom';
        const filename = `${user}_${id}.mp4`;
        
        const isBlob = v.url && v.url.startsWith('blob:');
        const isProtected = mode === 'dom';

        let instructionHTML = '';
        let infoBannerHTML = '';

        if (isProtected) {
            instructionHTML = `
                <div class="xvd-instruction warning">
                    <div class="xvd-instruction-icon">⚠️</div>
                    <div class="xvd-instruction-main">AKUN TERKUNCI / PROTECTED DETECTED</div>
                    <div class="xvd-instruction-sub">Gunakan metode manual di bawah</div>
                </div>
            `;
            
            infoBannerHTML = `
                <div class="xvd-info-banner warning">
                    <div class="xvd-info-title warning">📌 Cara Download Akun Terkunci:</div>
                    <div class="xvd-info-text">
                        <strong>METODE 1 (Rekomendasi):</strong><br>
                        1. Buka video di tab baru<br>
                        2. Putar video sampai selesai<br>
                        3. Tekan tahan video → "Save video"<br><br>
                        <strong>METODE 2 (Alternatif):</strong><br>
                        1. Salin URL di bawah<br>
                        2. Tempel di browser lain<br>
                        3. Download manual
                    </div>
                </div>
            `;
        } else {
            instructionHTML = `
                <div class="xvd-instruction">
                    <div class="xvd-instruction-icon">👇</div>
                    <div class="xvd-instruction-main">TEKAN TAHAN TOMBOL HIJAU</div>
                    <div class="xvd-instruction-sub">Lalu pilih "Download link" atau "Simpan tautan"</div>
                </div>
            `;
        }

        // Untuk blob URL, kita tidak bisa memberikan download langsung
        const downloadButtonHTML = isBlob ? `
            <a href="${v.url}" 
               class="xvd-download-link" 
               target="_blank" 
               rel="noopener noreferrer">
                🔄 BUKA BLOB DI TAB BARU
            </a>
            <div class="xvd-info-banner">
                <div class="xvd-info-title">⚠️ Blob Video Detected:</div>
                <div class="xvd-info-text">
                    Video menggunakan format blob. Buka di tab baru, 
                    lalu tekan tahan pada video untuk save manual.
                </div>
            </div>
        ` : `
            <a href="${v.url}" 
               class="xvd-download-link" 
               download="${filename}"
               type="video/mp4">
                💾 DOWNLOAD SEKARANG
            </a>
        `;

        // Video preview
        const videoPreviewHTML = v.url ? `
            <div class="xvd-vid-container">
                <video class="xvd-vid" 
                       src="${v.url}" 
                       controls 
                       playsinline
                       ${v.thumb ? `poster="${v.thumb}"` : ''}
                       preload="metadata">
                       Your browser does not support the video tag.
                </video>
            </div>
        ` : '';

        setBody(`
            ${instructionHTML}

            ${infoBannerHTML}

            <div class="xvd-btn-row">
                <button class="xvd-btn-sec xvd-btn-primary" id="xvd-newtab-btn">📱 Buka di Tab Baru</button>
                <button class="xvd-btn-sec" id="xvd-copy-btn">📋 Salin URL</button>
            </div>

            ${downloadButtonHTML}

            ${videoPreviewHTML}

            <div class="xvd-info-banner">
                <div class="xvd-info-title">Mode Deteksi: <span class="xvd-mode-badge ${mode}">${mode.toUpperCase()}</span></div>
                <div class="xvd-info-text">
                    ${isProtected ? 
                        'Video diambil langsung dari halaman. Twitter membatasi akses ke akun terkunci.' : 
                        'Video diambil via API publik.'
                 
