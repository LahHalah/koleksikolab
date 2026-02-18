// ==UserScript==
// @name         Universal Custom Video Player
// @namespace    https://github.com/universal-custom-player
// @version      2.0.0
// @description  Optional custom video player overlay for all websites
// @author       Universal Player
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // CONSTANTS & CONFIG
  // ============================================================
  const CONFIG = {
    BUTTON_SIZE: 28,
    SEEK_SECONDS: 10,
    VOLUME_STEP: 0.1,
    SPEEDS: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    AUTO_HIDE_DELAY: 3000,
    Z_INDEX: 2147483640,
  };

  // ============================================================
  // CSS STYLES
  // ============================================================
  const STYLES = `
    .ucvp-trigger-wrap {
      position: absolute;
      bottom: 8px;
      right: 8px;
      z-index: ${CONFIG.Z_INDEX - 1};
      pointer-events: none;
    }
    .ucvp-trigger-btn {
      pointer-events: all;
      width: ${CONFIG.BUTTON_SIZE}px;
      height: ${CONFIG.BUTTON_SIZE}px;
      background: rgba(0,0,0,0.55);
      border: 1.5px solid rgba(255,255,255,0.7);
      border-radius: 5px;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s, transform 0.15s;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      line-height: 1;
      padding: 0;
      outline: none;
      user-select: none;
    }
    .ucvp-trigger-btn:hover {
      transform: scale(1.12);
      background: rgba(30,30,30,0.85);
    }
    .ucvp-video-wrap:hover .ucvp-trigger-btn,
    .ucvp-mobile .ucvp-trigger-btn {
      opacity: 1;
    }
    /* ---- OVERLAY PLAYER ---- */
    .ucvp-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: ${CONFIG.Z_INDEX};
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ucvp-fadein 0.18s ease;
    }
    @keyframes ucvp-fadein { from { opacity:0 } to { opacity:1 } }
    .ucvp-video-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .ucvp-video-el {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      background: #000;
      display: block;
    }
    /* Controls */
    .ucvp-controls-wrap {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.82));
      padding: 20px 14px 10px;
      transition: opacity 0.28s;
      will-change: opacity;
    }
    .ucvp-controls-wrap.hidden { opacity: 0; pointer-events: none; }
    .ucvp-seekbar-wrap {
      position: relative;
      height: 18px;
      display: flex;
      align-items: center;
      cursor: pointer;
      margin-bottom: 6px;
    }
    .ucvp-seekbar-track {
      position: absolute;
      left: 0; right: 0;
      height: 4px;
      border-radius: 2px;
      background: rgba(255,255,255,0.25);
      overflow: hidden;
      pointer-events: none;
    }
    .ucvp-seekbar-buffer {
      position: absolute;
      left: 0; top: 0; height: 100%;
      background: rgba(255,255,255,0.35);
      transition: width 0.3s linear;
    }
    .ucvp-seekbar-progress {
      position: absolute;
      left: 0; top: 0; height: 100%;
      background: #e53935;
      transition: width 0.1s linear;
    }
    .ucvp-seekbar-thumb {
      position: absolute;
      width: 13px; height: 13px;
      border-radius: 50%;
      background: #fff;
      top: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      pointer-events: none;
      transition: left 0.1s linear;
    }
    .ucvp-seekbar-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      margin: 0;
    }
    .ucvp-btn-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ucvp-btn {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 5px 7px;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      user-select: none;
      flex-shrink: 0;
    }
    .ucvp-btn:hover { background: rgba(255,255,255,0.15); }
    .ucvp-time {
      color: #fff;
      font-size: 12px;
      font-family: monospace;
      padding: 0 6px;
      white-space: nowrap;
      opacity: 0.9;
    }
    .ucvp-spacer { flex: 1; }
    .ucvp-volume-wrap {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .ucvp-vol-slider {
      width: 72px;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      border-radius: 2px;
      background: rgba(255,255,255,0.3);
      outline: none;
      cursor: pointer;
      accent-color: #fff;
    }
    .ucvp-vol-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
    }
    .ucvp-select {
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      font-size: 11px;
      padding: 2px 4px;
      cursor: pointer;
      outline: none;
      max-width: 70px;
    }
    /* Close btn */
    .ucvp-close-btn {
      position: absolute;
      top: 12px;
      right: 14px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      width: 34px;
      height: 34px;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: background 0.15s, opacity 0.28s;
      outline: none;
    }
    .ucvp-close-btn:hover { background: rgba(180,0,0,0.8); }
    .ucvp-close-btn.hidden { opacity: 0; pointer-events: none; }
    /* Spinner */
    .ucvp-spinner {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: ucvp-spin 0.7s linear infinite;
      display: none;
      pointer-events: none;
    }
    .ucvp-spinner.visible { display: block; }
    @keyframes ucvp-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
    /* Brightness overlay */
    .ucvp-brightness-overlay {
      position: absolute;
      inset: 0;
      background: transparent;
      pointer-events: none;
      z-index: 2;
    }
    /* Gesture feedback */
    .ucvp-gesture-toast {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.65);
      color: #fff;
      font-size: 22px;
      font-family: sans-serif;
      font-weight: bold;
      padding: 12px 22px;
      border-radius: 10px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s;
      z-index: 20;
      text-align: center;
      white-space: nowrap;
    }
    .ucvp-gesture-toast.show { opacity: 1; }
    @media (max-width: 600px) {
      .ucvp-vol-slider { width: 54px; }
      .ucvp-select { max-width: 56px; }
    }
  `;

  // ============================================================
  // HELPERS
  // ============================================================
  function injectCSS() {
    if (document.getElementById('ucvp-styles')) return;
    const s = document.createElement('style');
    s.id = 'ucvp-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      ('ontouchstart' in window);
  }

  function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  // ============================================================
  // PROCESSED SET (avoid double-adding button)
  // ============================================================
  const processedVideos = new WeakSet();

  // ============================================================
  // ACTIVE PLAYER STATE
  // ============================================================
  let activePlayer = null;

  // ============================================================
  // TRIGGER BUTTON CREATOR
  // ============================================================
  function addTriggerToVideo(video) {
    if (processedVideos.has(video)) return;
    processedVideos.add(video);

    // Ensure parent can hold absolute children
    const parent = video.parentElement;
    if (!parent) return;

    const parentStyle = getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    parent.classList.add('ucvp-video-wrap');
    if (isMobile()) parent.classList.add('ucvp-mobile');

    const wrap = document.createElement('div');
    wrap.className = 'ucvp-trigger-wrap';
    wrap.setAttribute('data-ucvp', '1');

    const btn = document.createElement('button');
    btn.className = 'ucvp-trigger-btn';
    btn.title = 'Open in Custom Player';
    btn.setAttribute('aria-label', 'Open in Custom Player');
    // Unicode expand icon
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      openCustomPlayer(video);
    });

    wrap.appendChild(btn);
    parent.appendChild(wrap);
  }

  // ============================================================
  // CUSTOM PLAYER
  // ============================================================
  function openCustomPlayer(sourceVideo) {
    if (activePlayer) activePlayer.destroy();

    // Capture state from original video
    const savedTime = sourceVideo.currentTime;
    const savedPaused = sourceVideo.paused;
    const savedVol = sourceVideo.volume;
    const savedMuted = sourceVideo.muted;
    const savedRate = sourceVideo.playbackRate;

    // Get sources
    const sources = getVideoSources(sourceVideo);
    if (!sources.length) {
      // CORS/DRM graceful fallback
      showToastGlobal('⚠ Cannot access video source (DRM/CORS)');
      return;
    }

    activePlayer = createPlayer(sources, {
      startTime: savedTime,
      paused: savedPaused,
      volume: savedVol,
      muted: savedMuted,
      playbackRate: savedRate,
      sourceVideo: sourceVideo,
    });
  }

  function getVideoSources(video) {
    const sources = [];
    // Direct src
    if (video.src && !video.src.startsWith('blob:') || video.src) {
      try {
        // test CORS: we won't fetch, just accept blob and http
        sources.push({ src: video.src, type: video.type || '' });
      } catch (e) { /* ignore */ }
    }
    // <source> children
    video.querySelectorAll('source').forEach(s => {
      if (s.src) sources.push({ src: s.src, type: s.type || '' });
    });
    // filter empty
    return sources.filter(s => s.src);
  }

  // ============================================================
  // PLAYER FACTORY
  // ============================================================
  function createPlayer(sources, opts) {
    const mobile = isMobile();
    let brightness = 1;
    let hideTimer = null;
    let toastTimer = null;
    let destroyed = false;

    // ---- DOM BUILD ----
    const overlay = document.createElement('div');
    overlay.className = 'ucvp-overlay';

    const container = document.createElement('div');
    container.className = 'ucvp-video-container';

    const brightnessEl = document.createElement('div');
    brightnessEl.className = 'ucvp-brightness-overlay';

    const video = document.createElement('video');
    video.className = 'ucvp-video-el';
    video.volume = opts.volume;
    video.muted = opts.muted;
    video.playbackRate = opts.playbackRate;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');

    // Set sources
    sources.forEach(s => {
      const src = document.createElement('source');
      src.src = s.src;
      if (s.type) src.type = s.type;
      video.appendChild(src);
    });

    const spinner = document.createElement('div');
    spinner.className = 'ucvp-spinner';

    const toast = document.createElement('div');
    toast.className = 'ucvp-gesture-toast';

    // Controls
    const ctrlWrap = document.createElement('div');
    ctrlWrap.className = 'ucvp-controls-wrap';

    // Seek bar
    const seekbarWrap = document.createElement('div');
    seekbarWrap.className = 'ucvp-seekbar-wrap';
    const seekTrack = document.createElement('div');
    seekTrack.className = 'ucvp-seekbar-track';
    const seekBuffer = document.createElement('div');
    seekBuffer.className = 'ucvp-seekbar-buffer';
    const seekProgress = document.createElement('div');
    seekProgress.className = 'ucvp-seekbar-progress';
    const seekThumb = document.createElement('div');
    seekThumb.className = 'ucvp-seekbar-thumb';
    const seekInput = document.createElement('input');
    seekInput.type = 'range';
    seekInput.className = 'ucvp-seekbar-input';
    seekInput.min = 0; seekInput.max = 1000; seekInput.value = 0; seekInput.step = 1;
    seekTrack.appendChild(seekBuffer);
    seekTrack.appendChild(seekProgress);
    seekbarWrap.appendChild(seekTrack);
    seekbarWrap.appendChild(seekThumb);
    seekbarWrap.appendChild(seekInput);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.className = 'ucvp-btn-row';

    function makeBtn(html, title) {
      const b = document.createElement('button');
      b.className = 'ucvp-btn';
      b.innerHTML = html;
      b.title = title;
      return b;
    }

    const playBtn = makeBtn('▶', 'Play/Pause');
    const muteBtn = makeBtn('🔊', 'Mute');
    const volWrap = document.createElement('div');
    volWrap.className = 'ucvp-volume-wrap';
    const volSlider = document.createElement('input');
    volSlider.type = 'range'; volSlider.className = 'ucvp-vol-slider';
    volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01;
    volSlider.value = opts.muted ? 0 : opts.volume;
    volWrap.appendChild(muteBtn);
    volWrap.appendChild(volSlider);

    const timeEl = document.createElement('span');
    timeEl.className = 'ucvp-time';
    timeEl.textContent = '0:00 / 0:00';

    const spacer = document.createElement('div');
    spacer.className = 'ucvp-spacer';

    const speedSel = document.createElement('select');
    speedSel.className = 'ucvp-select';
    speedSel.title = 'Playback speed';
    CONFIG.SPEEDS.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s + 'x';
      if (s === (opts.playbackRate || 1)) o.selected = true;
      speedSel.appendChild(o);
    });

    const pipBtn = makeBtn('⧉', 'Picture-in-Picture');
    const fsBtn = makeBtn('⛶', 'Fullscreen');

    btnRow.appendChild(playBtn);
    btnRow.appendChild(volWrap);
    btnRow.appendChild(timeEl);
    btnRow.appendChild(spacer);
    btnRow.appendChild(speedSel);
    if (document.pictureInPictureEnabled) btnRow.appendChild(pipBtn);
    btnRow.appendChild(fsBtn);

    ctrlWrap.appendChild(seekbarWrap);
    ctrlWrap.appendChild(btnRow);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ucvp-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close custom player (Esc)';

    container.appendChild(video);
    container.appendChild(brightnessEl);
    container.appendChild(spinner);
    container.appendChild(toast);
    container.appendChild(ctrlWrap);
    container.appendChild(closeBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // ---- SEEK TO START ----
    video.addEventListener('loadedmetadata', () => {
      if (opts.startTime > 0) video.currentTime = opts.startTime;
      if (!opts.paused) video.play().catch(() => {});
    }, { once: true });

    // ---- CONTROLS LOGIC ----
    function updateSeekBar() {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      seekProgress.style.width = pct + '%';
      seekThumb.style.left = pct + '%';
      // buffer
      if (video.buffered.length > 0) {
        const bufEnd = video.buffered.end(video.buffered.length - 1);
        seekBuffer.style.width = ((bufEnd / video.duration) * 100) + '%';
      }
      seekInput.value = Math.round((video.currentTime / video.duration) * 1000);
      timeEl.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    }

    function updatePlayBtn() {
      playBtn.innerHTML = video.paused ? '▶' : '⏸';
    }

    function updateMuteBtn() {
      muteBtn.innerHTML = (video.muted || video.volume === 0) ? '🔇' : '🔊';
    }

    video.addEventListener('timeupdate', updateSeekBar);
    video.addEventListener('play', updatePlayBtn);
    video.addEventListener('pause', updatePlayBtn);
    video.addEventListener('volumechange', () => {
      updateMuteBtn();
      if (!video.muted) volSlider.value = video.volume;
    });

    // Spinner
    video.addEventListener('waiting', () => spinner.classList.add('visible'));
    video.addEventListener('playing', () => spinner.classList.remove('visible'));
    video.addEventListener('canplay', () => spinner.classList.remove('visible'));

    // Seek
    seekInput.addEventListener('input', () => {
      if (video.duration) {
        video.currentTime = (seekInput.value / 1000) * video.duration;
      }
      showControls();
    });

    // Play/Pause
    playBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    function togglePlay() {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
      showControls();
    }

    // Volume
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      showControls();
    });
    volSlider.addEventListener('input', () => {
      video.volume = parseFloat(volSlider.value);
      video.muted = video.volume === 0;
      showControls();
    });

    // Speed
    speedSel.addEventListener('change', () => {
      video.playbackRate = parseFloat(speedSel.value);
      showControls();
    });

    // PiP
    if (document.pictureInPictureEnabled) {
      pipBtn.addEventListener('click', () => {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(() => {});
        } else {
          video.requestPictureInPicture().catch(() => {
            showToast('PiP not supported for this video');
          });
        }
        showControls();
      });
    }

    // Fullscreen
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        overlay.requestFullscreen && overlay.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen && document.exitFullscreen().catch(() => {});
      }
      showControls();
    });

    // Close
    closeBtn.addEventListener('click', destroy);

    // ---- AUTO HIDE CONTROLS ----
    function showControls() {
      ctrlWrap.classList.remove('hidden');
      closeBtn.classList.remove('hidden');
      clearTimeout(hideTimer);
      if (!video.paused) {
        hideTimer = setTimeout(() => {
          ctrlWrap.classList.add('hidden');
          closeBtn.classList.add('hidden');
        }, CONFIG.AUTO_HIDE_DELAY);
      }
    }

    overlay.addEventListener('mousemove', showControls);
    overlay.addEventListener('touchstart', showControls, { passive: true });

    // ---- TOAST ----
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
    }

    // ---- KEYBOARD SHORTCUTS ----
    function onKey(e) {
      if (destroyed) return;
      // Ignore if typing in inputs
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) && e.target !== seekInput) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          showToast(video.paused ? '⏸' : '▶');
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + CONFIG.SEEK_SECONDS);
          showToast(`+${CONFIG.SEEK_SECONDS}s`);
          showControls();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - CONFIG.SEEK_SECONDS);
          showToast(`-${CONFIG.SEEK_SECONDS}s`);
          showControls();
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + CONFIG.VOLUME_STEP);
          showToast(`🔊 ${Math.round(video.volume * 100)}%`);
          showControls();
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - CONFIG.VOLUME_STEP);
          showToast(`🔊 ${Math.round(video.volume * 100)}%`);
          showControls();
          break;
        case 'm':
          video.muted = !video.muted;
          showToast(video.muted ? '🔇 Muted' : '🔊 Unmuted');
          break;
        case 'f':
          fsBtn.click();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            destroy();
          }
          break;
      }
    }
    document.addEventListener('keydown', onKey);

    // ---- TOUCH / GESTURE ----
    let touchStartX = 0, touchStartY = 0;
    let touchStartTime = 0;
    let lastTapTime = 0, lastTapX = 0;
    let touchSide = ''; // 'left' or 'right'
    let gestureMode = ''; // 'seek', 'volume', 'brightness'
    let gestureDelta = 0;

    video.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
      touchSide = t.clientX < window.innerWidth / 2 ? 'left' : 'right';
      gestureMode = '';
      gestureDelta = 0;

      // Double tap detection
      const now = Date.now();
      if (now - lastTapTime < 300 && Math.abs(t.clientX - lastTapX) < 80) {
        // double tap
        const side = t.clientX < window.innerWidth / 2 ? -1 : 1;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + side * CONFIG.SEEK_SECONDS));
        showToast(side > 0 ? `+${CONFIG.SEEK_SECONDS}s` : `-${CONFIG.SEEK_SECONDS}s`);
        lastTapTime = 0;
        e.preventDefault();
        return;
      }
      lastTapTime = now;
      lastTapX = t.clientX;
    }, { passive: false });

    video.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      if (!gestureMode) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) gestureMode = 'seek';
        else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          gestureMode = touchSide === 'right' ? 'volume' : 'brightness';
        }
      }

      if (gestureMode === 'seek') {
        const seekDelta = (dx / window.innerWidth) * (video.duration || 0) * 0.4;
        const newTime = Math.max(0, Math.min(video.duration, opts.startTime + seekDelta));
        video.currentTime = newTime;
        showToast(`⏩ ${formatTime(newTime)}`);
        e.preventDefault();
      } else if (gestureMode === 'volume') {
        const volDelta = -dy / (window.innerHeight * 0.7);
        video.volume = Math.max(0, Math.min(1, opts.volume + volDelta));
        showToast(`🔊 ${Math.round(video.volume * 100)}%`);
        e.preventDefault();
      } else if (gestureMode === 'brightness') {
        const bDelta = -dy / (window.innerHeight * 0.7);
        brightness = Math.max(0.1, Math.min(2, 1 + bDelta));
        video.style.filter = `brightness(${brightness})`;
        showToast(`☀ ${Math.round(brightness * 100)}%`);
        e.preventDefault();
      }
      showControls();
    }, { passive: false });

    video.addEventListener('touchend', () => {
      if (gestureMode === '') {
        // single tap
        togglePlay();
      }
      opts.startTime = video.currentTime;
      opts.volume = video.volume;
    });

    // ---- DESTROY ----
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(hideTimer);
      clearTimeout(toastTimer);
      document.removeEventListener('keydown', onKey);
      // Restore original video state
      try {
        if (opts.sourceVideo) {
          opts.sourceVideo.currentTime = video.currentTime;
          opts.sourceVideo.volume = video.volume;
          opts.sourceVideo.muted = video.muted;
          opts.sourceVideo.playbackRate = video.playbackRate;
          if (!video.paused) opts.sourceVideo.play().catch(() => {});
        }
      } catch (e) { /* ignore */ }
      video.pause();
      video.src = '';
      video.load();
      overlay.style.animation = 'none';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.18s';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      if (activePlayer === player) activePlayer = null;
    }

    const player = { destroy };
    return player;
  }

  // ============================================================
  // GLOBAL TOAST (before player opens)
  // ============================================================
  function showToastGlobal(msg) {
    let t = document.getElementById('ucvp-global-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ucvp-global-toast';
      Object.assign(t.style, {
        position: 'fixed', bottom: '30px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)', color: '#fff',
        padding: '10px 20px', borderRadius: '8px',
        fontSize: '14px', zIndex: CONFIG.Z_INDEX,
        fontFamily: 'sans-serif', pointerEvents: 'none',
        transition: 'opacity 0.3s'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  // ============================================================
  // SCAN & OBSERVE
  // ============================================================
  function scanVideos() {
    document.querySelectorAll('video').forEach(v => {
      // Don't add button to videos inside our own overlay
      if (v.closest('.ucvp-overlay')) return;
      if (!v.parentElement) return;
      // Skip tiny/hidden videos
      const rect = v.getBoundingClientRect();
      if (v.offsetWidth < 50 && rect.width < 50) return;
      addTriggerToVideo(v);
    });
  }

  function init() {
    injectCSS();
    scanVideos();

    // MutationObserver for dynamically added videos
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'VIDEO') { shouldScan = true; break; }
          if (node.querySelector && node.querySelector('video')) { shouldScan = true; break; }
        }
        if (shouldScan) break;
      }
      if (shouldScan) scanVideos();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ============================================================
  // BOOT
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();