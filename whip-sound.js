/* Western Spritz — click FX: frusta on songs, dances and game buttons. */
(() => {
  const SOUND_URL = "./assets/audio/frusta.mp3";
  const TARGETS = [
    '[data-open="dance"]',
    '[data-open="song"]',
    '#btnDuel',
    '#btnDuelArena',
    '#btnOpenChallenge',
    '#duelModal button',
    '#ocModal button'
  ].join(', ');
  let whip = null;
  let lastPlay = 0;

  function playWhip() {
    // One sound per gesture: don't layer overlapping whip samples.
    const now = performance.now();
    if (now - lastPlay < 90) return;
    lastPlay = now;
    try {
      if (!whip) {
        whip = new Audio(SOUND_URL);
        whip.preload = 'auto';
        whip.volume = 0.85;
      }
      whip.pause();
      whip.currentTime = 0;
      const playing = whip.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(() => {}); // Browser may deny playback until user interaction.
      }
    } catch (error) {
      console.debug('[WS] Whip sound unavailable', error);
    }
  }

  // Delegation also covers buttons and dance cards dynamically created later.
  // Play synchronously inside the user's click gesture, before links open.
  document.addEventListener('click', event => {
    const target = event.target?.closest?.(TARGETS);
    if (!target || target.disabled || target.closest('[aria-hidden="true"]')) return;
    playWhip();
  }, true);
})();
