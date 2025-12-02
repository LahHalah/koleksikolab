// ==UserScript==
// @name         X Video Downloader Mobile (Violentmonkey)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Tombol download besar dan mudah diakses untuk Twitter/X Mobile
// @author       You
// @match        https://twitter.com/*
// @match        https://x.com/*
// @match        https://mobile.twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CSS Styles untuk Tampilan Mobile yang Nyaman ---
    const css = `
        .x-dl-overlay-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 999;
            background-color: rgba(0, 0, 0, 0.6);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 50px;
            padding: 6px 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 6px;
            backdrop-filter: blur(4px);
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        }
        .x-dl-overlay-btn:active {
            transform: scale(0.95);
            background-color: rgba(29, 155, 240, 0.9); /* Warna Biru Twitter saat dipencet */
        }
        .x-dl-icon {
            font-size: 16px;
            line-height: 1;
        }
        /* Animasi Loading */
        .x-dl-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid #fff;
            border-bottom-color: transparent;
            border-radius: 50%;
            display: inline-block;
            box-sizing: border-box;
            animation: rotation 1s linear infinite;
        }
        @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    GM_addStyle(css);

    // --- 2. Fungsi Utama: Mengambil URL Video ---
    function fetchAndDownload(tweetId, btnElement) {
        const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`;
        const originalText = btnElement.innerHTML;

        // Ubah tombol jadi loading
        btnElement.innerHTML = `<span class="x-dl-spinner"></span> Memproses...`;

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            onload: function(response) {
                try {
                    if (response.status !== 200) throw new Error("Gagal akses API");

                    const data = JSON.parse(response.responseText);
                    
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
