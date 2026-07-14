// ==UserScript==
// @name         Reddit NSFW & Age Gate Unblocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Membuka blokir konten NSFW dan modal login paksa di Reddit (Shreddit).
// @author       Kamu
// @match        https://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @run-at       document-end
// ==UserScript==

(function() {
    'use strict';

    // Panggil fungsi pertama kali saat halaman dimuat
    // Karena MutationObserver butuh elemen shreddit-app, kita tunggu sampai elemennya ada
    const targetNode = document.querySelector("shreddit-app");
    if (targetNode) {
        unblock();
        initObserver(targetNode);
    } else {
        // Jika shreddit-app belum dimuat, tunggu sebentar lalu coba lagi
        const checkExist = setInterval(function() {
            const shreddit = document.querySelector("shreddit-app");
            if (shreddit) {
                unblock();
                initObserver(shreddit);
                clearInterval(checkExist);
            }
        }, 100);
    }

    function initObserver(target) {
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.target.nodeName.toLowerCase() === "shreddit-app") {
                    unblock();
                }
            });
        });

        observer.observe(target, {
            childList: true,
        });
    }

    function unblock() {
        /**
         * Elemen blur ini ditambahkan secara dinamis saat navigasi.
         * Selalu cari dan hapus elemen ini.
         */
        document.querySelector("div[style*='blur(4px)']")?.remove();

        document.getElementById("nsfw-qr-dialog")?.remove();
        document.getElementById("blocking-modal")?.remove();
        document.getElementById("configured-xpromo-blocking_xpromo_nsfw_blocking")?.remove();
        document.getElementById("configured-xpromo-blocking_xpromo_nsfw_blocking_desktop")?.remove();
        document.getElementById("configured-xpromo-blocking_xpromo_nsfw_blocking_desktop_cms")?.remove();

        document.getElementById("nsfw-desktop-auth-blocking-modal-overlay-element")?.remove();
        document.getElementById("nsfw-desktop-auth-blocking-modal-dialog")?.remove();
        document.getElementById("nsfw-desktop-auth-blocking-modal")?.remove();

        setTimeout(() => {
            var blockingContainers = document.getElementsByTagName("xpromo-nsfw-blocking-container");
            for (var container of blockingContainers) {
                container?.shadowRoot?.children[1]?.remove();
            }
        }, 1);    
        
        document.body.style = "";
        document.body.classList.remove("rpl-scroll-lock");

        if (document.documentElement.getAttribute("device") === "mobile") {
            document.getElementById("configured-xpromo-unrated_block")?.remove();
        }
    }
})();
