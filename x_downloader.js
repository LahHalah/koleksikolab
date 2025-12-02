// ==UserScript==
// @name         X Video Downloader v7 - Protected Account Fix
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Download video X/Twitter (Support Akun Terkunci/Protected) via React Props
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
        .xvd-fab:active { transform: scale(0.93); }

        /* Video Overlay Button */
        .xvd-vbtn {
            position: absolute;
            bottom: 50px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.6);
            color: white;
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: 50%;
            width: 45px;
            height: 45px;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(4px);
        }

        /* Modal Backdrop */
        .xvd-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.85);
            z-index: 2147483646;
            display: none;
            padding: 20px;
            box-sizing: border-box;
            align-items: center;
            justify-content: center;
        }
        .xvd-backdrop.show { display: flex; }

        /* Modal Box */
        .xvd-box {
            background: #000;
            border: 1px solid #333;
            border-radius: 16px;
            width: 100%;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        }

        /* Header */
        .xvd-head {
            background: #16181c;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
        }
        .xvd-close {
            background: none; border: none; color: #fff; font-size: 20px; padding: 5px;
        }

        /* Content */
        .xvd-body { padding: 15px; color: #fff; }

        .xvd-btn-main {
            display: block;
            width: 100%;
            background: #00ba7c;
            color: white;
            text-align: center;
            padding: 15px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            margin: 10px 0;
            border: none;
        }
        
        .xvd-btn-sec {
            background: #1d9bf0;
            margin-top: 10px;
        }

        .xvd-vid-preview {
            width: 100%;
            border-radius: 10px;
            background: #111;
            margin-bottom: 15px;
            max-height: 250px;
        }

        .xvd-meta {
            font-size: 12px;
            color: #8899a6;
            margin-bottom: 5px;
            font-family: monospace;
        }

        .xvd-badge {
            background: #f91880;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            margin-right: 5px;
        }
        .xvd-badge.safe { background: #00ba7c; }

        /* Spinner */
        .xvd-spin {
            border: 4px solid #333;
            border-top: 4px solid #1d9bf0;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `);

    // ========== UTILS ==========
    function toast(msg) {
        alert(msg); // Simple alert for mobile reliability
    }

    // ========== REACT PROPS EXTRACTOR (THE FIX) ==========
    // Ini adalah fungsi kunci untuk menembus akun protected
    function getReactProps(el) {
        const keys = Object.keys(el);
        const reactKey = keys.find(key => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'));
        return reactKey ? el[reactKey] : null;
    }

    function findVideoUrlFromReact(domNode) {
        try {
            let fiber = getReactProps(domNode);
            if (!fiber) return null;

            // Traverse up to find the player state
            let attempts = 0;
            while (fiber && attempts < 25) {
                const memoized = fiber.memoizedProps;
                
                // Cek PlayerState
                if (memoized && memoized.mediaState && memoized.mediaState.variants) {
                    return getBestVariant(memoized.mediaState.variants);
                }
                
                // Cek Legacy Player
                if (memoized && memoized.playerState && memoized.playerState.variants) {
                    return getBestVariant(memoized.playerState.variants);
                }

                fiber = fiber.return;
                attempts++;
            }
        } catch (e) {
            console.error('XVD React Error:', e);
        }
        return null;
    }

    function getBestVariant(variants) {
        if (!variants || !variants.length) return null;
        
        // Filter hanya MP4
        const mp4s = variants.filter(v => v.content_type === 'video/mp4');
        if (mp4s.length === 0) return null;

        // Sort berdasarkan bitrate tertinggi
        mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        
        return mp4s[0].url; // Return URL MP4 terbaik
    }

    // ========== MAIN LOGIC ==========
    async function processVideo(startElement) {
        openModal();
        setLoading(true);

        let videoUrl = null;
        let method = '';

        // CARA 1: REACT PROPS (Paling ampuh untuk akun Protected)
        console.log('🔍 Mencoba Extract React Props...');
        const playerElement = startElement.closest('[data-testid="videoComponent"]') || 
                              startElement.closest('[data-testid="videoPlayer"]');
        
        if (playerElement) {
            videoUrl = findVideoUrlFromReact(playerElement);
            if (videoUrl) method = 'REACT_PROPS (Protected Supported)';
        }

        // CARA 2: API (Fallback untuk publik)
        if (!videoUrl) {
            console.log('🔍 Mencoba API...');
            const tweetUrl = findTweetUrl(startElement);
            if (tweetUrl) {
                try {
                    videoUrl = await fetchVideoAPI(tweetUrl);
                    method = 'PUBLIC_API';
                } catch (e) {
                    console.log('API gagal:', e);
                }
            }
        }

        setLoading(false);

        if (videoUrl) {
            showResult(videoUrl, method);
        } else {
            showError('Gagal mengambil video. Pastikan video sudah diputar sebentar.');
        }
    }

    function fetchVideoAPI(url) {
        return new Promise((resolve, reject) => {
            const id = url.match(/status\/(\d+)/)?.[1];
            if (!id) return reject();
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.vxtwitter.com/Twitter/status/${id}`,
                onload: (r) => {
                    const d = JSON.parse(r.responseText);
                    const vid = d.media_extended?.find(m => m.type === 'video' || m.type === 'gif');
                    if (vid) resolve(vid.url);
                    else reject();
                },
                onerror: reject
            });
        });
    }

    function findTweetUrl(el) {
        const article = el.closest('article');
        const link = article?.querySelector('a[href*="/status/"]');
        return link ? link.href : window.location.href;
    }

    // ========== UI HANDLERS ==========
    let backdrop;
    
    function openModal() {
        if (!backdrop) createModal();
        backdrop.classList.add('show');
    }

    function createModal() {
        backdrop = document.createElement('div');
        backdrop.className = 'xvd-backdrop';
        backdrop.innerHTML = `
            <div class="xvd-box">
                <div class="xvd-head">
                    <span style="color:white;font-weight:bold">Download Video</span>
                    <button class="xvd-close">✕</button>
                </div>
                <div class="xvd-body" id="xvd-content"></div>
            </div>
        `;
        backdrop.querySelector('.xvd-close').onclick = () => backdrop.classList.remove('show');
        document.body.appendChild(backdrop);
    }

    function setLoading(isLoading) {
        const content = document.getElementById('xvd-content');
        if (isLoading) {
            content.innerHTML = `<div class="xvd-spin"></div><div style="text-align:center">Sedang mengekstrak video...</div>`;
        }
    }

    function showResult(url, method) {
        const content = document.getElementById('xvd-content');
        const filename = `twitter_vid_${Date.now()}.mp4`;
        
        content.innerHTML = `
            <div class="xvd-meta">
                <span class="xvd-badge safe">SUCCESS</span> ${method}
            </div>
            
            <video class="xvd-vid-preview" src="${url}" controls></video>
            
            <div style="background:#222; padding:10px; border-radius:8px; margin-bottom:10px; font-size:12px;">
                💡 <b>Tips Firefox Android:</b><br>
                Jika tombol hijau tidak merespon, gunakan tombol <b>"Buka Tab Baru"</b>, lalu tekan lama video di tab baru tersebut & pilih "Save Video".
            </div>

            <a href="${url}" download="${filename}" class="xvd-btn-main" target="_blank">
                ⬇️ DOWNLOAD VIDEO
            </a>
            
            <button id="xvd-newtab" class="xvd-btn-main xvd-btn-sec">
                ↗️ BUKA DI TAB BARU
            </button>

            <div style="margin-top:15px; font-size:10px; color:#555; word-break:break-all;">
                Source: ${url.substring(0, 50)}...
            </div>
        `;

        document.getElementById('xvd-newtab').onclick = () => {
            window.open(url, '_blank');
        };
    }

    function showError(msg) {
        document.getElementById('xvd-content').innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <div style="font-size:40px">😕</div>
                <p>${msg}</p>
                <button class="xvd-btn-main xvd-btn-sec" onclick="document.querySelector('.xvd-backdrop').classList.remove('show')">Tutup</button>
            </div>
        `;
    }

    // ========== INITIALIZATION ==========
    function init() {
        // FAB Button
        if (!document.querySelector('.xvd-fab')) {
            const fab = document.createElement('button');
            fab.className = 'xvd-fab';
            fab.innerHTML = '⬇️';
            fab.onclick = () => {
                const videos = document.querySelectorAll('video');
                // Cari video yang paling terlihat di layar
                let target = videos[0];
                for(let v of videos) {
                    const rect = v.getBoundingClientRect();
                    if(rect.top > 0 && rect.top < window.innerHeight/2) {
                        target = v;
                        break;
                    }
                }
                if (target) processVideo(target);
                else toast('Tidak ada video terlihat di layar');
            };
            document.body.appendChild(fab);
        }

        // Tombol Kecil di setiap video
        setInterval(() => {
            document.querySelectorAll('video').forEach(vid => {
                const parent = vid.parentElement;
                if (!parent || parent.querySelector('.xvd-vbtn')) return;
                
                // Pastikan parent relative
                if (getComputedStyle(parent).position === 'static') {
                    parent.style.position = 'relative';
                }

                const btn = document.createElement('div');
                btn.className = 'xvd-vbtn';
                btn.innerHTML = '⬇️';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    processVideo(vid);
                };
                parent.appendChild(btn);
            });
        }, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
