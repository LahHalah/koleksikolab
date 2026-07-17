// ==UserScript==
// @name         YouTube Background Play Fix
// @namespace    https://greasyfork.org
// @version      1.0
// @description  Play YouTube video di background (minimized tab / switch tab)
// @author       Grok + Community
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Override Page Visibility API
    Object.defineProperties(document, {
        hidden: { value: false },
        visibilityState: { value: 'visible' }
    });

    // Block visibilitychange event
    window.addEventListener('visibilitychange', e => {
        e.stopImmediatePropagation();
    }, true);

    // Keep _lact (YouTube's activity tracker) updated
    const lactInterval = 5 * 60 * 1000; // 5 menit
    function updateLact() {
        if (window._lact !== undefined) {
            window._lact = Date.now();
        }
    }
    setInterval(updateLact, lactInterval);

    // Auto resume jika pause
    setInterval(() => {
        const video = document.querySelector('video');
        if (video && video.paused && !video.ended) {
            video.play().catch(() => {});
        }
    }, 2000);

})();
