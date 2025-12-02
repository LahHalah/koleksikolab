// ==UserScript==
// @name         X (Twitter) Video Downloader - Mobile
// @namespace    https://github.com/violentmonkey
// @version      2.0
// @description  Tambahkan tombol download video di X/Twitter dengan UI mobile-friendly
// @author       YourName
// @match        https://twitter.com/*
// @match        https://x.com/*
// @match        https://mobile.twitter.com/*
// @match        https://mobile.x.com/*
// @icon         https://abs.twimg.com/favicons/twitter.3.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_download
// @grant        GM_addStyle
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Konfigurasi
    const CONFIG = {
        buttonColor: '#1DA1F2', // Warna biru Twitter
        buttonHoverColor: '#0d8bd9',
        textColor: '#FFFFFF',
        mobileBreakpoint: 768, // px
        buttonSize: {
            desktop: '36px',
            mobile: '44px' // Lebih besar untuk mobile
        },
        iconSize: {
            desktop: '20px',
            mobile: '24px'
        },
        checkInterval: 1000, // Interval pengecekan video baru (ms)
        maxRetries: 3 // Maksimum percobaan pengambilan video
    };

    // Tambahkan CSS untuk UI
    GM_addStyle(`
        .xvd-container {
            position: relative;
            display: inline-block;
        }
        
        .xvd-download-btn {
            position: absolute;
            bottom: 12px;
            right: 12px;
            width: ${CONFIG.buttonSize.desktop};
            height: ${CONFIG.buttonSize.desktop};
            background-color: ${CONFIG.buttonColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            border: 2px solid white;
            transition: all 0.2s ease;
            opacity: 0.9;
        }
        
        .xvd-download-btn:hover {
            background-color: ${CONFIG.buttonHoverColor};
            opacity: 1;
            transform: scale(1.1);
        }
        
        .xvd-download-btn svg {
            width: ${CONFIG.iconSize.desktop};
            height: ${CONFIG.iconSize.desktop};
            fill: ${CONFIG.textColor};
        }
        
        .xvd-download-menu {
            position: absolute;
            bottom: 60px;
            right: 0;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            padding: 12px;
            z-index: 10000;
            min-width: 200px;
            display: none;
            flex-direction: column;
            gap: 8px;
        }
        
        .xvd-download-menu.show {
            display: flex;
        }
        
        .xvd-quality-btn {
            padding: 12px 16px;
            background: #f8f9fa;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #333;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s ease;
        }
        
        .xvd-quality-btn:hover {
            background: #e8e8e8;
        }
        
        .xvd-quality-btn.highest {
            background: #e8f4fc;
            color: ${CONFIG.buttonColor};
        }
        
        .xvd-quality-btn .size {
            float: right;
            color: #666;
            font-weight: normal;
        }
        
        .xvd-loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: xvd-spin 1s ease-in-out infinite;
        }
        
        @keyframes xvd-spin {
            to { transform: rotate(360deg); }
        }
        
        .xvd-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 100000;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 320px;
            animation: xvd-slideIn 0.3s ease;
        }
        
        @keyframes xvd-slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .xvd-notification.error {
            background: #f44336;
        }
        
        .xvd-notification svg {
            width: 20px;
            height: 20px;
            fill: white;
        }
        
        /* Responsif untuk mobile */
        @media (max-width: ${CONFIG.mobileBreakpoint}px) {
            .xvd-download-btn {
                width: ${CONFIG.buttonSize.mobile};
                height: ${CONFIG.buttonSize.mobile};
                bottom: 16px;
                right: 16px;
            }
            
            .xvd-download-btn svg {
                width: ${CONFIG.iconSize.mobile};
                height: ${CONFIG.iconSize.mobile};
            }
            
            .xvd-download-menu {
                bottom: 70px;
                right: 5px;
                min-width: 250px;
                padding: 16px;
            }
            
            .xvd-quality-btn {
                padding: 16px 20px;
                font-size: 16px;
            }
            
            .xvd-notification {
                top: auto;
                bottom: 20px;
                right: 20px;
                left: 20px;
                max-width: none;
            }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .xvd-download-menu {
                background: #15202b;
                color: white;
            }
            
            .xvd-quality-btn {
                background: #253341;
                color: white;
            }
            
            .xvd-quality-btn:hover {
                background: #2d4252;
            }
            
            .xvd-quality-btn.highest {
                background: #1a365d;
            }
            
            .xvd-quality-btn .size {
                color: #aaa;
            }
        }
    `);

    // State management
    const state = {
        videoUrls: new Map(), // Menyimpan URL video berdasarkan tweet ID
        processing: new Set(), // Tweet yang sedang diproses
        initialized: false
    };

    // Ikon SVG untuk tombol download
    const downloadIcon = `
        <svg viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
    `;

    // Ikon notifikasi
    const successIcon = `
        <svg viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
    `;

    const errorIcon = `
        <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    `;

    // Fungsi utama untuk inisialisasi
    function init() {
        if (state.initialized) return;
        
        console.log('[X Video Downloader] Script dijalankan');
        
        // Tambahkan tombol ke video yang sudah ada
        scanAndAddButtons();
        
        // Gunakan MutationObserver untuk mendeteksi konten baru
        const observer = new MutationObserver(() => {
            scanAndAddButtons();
        });
        
        // Mulai observasi
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Juga scan secara berkala untuk memastikan tidak ada yang terlewat
        setInterval(scanAndAddButtons, CONFIG.checkInterval);
        
        state.initialized = true;
    }

    // Scan halaman untuk video dan tambahkan tombol
    function scanAndAddButtons() {
        // Cari semua elemen video di tweet
        const videoContainers = document.querySelectorAll('div[data-testid="videoPlayer"]');
        
        videoContainers.forEach(container => {
            // Hindari duplikasi
            if (container.querySelector('.xvd-download-btn')) return;
            
            // Dapatkan tweet parent
            const tweet = container.closest('article');
            if (!tweet) return;
            
            // Tambahkan tombol download
            addDownloadButton(container, tweet);
        });
        
        // Juga cari video di dalam div[role="dialog"] (modal tweet)
        const modalVideos = document.querySelectorAll('div[role="dialog"] div[data-testid="videoPlayer"]');
        modalVideos.forEach(container => {
            if (container.querySelector('.xvd-download-btn')) return;
            addDownloadButton(container);
        });
    }

    // Tambahkan tombol download ke container video
    function addDownloadButton(videoContainer, tweet = null) {
        // Buat wrapper container
        const wrapper = document.createElement('div');
        wrapper.className = 'xvd-container';
        
        // Pindahkan video ke wrapper
        const videoElement = videoContainer.querySelector('video');
        if (!videoElement) return;
        
        videoContainer.parentNode.insertBefore(wrapper, videoContainer);
        wrapper.appendChild(videoContainer);
        
        // Buat tombol download
        const downloadBtn = document.createElement('div');
        downloadBtn.className = 'xvd-download-btn';
        downloadBtn.innerHTML = downloadIcon;
        downloadBtn.title = 'Download video';
        
        // Buat menu kualitas (akan ditampilkan nanti)
        const menu = document.createElement('div');
        menu.className = 'xvd-download-menu';
        
        // Event listener untuk tombol
        downloadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Toggle menu
            if (menu.classList.contains('show')) {
                menu.classList.remove('show');
                return;
            }
            
            // Tampilkan menu
            menu.classList.add('show');
            
            // Jika menu masih kosong, ambil opsi kualitas
            if (menu.children.length === 0) {
                await fetchVideoQualities(videoContainer, menu, tweet);
            }
            
            // Tutup menu saat klik di luar
            setTimeout(() => {
                const closeMenuHandler = (event) => {
                    if (!menu.contains(event.target) && !downloadBtn.contains(event.target)) {
                        menu.classList.remove('show');
                        document.removeEventListener('click', closeMenuHandler);
                    }
                };
                document.addEventListener('click', closeMenuHandler);
            }, 10);
        });
        
        // Tambahkan elemen ke DOM
        videoContainer.appendChild(downloadBtn);
        videoContainer.appendChild(menu);
        
        // Dapatkan URL video dari elemen video
        extractVideoUrl(videoElement, tweet);
    }

    // Ekstrak URL video dari elemen <video>
    function extractVideoUrl(videoElement, tweet) {
        try {
            // Coba dapatkan sumber video terbaik
            let videoUrl = null;
            
            // Prioritas 1: src attribute langsung
            if (videoElement.src && videoElement.src.startsWith('http')) {
                videoUrl = videoElement.src;
            }
            // Prioritas 2: child <source> elements
            else {
                const sources = videoElement.querySelectorAll('source');
                for (const source of sources) {
                    if (source.src && source.src.startsWith('http')) {
                        videoUrl = source.src;
                        break;
                    }
                }
            }
            
            // Simpan URL jika ditemukan
            if (videoUrl) {
                const tweetId = tweet ? getTweetId(tweet) : 'modal-' + Date.now();
                state.videoUrls.set(tweetId, {
                    default: videoUrl,
                    qualities: [{url: videoUrl, quality: 'Default'}]
                });
            }
        } catch (error) {
            console.error('[X Video Downloader] Gagal mengekstrak URL video:', error);
        }
    }

    // Ambil opsi kualitas video
    async function fetchVideoQualities(videoContainer, menu, tweet) {
        const tweetId = tweet ? getTweetId(tweet) : 'modal-' + Date.now();
        
        // Tampilkan indikator loading
        menu.innerHTML = '<div style="padding: 20px; text-align: center;"><div class="xvd-loading"></div></div>';
        
        // Coba ambil dari cache dulu
        if (state.videoUrls.has(tweetId)) {
            const videoData = state.videoUrls.get(tweetId);
            populateQualityMenu(menu, videoData.qualities, videoContainer);
            return;
        }
        
        // Jika tidak ada di cache, coba ekstrak dari halaman
        try {
            // Cari semua kemungkinan URL video di sekitar tweet
            const videoUrls = findVideoUrlsInTweet(tweet || videoContainer);
            
            if (videoUrls.length > 0) {
                state.videoUrls.set(tweetId, {
                    default: videoUrls[0].url,
                    qualities: videoUrls
                });
                
                populateQualityMenu(menu, videoUrls, videoContainer);
            } else {
                // Fallback: gunakan URL dari elemen video langsung
                const videoElement = videoContainer.querySelector('video');
                if (videoElement) {
                    const url = videoElement.src || (videoElement.querySelector('source')?.src);
                    if (url) {
                        const videoData = [{url, quality: 'Default'}];
                        state.videoUrls.set(tweetId, {
                            default: url,
                            qualities: videoData
                        });
                        
                        populateQualityMenu(menu, videoData, videoContainer);
                    } else {
                        showError(menu, 'Tidak dapat menemukan URL video');
                    }
                } else {
                    showError(menu, 'Tidak dapat menemukan video');
                }
            }
        } catch (error) {
            console.error('[X Video Downloader] Gagal mengambil kualitas video:', error);
            showError(menu, 'Gagal memuat opsi download');
        }
    }

    // Cari URL video di dalam tweet
    function findVideoUrlsInTweet(tweetElement) {
        const urls = [];
        
        // Cari semua tag video dan source
        const videoElements = tweetElement.querySelectorAll('video, source');
        videoElements.forEach(el => {
            const url = el.src || el.getAttribute('src');
            if (url && url.startsWith('http') && !urls.some(u => u.url === url)) {
                // Coba tebak kualitas dari URL
                let quality = 'Default';
                if (url.includes('/vid/')) {
                    const match = url.match(/(\d+)x(\d+)/);
                    if (match) {
                        quality = `${match[1]}p`;
                    }
                } else if (url.includes('.mp4')) {
                    quality = 'MP4';
                }
                
                urls.push({url, quality});
            }
        });
        
        // Juga cari di data attributes
        const dataElements = tweetElement.querySelectorAll('[data-video-url]');
        dataElements.forEach(el => {
            const url = el.getAttribute('data-video-url');
            if (url && url.startsWith('http') && !urls.some(u => u.url === url)) {
                urls.push({url, quality: 'Data URL'});
            }
        });
        
        // Sort by quality (higher first)
        urls.sort((a, b) => {
            const getHeight = (q) => parseInt(q) || 0;
            return getHeight(b.quality) - getHeight(a.quality);
        });
        
        return urls;
    }

    // Isi menu dengan opsi kualitas
    function populateQualityMenu(menu, qualities, videoContainer) {
        menu.innerHTML = '';
        
        if (qualities.length === 0) {
            showError(menu, 'Tidak ada kualitas tersedia');
            return;
        }
        
        // Tambahkan setiap kualitas sebagai tombol
        qualities.forEach((qualityInfo, index) => {
            const btn = document.createElement('button');
            btn.className = `xvd-quality-btn ${index === 0 ? 'highest' : ''}`;
            btn.innerHTML = `${qualityInfo.quality} <span class="size">↓</span>`;
            
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menu.classList.remove('show');
                
                try {
                    // Tampilkan notifikasi
                    showNotification('Mempersiapkan download...', false);
                    
                    // Download video
                    await downloadVideo(qualityInfo.url, videoContainer);
                } catch (error) {
                    console.error('[X Video Downloader] Gagal download:', error);
                    showNotification('Gagal mengunduh video', true);
                }
            });
            
            menu.appendChild(btn);
        });
    }

    // Tampilkan error di menu
    function showError(menu, message) {
        menu.innerHTML = `<div style="padding: 16px; color: #f44336; text-align: center;">${message}</div>`;
    }

    // Download video
    async function downloadVideo(url, videoContainer) {
        return new Promise((resolve, reject) => {
            // Buat nama file
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const filename = `x_video_${timestamp}.mp4`;
            
            // Gunakan GM_download untuk download
            GM_download({
                url: url,
                name: filename,
                onload: function() {
                    showNotification('Video berhasil diunduh!', false);
                    resolve();
                },
                onerror: function(error) {
                    // Fallback: buka tab baru jika GM_download gagal
                    console.warn('[X Video Downloader] GM_download gagal, mencoba fallback:', error);
                    window.open(url, '_blank');
                    showNotification('Membuka video di tab baru...', false);
                    resolve();
                }
            });
        });
    }

    // Tampilkan notifikasi
    function showNotification(message, isError = false) {
        // Hapus notifikasi sebelumnya
        const oldNotification = document.querySelector('.xvd-notification');
        if (oldNotification) {
            oldNotification.remove();
        }
        
        // Buat notifikasi baru
        const notification = document.createElement('div');
        notification.className = `xvd-notification ${isError ? 'error' : ''}`;
        notification.innerHTML = `
            ${isError ? errorIcon : successIcon}
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Hapus otomatis setelah 3 detik
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                    if (notification.parentNode                    const data = JSON.parse(response.responseText);
                    
                    // Mencari objek video di dalam JSON yang kompleks
                    let mediaArr = data.mediaDetails || (data.video ? [data.video] : []);
                    const videoData = mediaArr.find(m => m.type === "video" || m.type === "animated_gif");

                    if (!videoData || !videoData.variants) {
                        alert("Video tidak ditemukan (Mungkin konten sensitif/privat).");
                        btnElement.innerHTML = "❌ Gagal";
                        setTimeout(() => btnElement.innerHTML = originalText, 2000);
                        return;
                    }

                    // Filter MP4 & ambil kualitas tertinggi
                    const mp4Variants = videoData.variants
                        .filter(v => v.content_type === "video/mp4")
                        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

                    if (mp4Variants.length === 0) {
                        alert("Hanya tersedia format streaming (m3u8).");
                        btnElement.innerHTML = originalText;
                        return;
                    }

                    const videoUrl = mp4Variants[0].url;
                    const filename = `twitter_vid_${tweetId}.mp4`;

                    // --- 3. Mekanisme Download (Fallback Chain) ---
                    
                    // Coba metode 1: GM_download (Paling rapi jika didukung browser)
                    // Note: Firefox Android kadang memblokir ini tergantung setting
                    try {
                        btnElement.innerHTML = `⬇️ Mengunduh...`;
                        
                        // Deteksi sederhana: Jika di mobile, GM_download kadang tidak responsif
                        // Kita paksa buka tab baru saja karena itu paling reliable di HP
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        
                        if (isMobile) {
                            // Cara Paling Aman di Android: Buka Direct Link
                            window.location.href = videoUrl;
                            btnElement.innerHTML = "✅ Buka Player";
                        } else {
                            // Di Desktop atau jika support
                            GM_download({
                                url: videoUrl,
                                name: filename,
                                onload: () => {
                                    btnElement.innerHTML = "✅ Selesai";
                                    setTimeout(() => btnElement.innerHTML = originalText, 3000);
                                },
                                onerror: (err) => {
                                    // Fallback jika GM_download gagal
                                    window.location.href = videoUrl;
                                }
                            });
                        }
                    } catch (e) {
                        window.location.href = videoUrl;
                    }

                    // Reset tombol setelah beberapa detik
                    setTimeout(() => {
                        if(btnElement.innerHTML.includes("Buka")) btnElement.innerHTML = originalText;
                    }, 5000);

                } catch (e) {
                    console.error(e);
                    btnElement.innerHTML = "❌ Error";
                    alert("Terjadi kesalahan saat memproses data video.");
                    setTimeout(() => btnElement.innerHTML = originalText, 2000);
                }
            }
        });
    }

    // --- 4. Fungsi Scan & Inject UI ---
    function getTweetId(article) {
        // Cari link permalink yang mengandung /status/ID
        const timeLink = article.querySelector('a[href*="/status/"]');
        if (!timeLink) return null;
        
        const match = timeLink.href.match(/status\/(\d+)/);
        return match ? match[1] : null;
    }

    function addDownloadButton(article) {
        // Cari container video player
        // Kita mencari elemen yang membungkus video agar tombolnya melayang di atas video
        const videoComponent = article.querySelector('[data-testid="videoComponent"]') || 
                               article.querySelector('[data-testid="videoPlayer"]');
        
        if (!videoComponent) return;

        // Cek apakah tombol sudah ada agar tidak duplikat
        if (videoComponent.querySelector('.x-dl-overlay-btn')) return;

        // Buat ID tweet
        const tweetId = getTweetId(article);
        if (!tweetId) return;

        // Buat Element Tombol
        const btn = document.createElement('div');
        btn.className = 'x-dl-overlay-btn';
        btn.innerHTML = `<span class="x-dl-icon">⬇️</span> Save`;
        
        // Mencegah klik tombol men-trigger play/pause video atau membuka detail tweet
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fetchAndDownload(tweetId, btn);
        });

        // Tempelkan tombol ke dalam container video
        // Kita set style position relative pada parent jika belum ada, agar absolute positioning tombol pas
        if (getComputedStyle(videoComponent).position === 'static') {
            videoComponent.style.position = 'relative';
        }
        
        videoComponent.appendChild(btn);
    }

    // --- 5. Observer (Pemantau Scroll) ---
    // Menggunakan MutationObserver jauh lebih efisien daripada setInterval untuk HP
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                    // Jika node itu sendiri adalah article (tweet)
                    if (node.tagName === 'ARTICLE') {
                        addDownloadButton(node);
                    }
                    // Atau jika node berisi article (misal loading feed baru)
                    const articles = node.querySelectorAll('article');
                    articles.forEach(addDownloadButton);
                }
            }
        }
    });

    // Mulai memantau perubahan di body
    observer.observe(document.body, { childList: true, subtree: true });

    // Scan awal (untuk tweet yang sudah terload saat pertama buka)
    setTimeout(() => {
        document.querySelectorAll('article').forEach(addDownloadButton);
    }, 1500);

})();
