// ==UserScript==
// @name         X Video Downloader v8 - Anti-Stuck & Protected Fix
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Download video X/Twitter (Support Akun Terkunci) - Metode Deep React Search
// @author       Assistant
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.x.com/*
// @match        https://mobile.twitter.com/*
// @icon         https://abs.twimg.com/favicons/twitter.ico
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .xvd-fab {
            position: fixed; bottom: 90px; right: 20px; z-index: 99999;
            background: #1d9bf0; color: white; width: 60px; height: 60px;
            border-radius: 50%; border: none; font-size: 28px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }
        .xvd-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9); z-index: 100000;
            display: flex; align-items: center; justify-content: center;
            flex-direction: column; color: white;
        }
        .xvd-box {
            background: #000; padding: 20px; border-radius: 15px;
            border: 1px solid #333; width: 90%; max-width: 400px;
            text-align: center;
        }
        .xvd-btn {
            display: block; width: 100%; padding: 15px; margin: 10px 0;
            border-radius: 30px; font-weight: bold; text-decoration: none;
            border: none; cursor: pointer; font-size: 16px;
        }
        .xvd-btn-down { background: #00ba7c; color: white; }
        .xvd-btn-tab { background: #1d9bf0; color: white; }
        .xvd-btn-close { background: #333; color: #ddd; margin-top: 20px; }
        .xvd-loader {
            border: 4px solid #333; border-top: 4px solid #fff;
            border-radius: 50%; width: 40px; height: 40px;
            animation: spin 0.8s linear infinite; margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .xvd-log { font-size: 12px; color: #777; margin-top: 10px; font-family: monospace; }
    `);

    // =========================================================================
    // 🧠 CORE: REACT DEEP SEARCH (ALGORITMA PENCARI VIDEO)
    // =========================================================================

    function getReactFiber(el) {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        return key ? el[key] : null;
    }

    // Fungsi rekursif untuk mencari objek "variants" (daftar video) di dalam tumpukan data React
    function searchForVariants(obj, depth = 0, maxDepth = 8) {
        if (!obj || depth > maxDepth) return null;
        if (typeof obj !== 'object') return null;

        // Cek apakah ini objek varian video
        if (Array.isArray(obj) && obj.length > 0) {
            if (obj[0].content_type === 'video/mp4' || (obj[0].url && obj[0].bitrate !== undefined)) {
                return obj;
            }
        }

        // Cek properti umum tempat video bersembunyi
        const targets = ['variants', 'video_info', 'mediaDetails', 'media', 'extended_entities'];
        for (const t of targets) {
            if (obj[t]) {
                const found = searchForVariants(obj[t], depth + 1, maxDepth);
                if (found) return found;
            }
        }

        // Jika tidak ketemu, coba cari di children tertentu (tapi batasi agar tidak hang)
        if (obj.props && obj.props.children) {
             // Hindari traverse terlalu dalam ke children UI, kita cari data props saja
        }

        return null;
    }

    // Fungsi utama ekstraktor
    async function extractVideoData(startElement) {
        let fiber = getReactFiber(startElement);
        if (!fiber) return null;

        let attempts = 0;
        // Naik ke atas (traverse up) untuk mencari komponen induk (Tweet/Article) yang memegang data
        while (fiber && attempts < 15) {
            const memoized = fiber.memoizedProps;
            const state = fiber.memoizedState;

            // 1. Cek di Props langsung
            let variants = searchForVariants(memoized);
            if (variants) return variants;

            // 2. Cek di State
            variants = searchForVariants(state);
            if (variants) return variants;

            // 3. Cek Legacy Tweet Data (biasanya ada di properti 'tweet')
            if (memoized && memoized.tweet) {
                variants = searchForVariants(memoized.tweet);
                if (variants) return variants;
            }

            fiber = fiber.return;
            attempts++;
        }
        return null;
    }

    function getBestQuality(variants) {
        if (!variants) return null;
        // Filter hanya MP4, lalu urutkan bitrate terbesar
        const mp4s = variants.filter(v => v.content_type === 'video/mp4');
        if (!mp4s.length) return null;
        mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        return mp4s[0].url;
    }

    // =========================================================================
    // 🎨 UI & HANDLERS
    // =========================================================================

    function showOverlay(msg = '') {
        removeOverlay();
        const div = document.createElement('div');
        div.className = 'xvd-overlay';
        div.innerHTML = `
            <div class="xvd-box">
                <div id="xvd-status">
                    <div class="xvd-loader"></div>
                    <p>${msg || 'Sedang mencari sumber video...'}</p>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        return div;
    }

    function removeOverlay() {
        const el = document.querySelector('.xvd-overlay');
        if (el) el.remove();
    }

    function showSuccess(url) {
        const box = document.querySelector('.xvd-box');
        if (!box) return;

        const filename = `twitter_${Date.now()}.mp4`;

        box.innerHTML = `
            <h2 style="margin:0 0 15px 0">Video Ditemukan! ✅</h2>
            <video src="${url}" style="width:100%; max-height:200px; border-radius:10px; background:#222; margin-bottom:15px" controls></video>
            
            <a href="${url}" download="${filename}" class="xvd-btn xvd-btn-down">⬇️ DOWNLOAD VIDEO</a>
            <button id="xvd-newtab" class="xvd-btn xvd-btn-tab">↗️ BUKA DI TAB BARU</button>
            <button class="xvd-btn xvd-btn-close">Tutup</button>
            
            <div class="xvd-log">Untuk akun terkunci: Gunakan "Buka di Tab Baru" lalu tekan tahan video -> Save Video</div>
        `;

        document.getElementById('xvd-newtab').onclick = () => window.open(url, '_blank');
        box.querySelector('.xvd-btn-close').onclick = removeOverlay;
    }

    function showFail(msg) {
        const box = document.querySelector('.xvd-box');
        if (!box) return;
        box.innerHTML = `
            <h2 style="color:#ef4444">Gagal ❌</h2>
            <p>${msg}</p>
            <button class="xvd-btn xvd-btn-close">Tutup</button>
        `;
        box.querySelector('.xvd-btn-close').onclick = removeOverlay;
    }

    // =========================================================================
    // 🚀 EXECUTOR
    // =========================================================================

    async function startProcess(element) {
        showOverlay('Menganalisis data video (Metode Deep Search)...');
        
        // Timeout Safety: Paksa berhenti jika > 5 detik
        const timeout = setTimeout(() => {
            showFail('Waktu habis! <br>Twitter mungkin mengubah strukturnya atau koneksi lambat.<br><br>Coba refresh halaman.');
        }, 5000);

        try {
            // 1. Cari varian
            const variants = await extractVideoData(element);
            
            clearTimeout(timeout); // Batalkan timeout jika selesai

            // 2. Proses hasil
            if (variants) {
                const bestUrl = getBestQuality(variants);
                if (bestUrl) {
                    showSuccess(bestUrl);
                } else {
                    showFail('URL Video MP4 tidak ditemukan dalam data.');
                }
            } else {
                showFail('Gagal mengekstrak data tweet.<br>Pastikan video sudah dimuat di layar.');
            }

        } catch (e) {
            clearTimeout(timeout);
            console.error(e);
            showFail('Error Script: ' + e.message);
        }
    }

    // =========================================================================
    // 🛠️ INIT
    // =========================================================================

    function createFAB() {
        if (document.querySelector('.xvd-fab')) return;
        const fab = document.createElement('button');
        fab.className = 'xvd-fab';
        fab.innerHTML = '⚡';
        fab.onclick = () => {
            // Cari video yang paling kelihatan di layar (viewport)
            const videos = Array.from(document.querySelectorAll('video'));
            const target = videos.find(v => {
                const r = v.getBoundingClientRect();
                return r.top >= 0 && r.top < window.innerHeight;
            }) || videos[0];

            if (target) {
                startProcess(target);
            } else {
                alert('Tidak ada video yang terlihat di layar!');
            }
        };
        document.body.appendChild(fab);
    }

    // Jalankan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFAB);
    } else {
        createFAB();
    }
    
    // Backup interval kalau-kalau navigasi SPA menghapus tombol
    setInterval(createFAB, 2000);

})();
