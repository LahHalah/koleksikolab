
// ==UserScript==
// @name         Universal Custom Video Player Overlay
// @namespace    http://tampermonkey.net/universal-video-player
// @version      1.0.0
// @description  Optional universal custom video player with non-intrusive overlay trigger. Supports all sites with gesture controls, PiP, and advanced features.
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        // Visual settings
        overlayButtonSize: 32,
        overlayButtonOpacity: 0.7,
        overlayButtonHoverOpacity: 1,
        backdropColor: 'rgba(0, 0, 0, 0.95)',
        controlBarHeight: 60,
        hideControlsDelay: 3000,

        // Gesture settings
        swipeThreshold: 50,
        doubleTapDelay: 300,
        seekAmount: 10,
        volumeStep: 0.1,
        brightnessStep: 0.1,

        // Animation settings
        transitionDuration: 300,

        // Debug mode (set to true for console logs)
        debug: false
    };

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const state = {
        activePlayer: null,
        processedVideos: new WeakSet(),
        observers: [],
        isFullscreen: false,
        controlsVisible: true,
        hideControlsTimeout: null,
        currentBrightness: 1,
        gestureStart: null,
        lastTapTime: 0,
        lastTapX: 0
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const log = (...args) => CONFIG.debug && console.log('[UniversalVideoPlayer]', ...args);
    const error = (...args) => console.error('[UniversalVideoPlayer]', ...args);

    // Debounce function for performance
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function for scroll/resize events
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Format time (seconds to MM:SS or HH:MM:SS)
    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ============================================
    // CSS STYLES (Injected dynamically)
    // ============================================
    const STYLES = `
        /* Overlay Button Styles */
        .uvp-overlay-btn {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            width: ${CONFIG.overlayButtonSize}px !important;
            height: ${CONFIG.overlayButtonSize}px !important;
            background: rgba(0, 0, 0, 0.6) !important;
            border: 2px solid rgba(255, 255, 255, 0.8) !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s ease !important;
            pointer-events: auto !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }

        .uvp-overlay-btn:hover {
            opacity: 1 !important;
            background: rgba(0, 0, 0, 0.8) !important;
            transform: scale(1.1) !important;
        }

        .uvp-overlay-btn svg {
            width: 18px !important;
            height: 18px !important;
            fill: white !important;
            pointer-events: none !important;
        }

        /* Show button when parent is hovered (desktop) */
        @media (hover: hover) {
            video:hover ~ .uvp-overlay-btn,
            .uvp-overlay-btn:hover,
            video:hover + * + .uvp-overlay-btn,
            video:hover + .uvp-overlay-btn {
                opacity: ${CONFIG.overlayButtonOpacity};
            }
        }

        /* Always show on touch devices */
        @media (hover: none) {
            .uvp-overlay-btn {
                opacity: ${CONFIG.overlayButtonOpacity};
            }
        }

        /* Custom Player Container */
        .uvp-player-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: ${CONFIG.backdropColor} !important;
            z-index: 2147483647 !important;
            display: flex !important;
            flex-direction: column !important;
            opacity: 0;
            transition: opacity ${CONFIG.transitionDuration}ms ease !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
        }

        .uvp-player-container.active {
            opacity: 1;
        }

        /* Video Wrapper */
        .uvp-video-wrapper {
            flex: 1 !important;
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
        }

        .uvp-video-wrapper video {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
        }

        /* Brightness overlay */
        .uvp-brightness-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            background: black !important;
            opacity: 0 !important;
            transition: opacity 0.1s ease !important;
        }

        /* Loading Spinner */
        .uvp-loading {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 50px !important;
            height: 50px !important;
            border: 3px solid rgba(255,255,255,0.3) !important;
            border-top-color: #fff !important;
            border-radius: 50% !important;
            animation: uvp-spin 1s linear infinite !important;
            pointer-events: none !important;
        }

        @keyframes uvp-spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* Control Bar */
        .uvp-controls {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: linear-gradient(to top, rgba(0,0,0,0.9), transparent) !important;
            padding: 20px 16px 16px !important;
            transition: opacity 0.3s ease, transform 0.3s ease !important;
            opacity: 1;
            transform: translateY(0);
        }

        .uvp-controls.hidden {
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none !important;
        }

        /* Progress Bar Container */
        .uvp-progress-container {
            position: relative !important;
            height: 20px !important;
            margin-bottom: 10px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
        }

        .uvp-progress-bar {
            width: 100% !important;
            height: 4px !important;
            background: rgba(255,255,255,0.3) !important;
            border-radius: 2px !important;
            position: relative !important;
            overflow: hidden !important;
            transition: height 0.2s ease !important;
        }

        .uvp-progress-container:hover .uvp-progress-bar {
            height: 6px !important;
        }

        .uvp-progress-buffer {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            height: 100% !important;
            background: rgba(255,255,255,0.4) !important;
            width: 0% !important;
            transition: width 0.3s ease !important;
        }

        .uvp-progress-played {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            height: 100% !important;
            background: #ff6b6b !important;
            width: 0% !important;
            transition: width 0.1s linear !important;
        }

        .uvp-progress-handle {
            position: absolute !important;
            top: 50% !important;
            transform: translate(-50%, -50%) scale(0) !important;
            width: 12px !important;
            height: 12px !important;
            background: #fff !important;
            border-radius: 50% !important;
            left: 0% !important;
            transition: transform 0.2s ease !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }

        .uvp-progress-container:hover .uvp-progress-handle,
        .uvp-progress-container.dragging .uvp-progress-handle {
            transform: translate(-50%, -50%) scale(1) !important;
        }

        .uvp-time-tooltip {
            position: absolute !important;
            top: -30px !important;
            transform: translateX(-50%) !important;
            background: rgba(0,0,0,0.8) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            opacity: 0;
            transition: opacity 0.2s ease !important;
            pointer-events: none !important;
            white-space: nowrap !important;
        }

        .uvp-progress-container:hover .uvp-time-tooltip {
            opacity: 1;
        }

        /* Controls Row */
        .uvp-controls-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 12px !important;
        }

        .uvp-controls-left,
        .uvp-controls-right {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        /* Buttons */
        .uvp-btn {
            background: none !important;
            border: none !important;
            color: white !important;
            cursor: pointer !important;
            padding: 8px !important;
            border-radius: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.2s ease, transform 0.1s ease !important;
            min-width: 36px !important;
            height: 36px !important;
        }

        .uvp-btn:hover {
            background: rgba(255,255,255,0.2) !important;
        }

        .uvp-btn:active {
            transform: scale(0.95) !important;
        }

        .uvp-btn svg {
            width: 20px !important;
            height: 20px !important;
            fill: currentColor !important;
        }

        /* Time Display */
        .uvp-time {
            color: white !important;
            font-size: 13px !important;
            font-variant-numeric: tabular-nums !important;
            min-width: 100px !important;
            text-align: center !important;
        }

        /* Volume Container */
        .uvp-volume-container {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .uvp-volume-slider {
            width: 0 !important;
            height: 4px !important;
            background: rgba(255,255,255,0.3) !important;
            border-radius: 2px !important;
            position: relative !important;
            cursor: pointer !important;
            overflow: hidden !important;
            transition: width 0.3s ease !important;
        }

        .uvp-volume-container:hover .uvp-volume-slider,
        .uvp-volume-container.active .uvp-volume-slider {
            width: 80px !important;
        }

        .uvp-volume-level {
            height: 100% !important;
            background: white !important;
            width: 100% !important;
        }

        /* Speed Selector */
        .uvp-speed-btn {
            font-size: 12px !important;
            font-weight: 600 !important;
            min-width: 45px !important;
        }

        .uvp-speed-menu {
            position: absolute !important;
            bottom: 100% !important;
            right: 0 !important;
            background: rgba(0,0,0,0.9) !important;
            border-radius: 8px !important;
            padding: 8px 0 !important;
            margin-bottom: 8px !important;
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px) !important;
            transition: all 0.2s ease !important;
            min-width: 120px !important;
        }

        .uvp-speed-menu.active {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) !important;
        }

        .uvp-speed-option {
            padding: 8px 16px !important;
            color: white !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: background 0.2s ease !important;
        }

        .uvp-speed-option:hover {
            background: rgba(255,255,255,0.1) !important;
        }

        .uvp-speed-option.active {
            color: #ff6b6b !important;
        }

        /* Close Button (Top Right) */
        .uvp-close-btn {
            position: absolute !important;
            top: 16px !important;
            right: 16px !important;
            background: rgba(0,0,0,0.5) !important;
            border: none !important;
            color: white !important;
            width: 40px !important;
            height: 40px !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.2s ease, transform 0.2s ease !important;
            z-index: 10 !important;
        }

        .uvp-close-btn:hover {
            background: rgba(255,0,0,0.7) !important;
            transform: rotate(90deg) !important;
        }

        /* Gesture Indicators */
        .uvp-gesture-indicator {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0,0,0,0.7) !important;
            color: white !important;
            padding: 16px 24px !important;
            border-radius: 8px !important;
            font-size: 16px !important;
            pointer-events: none !important;
            opacity: 0;
            transition: opacity 0.3s ease !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            z-index: 100 !important;
        }

        .uvp-gesture-indicator.active {
            opacity: 1;
        }

        .uvp-gesture-indicator svg {
            width: 24px !important;
            height: 24px !important;
            fill: currentColor !important;
        }

        /* Center Play Button (for paused state) */
        .uvp-center-play {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) scale(0.8) !important;
            width: 80px !important;
            height: 80px !important;
            background: rgba(0,0,0,0.6) !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease !important;
            pointer-events: none !important;
        }

        .uvp-center-play.visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) !important;
            pointer-events: auto !important;
        }

        .uvp-center-play svg {
            width: 32px !important;
            height: 32px !important;
            fill: white !important;
            margin-left: 4px !important;
        }

        /* Double Tap Animation */
        .uvp-double-tap-hint {
            position: absolute !important;
            top: 50% !important;
            width: 60px !important;
            height: 60px !important;
            background: rgba(255,255,255,0.2) !important;
            border-radius: 50% !important;
            transform: translate(-50%, -50%) scale(0) !important;
            pointer-events: none !important;
        }

        .uvp-double-tap-hint.left { left: 25%; }
        .uvp-double-tap-hint.right { left: 75%; }

        .uvp-double-tap-hint.animate {
            animation: uvp-ripple 0.6s ease-out !important;
        }

        @keyframes uvp-ripple {
            to {
                transform: translate(-50%, -50%) scale(3) !important;
                opacity: 0;
            }
        }

        /* Quality Selector */
        .uvp-quality-menu {
            position: absolute !important;
            bottom: 100% !important;
            right: 0 !important;
            background: rgba(0,0,0,0.9) !important;
            border-radius: 8px !important;
            padding: 8px 0 !important;
            margin-bottom: 8px !important;
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px) !important;
            transition: all 0.2s ease !important;
            min-width: 150px !important;
            max-height: 200px !important;
            overflow-y: auto !important;
        }

        .uvp-quality-menu.active {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) !important;
        }

        .uvp-quality-option {
            padding: 8px 16px !important;
            color: white !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: background 0.2s ease !important;
        }

        .uvp-quality-option:hover {
            background: rgba(255,255,255,0.1) !important;
        }

        .uvp-quality-option.active {
            color: #ff6b6b !important;
        }
    `;

    // ============================================
    // SVG ICONS
    // ============================================
    const ICONS = {
        expand: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
        pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        volumeHigh: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
        volumeLow: `<svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
        volumeMute: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
        fullscreen: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        fullscreenExit: `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
        close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        pip: `<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L5.09 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
        forward: `<svg viewBox="0 0 24 24"><path d="M4 13c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8-8 3.6-8 8zm2 0c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6zm4.5-.5l3.15-2.15c.2-.15.2-.45 0-.6L10.5 7.6c-.25-.2-.6-.05-.6.25v4.3c0 .3.35.45.6.25z"/></svg>`,
        backward: `<svg viewBox="0 0 24 24"><path d="M20 13c0-4.4-3.6-8-8-8s-8 3.6-8 8 3.6 8 8 8 8-3.6 8-8zm-2 0c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6 6 2.7 6 6zm-4.5.5l-3.15 2.15c-.2.15-.2.45 0 .6l3.15 2.15c.25.2.6.05.6-.25v-4.3c0-.3-.35-.45-.6-.25z"/></svg>`,
        brightness: `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>`,
        volume: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`
    };

    // ============================================
    // STYLE INJECTION
    // ============================================
    function injectStyles() {
        if (document.getElementById('uvp-styles')) return;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'uvp-styles';
        styleSheet.textContent = STYLES;
        document.head.appendChild(styleSheet);
        log('Styles injected');
    }

    // ============================================
    // OVERLAY BUTTON CREATION
    // ============================================
    function createOverlayButton(video) {
        if (state.processedVideos.has(video)) return;

        // Skip if video is too small
        if (video.videoWidth < 100 || video.videoHeight < 100) return;

        // Find or create container
        let container = video.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const button = document.createElement('button');
        button.className = 'uvp-overlay-btn';
        button.innerHTML = ICONS.expand;
        button.title = 'Open in Custom Player';
        button.setAttribute('aria-label', 'Open in Custom Player');

        // Prevent event bubbling
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCustomPlayer(video);
        });

        // Insert button after video or append to container
        if (video.nextSibling) {
            container.insertBefore(button, video.nextSibling);
        } else {
            container.appendChild(button);
        }

        state.processedVideos.add(video);
        log('Overlay button added to video:', video);
    }

    // ============================================
    // VIDEO DETECTION
    // ============================================
    function scanVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (!state.processedVideos.has(video)) {
                // Wait for video to have dimensions
                if (video.readyState >= 1) {
                    createOverlayButton(video);
                } else {
                    video.addEventListener('loadedmetadata', () => createOverlayButton(video), { once: true });
                }
            }
        });
    }

    function initVideoDetection() {
        // Initial scan
        scanVideos();

        // MutationObserver for dynamic content
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'VIDEO' || (node.querySelectorAll && node.querySelectorAll('video').length > 0)) {
                        shouldScan = true;
                    }
                });
            });
            if (shouldScan) {
                debounce(scanVideos, 100)();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        state.observers.push(observer);
        log('Video detection initialized');
    }

    // ============================================
    // CUSTOM PLAYER
    // ============================================
    function openCustomPlayer(originalVideo) {
        if (state.activePlayer) {
            closeCustomPlayer();
        }

        // Check for CORS/DRM issues
        if (!canAccessVideo(originalVideo)) {
            showNotification('Cannot access this video (CORS/DRM protected)');
            return;
        }

        // Create container
        const container = document.createElement('div');
        container.className = 'uvp-player-container';

        // Create video wrapper
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'uvp-video-wrapper';

        // Clone video or create new one with same source
        const video = createVideoClone(originalVideo);

        // Brightness overlay
        const brightnessOverlay = document.createElement('div');
        brightnessOverlay.className = 'uvp-brightness-overlay';

        // Loading spinner
        const loading = document.createElement('div');
        loading.className = 'uvp-loading';

        // Center play button
        const centerPlay = document.createElement('div');
        centerPlay.className = 'uvp-center-play';
        centerPlay.innerHTML = ICONS.play;

        // Gesture indicators
        const gestureIndicator = document.createElement('div');
        gestureIndicator.className = 'uvp-gesture-indicator';

        // Double tap hints
        const doubleTapLeft = document.createElement('div');
        doubleTapLeft.className = 'uvp-double-tap-hint left';
        const doubleTapRight = document.createElement('div');
        doubleTapRight.className = 'uvp-double-tap-hint right';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'uvp-close-btn';
        closeBtn.innerHTML = ICONS.close;
        closeBtn.title = 'Close (Esc)';

        // Controls
        const controls = createControls(video);

        // Assemble
        videoWrapper.append(video, brightnessOverlay, loading, centerPlay, gestureIndicator, doubleTapLeft, doubleTapRight);
        container.append(videoWrapper, closeBtn, controls);
        document.body.appendChild(container);

        // Store reference
        state.activePlayer = {
            container,
            video,
            originalVideo,
            controls: controls.element,
            brightnessOverlay,
            gestureIndicator,
            centerPlay,
            loading
        };

        // Sync state with original video
        syncVideoState(video, originalVideo);

        // Initialize all event listeners
        initPlayerEvents(video, container, controls);
        initGestureControls(videoWrapper, video, gestureIndicator, doubleTapLeft, doubleTapRight);
        initKeyboardControls(video, container);

        // Show with animation
        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        log('Custom player opened');
    }

    function canAccessVideo(video) {
        try {
            // Try to access video data
            return video.videoWidth > 0 && video.videoHeight > 0;
        } catch (e) {
            return false;
        }
    }

    function createVideoClone(originalVideo) {
        const video = document.createElement('video');

        // Copy attributes
        video.src = originalVideo.currentSrc || originalVideo.src;
        video.poster = originalVideo.poster;
        video.crossOrigin = originalVideo.crossOrigin;
        video.preload = originalVideo.preload;

        // Copy source elements
        const sources = originalVideo.querySelectorAll('source');
        if (sources.length > 0 && !video.src) {
            sources.forEach(source => {
                const newSource = document.createElement('source');
                newSource.src = source.src;
                newSource.type = source.type;
                video.appendChild(newSource);
            });
        }

        // Set initial state
        video.currentTime = originalVideo.currentTime;
        video.volume = originalVideo.volume;
        video.muted = originalVideo.muted;
        video.playbackRate = originalVideo.playbackRate;

        if (!originalVideo.paused) {
            video.play().catch(() => {});
        }

        return video;
    }

    function syncVideoState(clone, original) {
        // Two-way sync
        const syncToOriginal = () => {
            original.currentTime = clone.currentTime;
            original.volume = clone.volume;
            original.muted = clone.muted;
            original.playbackRate = clone.playbackRate;
        };

        // Sync on close
        state.activePlayer.syncToOriginal = syncToOriginal;
    }

    function createControls(video) {
        const controls = document.createElement('div');
        controls.className = 'uvp-controls';

        // Progress bar
        const progressContainer = document.createElement('div');
        progressContainer.className = 'uvp-progress-container';
        progressContainer.innerHTML = `
            <div class="uvp-progress-bar">
                <div class="uvp-progress-buffer"></div>
                <div class="uvp-progress-played"></div>
                <div class="uvp-progress-handle"></div>
            </div>
            <div class="uvp-time-tooltip">0:00</div>
        `;

        // Controls row
        const controlsRow = document.createElement('div');
        controlsRow.className = 'uvp-controls-row';

        // Left controls
        const leftControls = document.createElement('div');
        leftControls.className = 'uvp-controls-left';

        const playBtn = createButton('play', ICONS.play, 'Play/Pause (Space)');
        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'uvp-time';
        timeDisplay.textContent = '0:00 / 0:00';

        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'uvp-volume-container';
        const volumeBtn = createButton('volume', ICONS.volumeHigh, 'Mute (M)');
        const volumeSlider = document.createElement('div');
        volumeSlider.className = 'uvp-volume-slider';
        volumeSlider.innerHTML = '<div class="uvp-volume-level" style="width: 100%"></div>';
        volumeContainer.append(volumeBtn, volumeSlider);

        leftControls.append(playBtn, timeDisplay, volumeContainer);

        // Right controls
        const rightControls = document.createElement('div');
        rightControls.className = 'uvp-controls-right';

        const speedBtn = createButton('speed', '1x', 'Playback Speed');
        speedBtn.classList.add('uvp-speed-btn');

        const speedMenu = document.createElement('div');
        speedMenu.className = 'uvp-speed-menu';
        [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(rate => {
            const option = document.createElement('div');
            option.className = 'uvp-speed-option' + (rate === 1 ? ' active' : '');
            option.textContent = rate + 'x';
            option.dataset.rate = rate;
            speedMenu.appendChild(option);
        });

        const pipBtn = createButton('pip', ICONS.pip, 'Picture in Picture');
        const fullscreenBtn = createButton('fullscreen', ICONS.fullscreen, 'Fullscreen (F)');

        rightControls.append(speedBtn, speedMenu, pipBtn, fullscreenBtn);

        controlsRow.append(leftControls, rightControls);
        controls.append(progressContainer, controlsRow);

        return {
            element: controls,
            playBtn,
            timeDisplay,
            volumeBtn,
            volumeSlider,
            volumeLevel: volumeSlider.querySelector('.uvp-volume-level'),
            speedBtn,
            speedMenu,
            pipBtn,
            fullscreenBtn,
            progressContainer,
            progressBar: progressContainer.querySelector('.uvp-progress-bar'),
            progressPlayed: progressContainer.querySelector('.uvp-progress-played'),
            progressBuffer: progressContainer.querySelector('.uvp-progress-buffer'),
            progressHandle: progressContainer.querySelector('.uvp-progress-handle'),
            timeTooltip: progressContainer.querySelector('.uvp-time-tooltip')
        };
    }

    function createButton(name, icon, title) {
        const btn = document.createElement('button');
        btn.className = 'uvp-btn';
        btn.innerHTML = icon;
        btn.title = title;
        btn.dataset.action = name;
        return btn;
    }

    // ============================================
    // PLAYER EVENTS
    // ============================================
    function initPlayerEvents(video, container, controls) {
        let isDragging = false;

        // Play/Pause
        controls.playBtn.addEventListener('click', () => togglePlay(video));
        video.addEventListener('click', () => togglePlay(video));
        state.activePlayer.centerPlay.addEventListener('click', () => togglePlay(video));

        // Play state updates
        video.addEventListener('play', () => {
            controls.playBtn.innerHTML = ICONS.pause;
            state.activePlayer.centerPlay.classList.remove('visible');
        });

        video.addEventListener('pause', () => {
            controls.playBtn.innerHTML = ICONS.play;
            state.activePlayer.centerPlay.classList.add('visible');
        });

        // Time update
        video.addEventListener('timeupdate', () => {
            updateProgress(video, controls);
            controls.timeDisplay.textContent = 
                `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
        });

        video.addEventListener('loadedmetadata', () => {
            controls.timeDisplay.textContent = 
                `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
        });

        // Progress bar interaction
        controls.progressContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            controls.progressContainer.classList.add('dragging');
            seekToPosition(video, controls, e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                seekToPosition(video, controls, e);
            }
            updateTimeTooltip(video, controls, e);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                controls.progressContainer.classList.remove('dragging');
            }
        });

        // Click on progress bar
        controls.progressContainer.addEventListener('click', (e) => {
            seekToPosition(video, controls, e);
        });

        // Volume
        controls.volumeBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            updateVolumeIcon(controls.volumeBtn, video);
        });

        controls.volumeSlider.addEventListener('click', (e) => {
            const rect = controls.volumeSlider.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.volume = Math.max(0, Math.min(1, percent));
            video.muted = false;
            controls.volumeLevel.style.width = (video.volume * 100) + '%';
            updateVolumeIcon(controls.volumeBtn, video);
        });

        // Speed selector
        controls.speedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            controls.speedMenu.classList.toggle('active');
        });

        controls.speedMenu.querySelectorAll('.uvp-speed-option').forEach(option => {
            option.addEventListener('click', () => {
                const rate = parseFloat(option.dataset.rate);
                video.playbackRate = rate;
                controls.speedBtn.textContent = rate + 'x';
                controls.speedMenu.querySelectorAll('.uvp-speed-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                controls.speedMenu.classList.remove('active');
            });
        });

        // PiP
        controls.pipBtn.addEventListener('click', async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await video.requestPictureInPicture();
                }
            } catch (err) {
                log('PiP error:', err);
            }
        });

        // Fullscreen
        controls.fullscreenBtn.addEventListener('click', () => toggleFullscreen(container, controls.fullscreenBtn));

        // Close button
        container.querySelector('.uvp-close-btn').addEventListener('click', closeCustomPlayer);

        // Auto-hide controls
        let hideTimeout;
        const showControls = () => {
            controls.element.classList.remove('hidden');
            clearTimeout(hideTimeout);
            if (!video.paused) {
                hideTimeout = setTimeout(() => {
                    controls.element.classList.add('hidden');
                }, CONFIG.hideControlsDelay);
            }
        };

        container.addEventListener('mousemove', showControls);
        container.addEventListener('click', showControls);
        video.addEventListener('play', showControls);
        video.addEventListener('pause', () => {
            controls.element.classList.remove('hidden');
            clearTimeout(hideTimeout);
        });

        // Loading state
        video.addEventListener('waiting', () => {
            state.activePlayer.loading.style.display = 'block';
        });
        video.addEventListener('playing', () => {
            state.activePlayer.loading.style.display = 'none';
        });
        video.addEventListener('canplay', () => {
            state.activePlayer.loading.style.display = 'none';
        });

        // Click outside menus to close
        document.addEventListener('click', (e) => {
            if (!controls.speedBtn.contains(e.target) && !controls.speedMenu.contains(e.target)) {
                controls.speedMenu.classList.remove('active');
            }
        });

        // Buffer progress
        video.addEventListener('progress', () => {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const duration = video.duration;
                if (duration > 0) {
                    controls.progressBuffer.style.width = (bufferedEnd / duration * 100) + '%';
                }
            }
        });
    }

    function togglePlay(video) {
        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }

    function updateProgress(video, controls) {
        const percent = (video.currentTime / video.duration) * 100;
        controls.progressPlayed.style.width = percent + '%';
        controls.progressHandle.style.left = percent + '%';
    }

    function seekToPosition(video, controls, e) {
        const rect = controls.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.currentTime = percent * video.duration;
    }

    function updateTimeTooltip(video, controls, e) {
        const rect = controls.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * video.duration;
        controls.timeTooltip.textContent = formatTime(time);
        controls.timeTooltip.style.left = (percent * 100) + '%';
    }

    function updateVolumeIcon(btn, video) {
        if (video.muted || video.volume === 0) {
            btn.innerHTML = ICONS.volumeMute;
        } else if (video.volume < 0.5) {
            btn.innerHTML = ICONS.volumeLow;
        } else {
            btn.innerHTML = ICONS.volumeHigh;
        }
    }

    function toggleFullscreen(container, btn) {
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    // ============================================
    // GESTURE CONTROLS (Mobile)
    // ============================================
    function initGestureControls(wrapper, video, indicator, tapLeft, tapRight) {
        let touchStart = null;
        let touchStartTime = 0;
        let isSeeking = false;
        let isChangingVolume = false;
        let isChangingBrightness = false;
        let startVolume = 0;
        let startBrightness = 1;
        let startTime = 0;

        wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            touchStart = { x: touch.clientX, y: touch.clientY };
            touchStartTime = Date.now();
            startVolume = video.volume;
            startBrightness = state.currentBrightness;
            startTime = video.currentTime;

            // Check for double tap
            const now = Date.now();
            const timeDiff = now - state.lastTapTime;
            const xDiff = Math.abs(touch.clientX - state.lastTapX);

            if (timeDiff < CONFIG.doubleTapDelay && xDiff < 50) {
                // Double tap detected
                e.preventDefault();
                const screenWidth = window.innerWidth;
                if (touch.clientX < screenWidth / 2) {
                    // Left side - seek backward
                    video.currentTime = Math.max(0, video.currentTime - CONFIG.seekAmount);
                    showGestureIndicator(indicator, ICONS.backward, `-${CONFIG.seekAmount}s`);
                    animateDoubleTap(tapLeft);
                } else {
                    // Right side - seek forward
                    video.currentTime = Math.min(video.duration, video.currentTime + CONFIG.seekAmount);
                    showGestureIndicator(indicator, ICONS.forward, `+${CONFIG.seekAmount}s`);
                    animateDoubleTap(tapRight);
                }
                state.lastTapTime = 0;
                return;
            }

            state.lastTapTime = now;
            state.lastTapX = touch.clientX;
        }, { passive: false });

        wrapper.addEventListener('touchmove', (e) => {
            if (!touchStart || e.touches.length !== 1) return;

            const touch = e.touches[0];
            const dx = touch.clientX - touchStart.x;
            const dy = touchStart.y - touch.clientY; // Inverted for natural feel
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Determine gesture type
            if (!isSeeking && !isChangingVolume && !isChangingBrightness) {
                if (absDx > absDy && absDx > 10) {
                    isSeeking = true;
                } else if (absDy > absDx && absDy > 10) {
                    if (touchStart.x > window.innerWidth / 2) {
                        isChangingVolume = true;
                    } else {
                        isChangingBrightness = true;
                    }
                }
            }

            if (isSeeking) {
                e.preventDefault();
                const seekPercent = dx / window.innerWidth;
                const seekTime = seekPercent * video.duration * 2; // 2x sensitivity
                const newTime = Math.max(0, Math.min(video.duration, startTime + seekTime));
                video.currentTime = newTime;
                const direction = dx > 0 ? '+' : '';
                showGestureIndicator(indicator, dx > 0 ? ICONS.forward : ICONS.backward, 
                    `${direction}${Math.round(seekTime)}s`);
            } else if (isChangingVolume) {
                e.preventDefault();
                const volumeChange = (dy / window.innerHeight) * 2;
                const newVolume = Math.max(0, Math.min(1, startVolume + volumeChange));
                video.volume = newVolume;
                video.muted = false;
                showGestureIndicator(indicator, ICONS.volume, `${Math.round(newVolume * 100)}%`);
            } else if (isChangingBrightness) {
                e.preventDefault();
                const brightnessChange = (dy / window.innerHeight) * 2;
                state.currentBrightness = Math.max(0.1, Math.min(2, startBrightness + brightnessChange));
                state.activePlayer.brightnessOverlay.style.opacity = 1 - state.currentBrightness;
                showGestureIndicator(indicator, ICONS.brightness, `${Math.round(state.currentBrightness * 100)}%`);
            }
        }, { passive: false });

        wrapper.addEventListener('touchend', () => {
            touchStart = null;
            isSeeking = false;
            isChangingVolume = false;
            isChangingBrightness = false;
            setTimeout(() => {
                indicator.classList.remove('active');
            }, 500);
        });
    }

    function showGestureIndicator(indicator, icon, text) {
        indicator.innerHTML = `${icon}<span>${text}</span>`;
        indicator.classList.add('active');
    }

    function animateDoubleTap(element) {
        element.classList.remove('animate');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('animate');
    }

    // ============================================
    // KEYBOARD CONTROLS
    // ============================================
    function initKeyboardControls(video, container) {
        const keyHandler = (e) => {
            if (!state.activePlayer) return;

            // Don't capture if typing in an input
            if (e.target.matches('input, textarea, [contenteditable]')) return;

            switch(e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay(video);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration, video.currentTime + 5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen(container, state.activePlayer.controls.fullscreenBtn);
                    break;
                case 'm':
                    e.preventDefault();
                    video.muted = !video.muted;
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeCustomPlayer();
                    break;
                case 'j':
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    break;
                case 'l':
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    break;
            }
        };

        document.addEventListener('keydown', keyHandler);
        state.activePlayer.keyHandler = keyHandler;
    }

    // ============================================
    // CLOSE PLAYER
    // ============================================
    function closeCustomPlayer() {
        if (!state.activePlayer) return;

        const { container, video, originalVideo, syncToOriginal, keyHandler } = state.activePlayer;

        // Sync state back to original
        if (syncToOriginal) syncToOriginal();

        // Remove keyboard handler
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
        }

        // Animate out
        container.classList.remove('active');

        setTimeout(() => {
            // Pause video
            video.pause();

            // Remove from DOM
            container.remove();

            // Clear state
            state.activePlayer = null;

            // Restore body scroll
            document.body.style.overflow = '';

            log('Custom player closed');
        }, CONFIG.transitionDuration);
    }

    function showNotification(message) {
        // Simple notification
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0,0,0,0.8) !important;
            color: white !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            z-index: 2147483647 !important;
            font-family: sans-serif !important;
            font-size: 14px !important;
            pointer-events: none !important;
            animation: uvp-fadein 0.3s ease !important;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'uvp-fadeout 0.3s ease !important';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        // Check if already initialized
        if (window.universalVideoPlayerInitialized) return;
        window.universalVideoPlayerInitialized = true;

        // Inject styles
        injectStyles();

        // Start video detection
        initVideoDetection();

        log('Universal Video Player initialized');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
