/* =========================================================
   YOUYANG SHANG — interactions + canvas scenes
   No dependencies. One ticker. Respects reduced motion.
   ========================================================= */

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const body = document.body;
const html = document.documentElement;

/* ---------------------------------------------------------
   Ticker — one requestAnimationFrame for the whole page
   --------------------------------------------------------- */
class Ticker {
  constructor() {
    this.callbacks = new Set();
    this.last = performance.now();
    this.running = false;
    this.loop = this.loop.bind(this);
  }
  add(fn) {
    this.callbacks.add(fn);
    return () => this.callbacks.delete(fn);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }
  loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (!document.hidden) {
      for (const fn of this.callbacks) fn(dt, now / 1000);
    }
    requestAnimationFrame(this.loop);
  }
}
const ticker = new Ticker();

/* ---------------------------------------------------------
   Preloader
   --------------------------------------------------------- */
function initPreloader() {
  const preloader = $('#preloader');
  const bar = $('#preloader-bar');
  const count = $('#preloader-count');
  if (!preloader || !bar || !count) return;

  body.classList.add('is-loading');
  const params = new URLSearchParams(window.location.search);
  const skip = params.has('nopreload') || prefersReduced;

  let value = 0;
  let pageLoaded = document.readyState === 'complete';
  let finished = false;

  const paint = () => {
    const p = Math.round(value);
    bar.style.transform = `scaleX(${value / 100})`;
    count.textContent = String(p).padStart(3, '0');
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    value = 100;
    paint();
    body.classList.remove('is-loading');
    body.classList.add('is-loaded');
    preloader.classList.add('is-done');
    window.setTimeout(() => {
      preloader.classList.add('is-hidden');
      preloader.setAttribute('aria-hidden', 'true');
      startAmbientIfRequested();
    }, prefersReduced ? 80 : 1050);
  };

  window.addEventListener('load', () => { pageLoaded = true; }, { once: true });

  if (skip) {
    window.setTimeout(finish, 60);
    return;
  }

  const started = performance.now();
  const timer = window.setInterval(() => {
    value = Math.min(96, value + (96 - value) * 0.16 + 1.2);
    paint();
    if (value >= 94 && pageLoaded && performance.now() - started > 1450) {
      window.clearInterval(timer);
      window.setTimeout(finish, 320);
    }
  }, 58);

  window.setTimeout(() => {
    if (!finished) {
      window.clearInterval(timer);
      finish();
    }
  }, 5200);
}

/* ---------------------------------------------------------
   Navigation, header, progress, menu
   --------------------------------------------------------- */
function initNavigation() {
  const header = $('#site-header');
  const progress = $('#scroll-progress-bar');
  const menu = $('#menu-overlay');
  const menuButton = $('#menu-toggle');
  let lastY = window.scrollY;
  let ticking = false;

  const updateScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;

    if (header) {
      header.classList.toggle('is-scrolled', y > 18);
      if (menu && menu.classList.contains('is-open')) {
        header.classList.remove('is-hidden');
      } else if (y > 520 && y > lastY + 4) {
        header.classList.add('is-hidden');
      } else if (y < lastY - 4 || y < 200) {
        header.classList.remove('is-hidden');
      }
    }
    lastY = y;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScroll);
    }
  }, { passive: true });
  updateScroll();

  const closeMenu = () => {
    if (!menu || !menuButton) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    menuButton.setAttribute('aria-expanded', 'false');
    body.classList.remove('menu-open');
  };

  const openMenu = () => {
    if (!menu || !menuButton) return;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    menuButton.setAttribute('aria-expanded', 'true');
    body.classList.add('menu-open');
  };

  menuButton?.addEventListener('click', () => {
    if (menu?.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      if (!hash || hash.length < 2) return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      closeMenu();
      const offset = target.id === 'top' ? 0 : 62;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
      if (history.pushState) history.pushState(null, '', hash);
    });
  });

  $$('.menu-overlay__nav a').forEach((link) => link.addEventListener('click', closeMenu));

  const navLinks = $$('[data-nav]');
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.dataset.nav === entry.target.id);
        });
      });
    }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
    sections.forEach((section) => navObserver.observe(section));
  }
}

/* ---------------------------------------------------------
   Reveal on scroll + split hero type
   --------------------------------------------------------- */
function initReveals() {
  const targets = $$('.reveal, .reveal-lines');
  if (!targets.length) return;

  const groups = new Map();
  targets.forEach((el) => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach((items) => {
    items.forEach((el, index) => {
      if (el.classList.contains('reveal')) {
        el.style.transitionDelay = `${Math.min(index * 65, 260)}ms`;
      }
    });
  });

  if (!('IntersectionObserver' in window) || prefersReduced) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });

  targets.forEach((el) => observer.observe(el));
}

function splitHeroType() {
  $$('[data-split]').forEach((word) => {
    const text = word.textContent.trim();
    const isAccent = word.classList.contains('hero__word--serif');
    word.textContent = '';
    Array.from(text).forEach((letter, index) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = letter === ' ' ? '\u00A0' : letter;
      span.style.setProperty('--i', index + (isAccent ? 5 : 0));
      word.appendChild(span);
    });
  });
}

/* ---------------------------------------------------------
   Custom cursor + magnetic elements + tilt
   --------------------------------------------------------- */
function initCursor() {
  if (!finePointer || prefersReduced) return;
  const ring = $('#cursor');
  const dot = $('#cursor-dot');
  const label = $('#cursor-label');
  if (!ring || !dot) return;

  html.classList.add('has-custom-cursor');
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const position = { x: pointer.x, y: pointer.y };
  let visible = false;

  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    if (!visible) {
      visible = true;
      ring.style.opacity = '1';
      dot.style.opacity = '1';
    }
  }, { passive: true });

  ticker.add(() => {
    position.x = lerp(position.x, pointer.x, 0.17);
    position.y = lerp(position.y, pointer.y, 0.17);
    ring.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  });

  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));

  document.addEventListener('pointerover', (event) => {
    const target = event.target.closest('a, button, [data-cursor]');
    if (!target) {
      ring.classList.remove('is-hover');
      if (label) label.textContent = '';
      return;
    }
    const custom = target.getAttribute('data-cursor');
    const fallback = target.tagName === 'BUTTON' ? 'PLAY' : 'OPEN';
    if (label) label.textContent = custom || fallback;
    ring.classList.add('is-hover');
  });

  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) {
      ring.classList.remove('is-hover');
      if (label) label.textContent = '';
    }
  });
}

function initMagnetic() {
  if (!finePointer || prefersReduced) return;
  $$('.magnetic').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      element.style.transform = `translate(${clamp(x * 0.14, -9, 9)}px, ${clamp(y * 0.22, -7, 7)}px)`;
    });
    element.addEventListener('pointerleave', () => {
      element.style.transform = '';
    });
  });
}

function initTilt() {
  if (!finePointer || prefersReduced) return;
  $$('[data-tilt]').forEach((element) => {
    element.style.willChange = 'transform';
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const amount = element.classList.contains('fractal-stage') ? 3.2 : 6;
      element.style.transition = 'transform 0.16s ease-out';
      element.style.transform = `perspective(1000px) rotateX(${(-y * amount).toFixed(2)}deg) rotateY(${(x * amount).toFixed(2)}deg)`;
    });
    element.addEventListener('pointerleave', () => {
      element.style.transition = 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
      element.style.transform = '';
    });
  });
}

/* ---------------------------------------------------------
   Small UI details
   --------------------------------------------------------- */
function initClock() {
  const timeEl = $('#local-time');
  const zoneEl = $('#local-zone');
  if (!timeEl) return;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  const update = () => {
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    timeEl.textContent = `${get('hour')}:${get('minute')}:${get('second')}`;
    if (zoneEl) zoneEl.textContent = get('timeZoneName').replace('GMT', 'UTC');
  };
  update();
  window.setInterval(update, 1000);
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-show'), 2200);
}

function initCopyEmail() {
  const button = $('#copy-email');
  if (!button) return;
  button.addEventListener('click', async () => {
    const email = button.dataset.email || 'shang.320@osu.edu';
    try {
      await navigator.clipboard.writeText(email);
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = email;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    showToast('Email copied — talk soon');
  });
}

function initMarquee() {
  const marquees = $$('.marquee');
  marquees.forEach((marquee) => {
    const track = $('.marquee__track', marquee);
    if (!track) return;
    marquee.addEventListener('pointerenter', () => track.style.animationPlayState = 'paused');
    marquee.addEventListener('pointerleave', () => track.style.animationPlayState = 'running');
  });
}

function initSkillGlow() {
  const board = $('.skill-board');
  if (!board) return;
  board.addEventListener('pointermove', (event) => {
    const rect = board.getBoundingClientRect();
    board.style.setProperty('--glow-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    board.style.setProperty('--glow-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  });
}

/* ---------------------------------------------------------
   Audio engine — ambient pad + piano
   --------------------------------------------------------- */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ambient = null;
    this.noteBus = null;
    this.ambientOn = false;
    this.ambientRequested = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(this.ctx.destination);

    this.noteBus = this.ctx.createGain();
    this.noteBus.gain.value = 0.55;
    this.noteBus.connect(compressor);
    return this.ctx;
  }

  makeReverb(seconds = 2.8) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  buildAmbient() {
    if (this.ambient || !this.ensure()) return;
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.8;

    const dry = ctx.createGain();
    dry.gain.value = 0.68;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    const reverb = this.makeReverb(3.4);

    filter.connect(dry).connect(master);
    filter.connect(reverb).connect(wet).connect(master);
    master.connect(ctx.destination);

    const voices = [
      { freq: 110, type: 'sine', gain: 0.13, detune: -4 },
      { freq: 164.81, type: 'sine', gain: 0.08, detune: 5 },
      { freq: 220, type: 'triangle', gain: 0.035, detune: 3 },
      { freq: 329.63, type: 'sine', gain: 0.025, detune: -6 }
    ];

    const oscillators = voices.map((voice) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = voice.type;
      osc.frequency.value = voice.freq;
      osc.detune.value = voice.detune;
      gain.gain.value = voice.gain;
      osc.connect(gain).connect(filter);
      osc.start();
      return osc;
    });

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const drift = ctx.createOscillator();
    const driftGain = ctx.createGain();
    drift.frequency.value = 0.043;
    driftGain.gain.value = 7;
    drift.connect(driftGain);
    oscillators.forEach((osc) => driftGain.connect(osc.detune));
    drift.start();

    this.ambient = { master, filter, oscillators, lfo, drift };
  }

  setAmbient(on) {
    this.ambientRequested = on;
    if (on && !this.ensure()) return false;
    this.buildAmbient();
    if (!this.ambient) return false;
    const now = this.ctx.currentTime;
    const gain = this.ambient.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(on ? 0.75 : 0, now + (on ? 2.2 : 0.9));
    this.ambientOn = on;
    return true;
  }

  playNote(freq, when = 0, duration = 1.8, velocity = 0.11) {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + when;
    const voice = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, at);
    filter.frequency.exponentialRampToValueAtTime(900, at + duration * 0.8);
    voice.gain.setValueAtTime(0.0001, at);
    voice.gain.exponentialRampToValueAtTime(velocity, at + 0.012);
    voice.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    voice.connect(filter).connect(this.noteBus);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'triangle';
    fundamental.frequency.value = freq;
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = freq * 2.002;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.22;

    fundamental.connect(voice);
    shimmer.connect(shimmerGain).connect(voice);
    fundamental.start(at);
    shimmer.start(at);
    fundamental.stop(at + duration + 0.05);
    shimmer.stop(at + duration + 0.05);

    fundamental.onended = () => {
      voice.disconnect();
      filter.disconnect();
      shimmerGain.disconnect();
    };
  }
}
const audio = new AudioEngine();

function startAmbientIfRequested() {
  if (audio.ambientRequested && !audio.ambientOn) audio.setAmbient(true);
}

function initSoundToggle() {
  const button = $('#sound-toggle');
  if (!button) return;
  const text = $('.sound-toggle__text', button);
  const setState = (on) => {
    button.setAttribute('aria-pressed', String(on));
    if (text) text.textContent = on ? 'Sound on' : 'Sound off';
    if (on) audio.setAmbient(true);
    else audio.setAmbient(false);
  };
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    const ok = next ? audio.setAmbient(true) : audio.setAmbient(false);
    if (next && !ok) {
      showToast('Audio is not available in this browser');
      return;
    }
    setState(next);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      const next = button.getAttribute('aria-pressed') !== 'true';
      setState(next);
    }
  });
}

function initPiano() {
  const piano = $('#piano');
  const demo = $('#piano-demo');
  if (!piano) return;

  const whiteNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
  const blackAfter = { C4: 'C#4', D4: 'D#4', F4: 'F#4', G4: 'G#4', A4: 'A#4', C5: 'C#5', D5: 'D#5', F5: 'F#5', G5: 'G#5', A5: 'A#5' };
  const frequencies = {
    C4: 261.63, 'C#4': 277.18, D4: 293.66, 'D#4': 311.13, E4: 329.63, F4: 349.23,
    'F#4': 369.99, G4: 392, 'G#4': 415.3, A4: 440, 'A#4': 466.16, B4: 493.88,
    C5: 523.25, 'C#5': 554.37, D5: 587.33, 'D#5': 622.25, E5: 659.25, F5: 698.46,
    'F#5': 739.99, G5: 783.99, 'G#5': 830.61, A5: 880, 'A#5': 932.33, B5: 987.77, C6: 1046.5
  };

  const keyMap = new Map();

  whiteNotes.forEach((note, index) => {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'piano__key';
    key.dataset.note = note;
    key.setAttribute('aria-label', `Play ${note}`);
    key.innerHTML = `<span aria-hidden="true">${note}</span>`;
    piano.appendChild(key);
    keyMap.set(note, key);

    const black = blackAfter[note];
    if (black) {
      const blackKey = document.createElement('button');
      blackKey.type = 'button';
      blackKey.className = 'piano__key piano__key--black';
      blackKey.dataset.note = black;
      blackKey.setAttribute('aria-label', `Play ${black}`);
      blackKey.style.left = `${((index + 1) / whiteNotes.length) * 100}%`;
      piano.appendChild(blackKey);
      keyMap.set(black, blackKey);
    }
  });

  const pulse = (key) => {
    key.classList.add('is-playing');
    window.setTimeout(() => key.classList.remove('is-playing'), 190);
  };

  const play = (note, when = 0, velocity = 0.12) => {
    if (!frequencies[note]) return;
    audio.playNote(frequencies[note], when, 1.9, velocity);
  };

  keyMap.forEach((key, note) => {
    key.addEventListener('pointerdown', () => {
      pulse(key);
      play(note);
    });
    key.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        pulse(key);
        play(note);
      }
    });
    key.addEventListener('click', (event) => {
      if (event.detail === 0) {
        pulse(key);
        play(note);
      }
    });
  });

  let phraseTimers = [];
  if (demo) {
    demo.addEventListener('click', () => {
      phraseTimers.forEach((timer) => window.clearTimeout(timer));
      phraseTimers = [];
      const phrase = [
        ['C4', 0], ['E4', 0.16], ['G4', 0.32], ['B4', 0.48],
        ['C5', 0.64], ['B4', 0.82], ['G4', 1.0], ['E4', 1.18],
        ['G4', 1.42], ['C5', 1.58]
      ];
      audio.ensure();
      phrase.forEach(([note, when]) => {
        play(note, when, 0.1);
        const key = keyMap.get(note);
        if (key) {
          phraseTimers.push(window.setTimeout(() => pulse(key), when * 1000));
        }
      });
      showToast('A little phrase for you');
    });
  }
}

/* ---------------------------------------------------------
   Scene base
   --------------------------------------------------------- */
class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.active = false;
    this.ready = false;
    this.time = 0;
    this.pointer = { x: 0.5, y: 0.5, active: false };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      this.pointer.y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      this.pointer.active = true;
    }, { passive: true });
    canvas.addEventListener('pointerleave', () => { this.pointer.active = false; });
    canvas.addEventListener('pointerdown', () => { this.pointer.active = true; });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.ready) {
      this.setup();
      if (prefersReduced) this.draw(this.time, 0);
    }
  }

  setup() {}
  draw() {}
}

const scenes = [];

function observeScene(scene) {
  scenes.push(scene);
  scene.ready = true;
  scene.setup();
  scene.canvas.dataset.sceneActive = 'false';
  if (prefersReduced) {
    scene.draw(0, 0);
    return;
  }
  if (!('IntersectionObserver' in window)) {
    scene.active = true;
    scene.canvas.dataset.sceneActive = 'true';
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      scene.active = entry.isIntersecting;
      scene.canvas.dataset.sceneActive = String(scene.active);
      if (entry.isIntersecting) scene.time = scene.time || 0;
    });
  }, { rootMargin: '140px 0px', threshold: 0.01 });
  observer.observe(scene.canvas);
}

ticker.add((dt, time) => {
  if (prefersReduced) return;
  scenes.forEach((scene) => {
    if (!scene.active) return;
    scene.time += dt;
    scene.draw(scene.time, dt, time);
  });
});

/* global background field */
class BackgroundScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.mouse = { x: -999, y: -999 };
    this.time = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('pointermove', (event) => {
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
      this.mouse.x = -999;
      this.mouse.y = -999;
    });
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const count = clamp(Math.floor((this.w * this.h) / 21000), 28, 88);
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      r: Math.random() * 1.4 + 0.45,
      tone: Math.random(),
      phase: Math.random() * TAU
    }));
    if (prefersReduced) this.draw(0, 0);
  }

  draw(time, dt) {
    if (prefersReduced && time > 0) return;
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    const particles = this.particles;
    particles.forEach((p) => {
      if (!prefersReduced) {
        if (this.mouse.x > 0) {
          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 24000 && distSq > 0) {
            const force = (1 - distSq / 24000) * 12;
            const dist = Math.sqrt(distSq);
            p.vx += (dx / dist) * force * dt;
            p.vy += (dy / dist) * force * dt;
          }
        }
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }
    });

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 13225) continue;
        const alpha = (1 - distSq / 13225) * 0.16;
        ctx.strokeStyle = `rgba(242, 239, 230, ${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    particles.forEach((p, index) => {
      const pulse = 0.55 + Math.sin(time * 0.65 + p.phase) * 0.35;
      let color = `rgba(242, 239, 230, ${pulse * 0.55})`;
      if (p.tone > 0.86) color = `rgba(216, 255, 62, ${pulse * 0.85})`;
      else if (p.tone < 0.12) color = `rgba(144, 112, 255, ${pulse * 0.8})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      if (index % 17 === 0 && !prefersReduced) {
        ctx.strokeStyle = `rgba(216, 255, 62, ${0.06 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + pulse * 5, 0, TAU);
        ctx.stroke();
      }
    });
  }
}

/* ---------------------------------------------------------
   Hero orb
   --------------------------------------------------------- */
class OrbScene extends Scene {
  setup() {
    this.points = [];
    this.links = [];
    const count = this.w < 420 ? 300 : 520;
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      this.points.push({
        x: Math.cos(theta) * radius,
        y,
        z: Math.sin(theta) * radius,
        tone: i % 19 === 0 ? 'lime' : i % 29 === 0 ? 'violet' : 'white'
      });
    }
    for (let i = 0; i < this.points.length; i += 3) {
      let first = -1;
      let second = -1;
      let firstDist = 4;
      let secondDist = 4;
      for (let j = 0; j < this.points.length; j++) {
        if (j === i) continue;
        const a = this.points[i];
        const b = this.points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < firstDist) {
          secondDist = firstDist;
          second = first;
          firstDist = dist;
          first = j;
        } else if (dist < secondDist) {
          secondDist = dist;
          second = j;
        }
      }
      if (first >= 0) this.links.push([i, first]);
      if (second >= 0) this.links.push([i, second]);
    }
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.285;
    const interactionX = this.pointer.active ? this.pointer.x - 0.5 : Math.sin(time * 0.14) * 0.12;
    const interactionY = this.pointer.active ? this.pointer.y - 0.5 : 0;
    const rotY = time * 0.16 + interactionX * 0.9;
    const rotX = -0.22 + interactionY * 0.55;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    const project = (x, y, z, scale = radius) => {
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const perspective = 1 / (1 + z2 * 0.24);
      return {
        x: cx + x1 * scale * perspective,
        y: cy + y1 * scale * perspective,
        z: z2,
        s: perspective
      };
    };

    let glow = ctx.createRadialGradient(cx, cy, radius * 0.06, cx, cy, radius * 1.5);
    glow.addColorStop(0, 'rgba(216, 255, 62, 0.17)');
    glow.addColorStop(0.35, 'rgba(144, 112, 255, 0.1)');
    glow.addColorStop(1, 'rgba(144, 112, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.055)';
    ctx.lineWidth = 0.6;
    for (let ring = 0; ring < 4; ring++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * (1.08 + ring * 0.02), radius * (0.33 + ring * 0.015), -0.38 + Math.sin(time * 0.1 + ring) * 0.04, 0, TAU);
      ctx.stroke();
    }

    const projected = this.points.map((point) => project(point.x, point.y, point.z));
    ctx.globalCompositeOperation = 'lighter';
    this.links.forEach(([a, b]) => {
      const pa = projected[a];
      const pb = projected[b];
      const depth = (pa.z + pb.z) * 0.5;
      const alpha = clamp(0.08 + (1 - depth) * 0.09, 0.02, 0.2);
      ctx.strokeStyle = `rgba(216, 255, 62, ${alpha})`;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });

    projected
      .map((point, index) => ({ ...point, tone: this.points[index].tone, index }))
      .sort((a, b) => b.z - a.z)
      .forEach((point) => {
        const depth = clamp((point.z + 1) / 2, 0, 1);
        const size = 0.55 + (1 - depth) * 1.45;
        let color = `rgba(242, 239, 230, ${0.22 + (1 - depth) * 0.48})`;
        if (point.tone === 'lime') color = `rgba(216, 255, 62, ${0.45 + (1 - depth) * 0.5})`;
        if (point.tone === 'violet') color = `rgba(144, 112, 255, ${0.45 + (1 - depth) * 0.45})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, TAU);
        ctx.fill();
        if (point.tone !== 'white') {
          ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.12)');
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5 + (1 - depth) * 5, 0, TAU);
          ctx.stroke();
        }
      });
    ctx.globalCompositeOperation = 'source-over';

    const satelliteAngle = time * 0.7;
    for (let i = 0; i < 3; i++) {
      const angle = satelliteAngle + (i * TAU) / 3;
      const s = project(Math.cos(angle) * 1.16, Math.sin(angle) * 0.18, Math.sin(angle) * 1.16);
      ctx.fillStyle = i === 0 ? 'rgba(216, 255, 62, 0.9)' : 'rgba(255, 107, 61, 0.75)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? 'rgba(216, 255, 62, 0.22)' : 'rgba(255, 107, 61, 0.16)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, TAU);
      ctx.stroke();
    }
  }
}

/* ---------------------------------------------------------
   Fractal tree
   --------------------------------------------------------- */
class FractalScene extends Scene {
  setup() {
    this.time = 0;
    this.frame = 0;
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const baseY = h * 0.93;
    const interactionX = this.pointer.active ? this.pointer.x - 0.5 : Math.sin(time * 0.25) * 0.12;
    const interactionY = this.pointer.active ? this.pointer.y - 0.5 : Math.cos(time * 0.2) * 0.12;
    const spread = 0.4 + interactionX * 0.32;
    const baseLength = Math.min(w, h) * (0.215 + interactionY * 0.035);
    const sway = Math.sin(time * 0.7) * 0.035;
    const depth = 9;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const ground = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, Math.min(w, h) * 0.4);
    ground.addColorStop(0, 'rgba(216, 255, 62, 0.12)');
    ground.addColorStop(0.44, 'rgba(255, 107, 61, 0.04)');
    ground.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.04)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, baseY, Math.min(w, h) * (0.12 * i + 0.1), Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }

    const tipPoints = [];
    const palette = [
      [255, 107, 61],
      [255, 107, 61],
      [255, 154, 78],
      [216, 255, 62],
      [216, 255, 62],
      [174, 255, 95],
      [144, 112, 255],
      [144, 112, 255],
      [85, 230, 210]
    ];

    const branch = (x, y, length, angle, level) => {
      if (level <= 0 || length < 1.2) {
        tipPoints.push({ x, y, level });
        return;
      }
      const wobble = Math.sin(time * 0.8 + level * 0.7 + x * 0.01) * sway;
      const nextAngle = angle + wobble;
      const x2 = x + Math.cos(nextAngle) * length;
      const y2 = y + Math.sin(nextAngle) * length;
      const rgb = palette[Math.min(palette.length - 1, depth - level)];
      const alpha = 0.18 + (depth - level) * 0.075;
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      ctx.lineWidth = Math.max(0.55, level * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      branch(x2, y2, length * 0.72, nextAngle - spread, level - 1);
      branch(x2, y2, length * 0.72, nextAngle + spread, level - 1);
    };

    branch(cx, baseY, baseLength, -Math.PI / 2, depth);
    ctx.globalCompositeOperation = 'source-over';

    tipPoints.forEach((tip, index) => {
      const pulse = 0.45 + Math.sin(time * 1.4 + index * 0.7) * 0.35;
      ctx.fillStyle = `rgba(216, 255, 62, ${pulse * 0.48})`;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 1.2, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    if (this.frame++ % 8 === 0) {
      const depthEl = document.getElementById('fractal-depth');
      const angleEl = document.getElementById('fractal-angle');
      const dimEl = document.getElementById('fractal-dim');
      if (depthEl) depthEl.textContent = String(depth).padStart(2, '0');
      if (angleEl) angleEl.textContent = spread.toFixed(2);
      if (dimEl) dimEl.textContent = (Math.log(2) / Math.log(1 / 0.72)).toFixed(2);
    }
  }
}

/* ---------------------------------------------------------
   Campus map
   --------------------------------------------------------- */
class CampusScene extends Scene {
  setup() {
    this.nodes = [
      { x: 0.12, y: 0.73, label: 'LIB' },
      { x: 0.29, y: 0.51, label: 'HALL' },
      { x: 0.47, y: 0.63, label: 'LAB' },
      { x: 0.67, y: 0.4, label: 'UNION' },
      { x: 0.86, y: 0.27, label: 'GYM' }
    ];
    this.blocks = [
      { x: 0.08, y: 0.16, w: 0.17, h: 0.13, tone: 'violet' },
      { x: 0.33, y: 0.1, w: 0.19, h: 0.16, tone: 'cyan' },
      { x: 0.63, y: 0.13, w: 0.13, h: 0.1, tone: 'lime' },
      { x: 0.79, y: 0.55, w: 0.14, h: 0.18, tone: 'violet' },
      { x: 0.2, y: 0.8, w: 0.14, h: 0.09, tone: 'lime' },
      { x: 0.5, y: 0.83, w: 0.22, h: 0.08, tone: 'cyan' }
    ];
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0b1014');
    bg.addColorStop(0.55, '#090d11');
    bg.addColorStop(1, '#0d1116');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(85, 230, 210, 0.055)';
    ctx.lineWidth = 0.7;
    const step = Math.max(28, Math.min(w, h) * 0.085);
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    this.blocks.forEach((block, index) => {
      const x = block.x * w;
      const y = block.y * h;
      const bw = block.w * w;
      const bh = block.h * h;
      const color = block.tone === 'lime' ? '216, 255, 62' : block.tone === 'violet' ? '144, 112, 255' : '85, 230, 210';
      ctx.fillStyle = 'rgba(18, 24, 29, 0.88)';
      ctx.strokeStyle = 'rgba(242, 239, 230, 0.09)';
      ctx.lineWidth = 0.8;
      roundRect(ctx, x, y, bw, bh, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(${color}, 0.17)`;
      ctx.fillRect(x, y, bw, 2);
      const cell = Math.max(4, bw / 8);
      for (let ix = x + 6; ix < x + bw - 5; ix += cell) {
        for (let iy = y + 7; iy < y + bh - 5; iy += cell) {
          ctx.fillStyle = `rgba(${color}, ${0.06 + 0.04 * Math.sin(time * 1.4 + index + ix)})`;
          ctx.fillRect(ix, iy, 2, 2);
        }
      }
    });

    const points = this.nodes.map((node) => ({ x: node.x * w, y: node.y * h }));
    let total = 0;
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a, b, length, start: total });
      total += length;
    }

    const loop = (time * 0.16) % 1.34;
    const progress = clamp(loop, 0, 1);
    const target = total * progress;
    let current = null;

    ctx.strokeStyle = 'rgba(216, 255, 62, 0.14)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(216, 255, 62, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const segment of segments) {
      if (target >= segment.start + segment.length) {
        ctx.lineTo(segment.b.x, segment.b.y);
      } else if (target > segment.start) {
        const p = (target - segment.start) / segment.length;
        current = { x: lerp(segment.a.x, segment.b.x, p), y: lerp(segment.a.y, segment.b.y, p) };
        ctx.lineTo(current.x, current.y);
        break;
      } else {
        break;
      }
    }
    ctx.stroke();

    if (progress >= 1) {
      const last = points[points.length - 1];
      current = { x: last.x, y: last.y };
    }

    points.forEach((point, index) => {
      const pulse = 0.5 + Math.sin(time * 2 + index * 1.3) * 0.5;
      ctx.fillStyle = '#0b1014';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(216, 255, 62, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(216, 255, 62, 0.9)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.6, 0, TAU);
      ctx.fill();
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(242, 239, 230, 0.55)';
      ctx.fillText(this.nodes[index].label, point.x + 9, point.y - 7);
    });

    if (current) {
      const glow = ctx.createRadialGradient(current.x, current.y, 0, current.x, current.y, 22);
      glow.addColorStop(0, 'rgba(216, 255, 62, 0.55)');
      glow.addColorStop(1, 'rgba(216, 255, 62, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(current.x, current.y, 22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath();
      ctx.arc(current.x, current.y, 3, 0, TAU);
      ctx.fill();
    }

    const bx = w - 54;
    const by = h - 46;
    ctx.strokeStyle = 'rgba(85, 230, 210, 0.24)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 22, by);
    ctx.lineTo(bx + 22, by);
    ctx.moveTo(bx, by - 22);
    ctx.lineTo(bx, by + 22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(216, 255, 62, 0.85)';
    ctx.beginPath();
    ctx.arc(bx + Math.cos(time) * 16, by + Math.sin(time) * 16, 1.7, 0, TAU);
    ctx.fill();

    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(85, 230, 210, 0.55)';
    ctx.fillText('ROUTE / OPTIMIZED', w - 132, h - 17);
  }
}

/* ---------------------------------------------------------
   Pixel world
   --------------------------------------------------------- */
class PixelScene extends Scene {
  setup() {
    this.baseW = 320;
    this.baseH = 240;
    this.off = document.createElement('canvas');
    this.off.width = this.baseW;
    this.off.height = this.baseH;
    this.offCtx = this.off.getContext('2d');
    this.offCtx.imageSmoothingEnabled = false;
    this.stars = Array.from({ length: 34 }, (_, index) => ({
      x: (index * 73 + 23) % this.baseW,
      y: (index * 47 + 11) % 92,
      phase: index * 0.71,
      size: index % 8 === 0 ? 2 : 1
    }));
    this.potions = [
      { x: 24, y: 159, color: '#77ff55' },
      { x: 39, y: 159, color: '#9070ff' },
      { x: 54, y: 159, color: '#55e6d2' },
      { x: 98, y: 138, color: '#ff6b3d' },
      { x: 113, y: 138, color: '#d8ff3e' },
      { x: 128, y: 138, color: '#ff6bd5' },
      { x: 176, y: 185, color: '#77ff55' },
      { x: 191, y: 185, color: '#9070ff' },
      { x: 257, y: 136, color: '#55e6d2' },
      { x: 272, y: 136, color: '#ff6b3d' }
    ];
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;

    const cycle = time % 12;
    const inMenu = cycle < 4;
    const local = inMenu ? cycle : cycle - 4;
    const duration = inMenu ? 4 : 8;
    const o = this.offCtx;
    o.clearRect(0, 0, this.baseW, this.baseH);

    o.save();
    const pan = this.pointer.active ? (this.pointer.x - 0.5) * -5 : Math.sin(time * 0.25) * 1.5;
    o.translate(pan, 0);
    if (inMenu) this.drawMenu(o, local);
    else this.drawGame(o, local);
    o.restore();

    const fade = Math.min(1, local / 0.3, (duration - local) / 0.3);
    if (fade < 1) {
      o.fillStyle = `rgba(3, 5, 3, ${(1 - fade) * 0.9})`;
      o.fillRect(0, 0, this.baseW, this.baseH);
    }

    const scale = Math.max(w / this.baseW, h / this.baseH);
    const drawW = this.baseW * scale;
    const drawH = this.baseH * scale;
    const dx = (w - drawW) / 2;
    const dy = (h - drawH) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050605';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, this.baseW, this.baseH, dx, dy, drawW, drawH);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  }

  drawMenu(o, time) {
    o.fillStyle = '#040604';
    o.fillRect(0, 0, this.baseW, this.baseH);

    const glow = o.createRadialGradient(160, 168, 0, 160, 168, 190);
    glow.addColorStop(0, 'rgba(75, 235, 60, 0.09)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    o.fillStyle = glow;
    o.fillRect(0, 0, this.baseW, this.baseH);

    this.stars.forEach((star) => {
      const alpha = 0.18 + (Math.sin(time * 1.7 + star.phase) + 1) * 0.18;
      o.fillStyle = `rgba(220, 255, 210, ${alpha})`;
      o.fillRect(Math.round(star.x), star.y, star.size, star.size);
    });

    this.drawWireframe(o, time);
    this.drawMoon(o, 276, 38);
    this.drawBook(o, 88, 146, time);
    this.drawMiniDragon(o, 201, 153, time);

    o.save();
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    o.font = '700 13px "Courier New", monospace';
    o.fillStyle = '#77ff57';
    o.shadowColor = 'rgba(102, 255, 76, 0.75)';
    o.shadowBlur = 7;
    o.fillText('Dimensional Adventure', 160, 44);
    o.restore();

    const startY = 102;
    const items = ['Start', 'Control', 'Credits', 'Exit'];
    o.save();
    o.textAlign = 'left';
    o.textBaseline = 'alphabetic';
    o.font = '700 7px "Courier New", monospace';
    items.forEach((item, index) => {
      const y = startY + index * 12;
      o.fillStyle = index === 0 ? '#b6ff9b' : 'rgba(242, 239, 230, 0.9)';
      o.fillText(item, 130, y);
    });
    if (Math.floor(time * 2.4) % 2 === 0) {
      o.fillStyle = '#77ff57';
      o.beginPath();
      o.moveTo(119, startY - 4);
      o.lineTo(125, startY - 1);
      o.lineTo(119, startY + 2);
      o.closePath();
      o.fill();
    }
    o.fillStyle = 'rgba(119, 255, 87, 0.55)';
    o.font = '700 4px "Courier New", monospace';
    o.textAlign = 'center';
    o.fillText('PRESS ENTER', 160, 224);
    o.restore();

    for (let i = 0; i < 5; i++) {
      const x = 38 + i * 61;
      const y = 78 + Math.sin(time * 1.2 + i) * 9;
      o.fillStyle = `rgba(119, 255, 87, ${0.1 + (i % 2) * 0.08})`;
      o.fillRect(x, y, 1, 1);
    }
  }

  drawWireframe(o, time) {
    const rows = 12;
    const cols = 18;
    const project = (x, z) => {
      const scale = 1.14 - z * 0.85;
      const hill = Math.sin(x * 0.035 + z * 7 + time * 0.45) * 8
        + Math.sin(x * 0.085 - z * 4 + time * 0.3) * 4;
      return {
        x: 160 + (x - 160) * scale,
        y: 197 - z * 57 + hill * (0.35 + z * 0.75)
      };
    };

    o.save();
    o.lineWidth = 0.65;
    for (let row = 0; row <= rows; row++) {
      const z = row / rows;
      o.strokeStyle = `rgba(108, 255, 86, ${0.12 + z * 0.17})`;
      o.beginPath();
      for (let x = 0; x <= 320; x += 4) {
        const p = project(x, z);
        if (x === 0) o.moveTo(p.x, p.y);
        else o.lineTo(p.x, p.y);
      }
      o.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols) * 320;
      o.strokeStyle = 'rgba(108, 255, 86, 0.13)';
      o.beginPath();
      for (let row = 0; row <= rows; row++) {
        const p = project(x, row / rows);
        if (row === 0) o.moveTo(p.x, p.y);
        else o.lineTo(p.x, p.y);
      }
      o.stroke();
    }
    o.restore();
  }

  drawMoon(o, x, y) {
    o.fillStyle = 'rgba(247, 231, 153, 0.12)';
    o.beginPath();
    o.arc(x, y, 30, 0, TAU);
    o.fill();
    o.fillStyle = '#f4e69e';
    o.beginPath();
    o.arc(x, y, 13, 0, TAU);
    o.fill();
    o.fillStyle = '#040604';
    o.beginPath();
    o.arc(x + 6, y - 4, 12, 0, TAU);
    o.fill();
    o.fillStyle = 'rgba(180, 166, 118, 0.8)';
    o.fillRect(x - 8, y + 2, 2, 2);
    o.fillRect(x - 3, y + 7, 3, 2);
  }

  drawBook(o, x, y, time) {
    const bob = Math.round(Math.sin(time * 1.8) * 1.5);
    o.fillStyle = 'rgba(0, 0, 0, 0.25)';
    o.fillRect(x + 1, y + 18, 13, 2);
    o.fillStyle = '#54263b';
    o.fillRect(x, y + bob, 14, 14);
    o.fillStyle = '#8f3e5b';
    o.fillRect(x + 1, y + 1 + bob, 12, 12);
    o.fillStyle = '#e6d6ad';
    o.fillRect(x + 3, y + 2 + bob, 4, 10);
    o.fillStyle = '#b5a47d';
    o.fillRect(x + 3, y + 4 + bob, 4, 1);
    o.fillRect(x + 3, y + 7 + bob, 4, 1);
    o.fillStyle = '#d8ff3e';
    o.fillRect(x + 9, y + 5 + bob, 2, 1);
    o.fillRect(x + 9, y + 9 + bob, 2, 1);
  }

  drawMiniDragon(o, x, y) {
    o.fillStyle = 'rgba(0, 0, 0, 0.3)';
    o.fillRect(x - 20, y + 11, 40, 2);

    o.fillStyle = '#55d943';
    o.fillRect(x - 17, y, 17, 10);
    o.fillRect(x - 21, y + 2, 4, 6);
    o.fillRect(x - 24, y + 4, 3, 3);
    o.fillRect(x, y - 2, 13, 10);
    o.fillRect(x + 11, y + 1, 5, 5);

    o.fillStyle = '#071108';
    o.fillRect(x + 7, y + 1, 2, 2);
    o.fillRect(x + 9, y + 6, 4, 1);

    o.fillStyle = '#2b1a4a';
    o.fillRect(x - 6, y - 6, 24, 3);
    o.fillStyle = '#5c3b91';
    o.fillRect(x + 1, y - 13, 9, 7);
    o.fillRect(x + 3, y - 17, 5, 4);
    o.fillStyle = '#d6d24f';
    o.fillRect(x + 4, y - 12, 1, 1);
    o.fillRect(x + 6, y - 16, 1, 1);
    o.fillRect(x + 7, y - 10, 1, 1);
  }

  drawGame(o, time) {
    const brickW = 32;
    const brickH = 16;
    o.fillStyle = '#4c4f4c';
    o.fillRect(0, 0, this.baseW, this.baseH);

    for (let row = -1; row < 16; row++) {
      const offset = row % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < this.baseW + brickW; x += brickW) {
        const bx = x + offset;
        const by = row * brickH;
        const index = row * 19 + Math.round(x / brickW);
        o.fillStyle = index % 7 === 0 ? '#565956' : '#5b5e5b';
        o.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);
        o.fillStyle = '#686b68';
        o.fillRect(bx + 1, by + 1, brickW - 2, 1);
        o.fillStyle = '#3b3d3b';
        o.fillRect(bx + 1, by + brickH - 2, brickW - 2, 1);
      }
    }

    const shade = o.createLinearGradient(0, 0, 0, this.baseH);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
    shade.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    o.fillStyle = shade;
    o.fillRect(0, 0, this.baseW, this.baseH);

    for (let i = 0; i < 22; i++) {
      const x = (i * 47 + 13) % 320;
      const y = (i * 29 + 17) % 210;
      o.fillStyle = i % 3 === 0 ? 'rgba(92, 255, 71, 0.18)' : 'rgba(40, 80, 38, 0.22)';
      o.fillRect(x, y, 2, 1);
      if (i % 4 === 0) o.fillRect(x + 2, y + 2, 1, 1);
    }

    this.drawPurpleColumn(o, 65, 139, 22, 86);
    this.drawPlatform(o, 11, 170, 66);
    this.drawPlatform(o, 84, 149, 64);
    this.drawPlatform(o, 162, 196, 62);
    this.drawPlatform(o, 244, 146, 60);

    this.potions.forEach((potion) => {
      this.drawPotion(o, potion.x, potion.y, potion.color);
    });

    this.drawPortal(o, 294, 186, time);
    this.drawStaff(o, 207, 178, time);
    this.drawDragon(o, 172 + Math.sin(time * 0.8) * 8, 214);
    this.drawBook(o, 33, 201, time + 2);

    o.fillStyle = '#2b1b10';
    o.fillRect(0, 224, this.baseW, 16);
    o.fillStyle = '#3a2517';
    for (let x = 0; x < this.baseW; x += 24) {
      o.fillRect(x, 224, 22, 2);
      o.fillRect(x + 4, 229, 18, 1);
      o.fillRect(x + 9, 234, 13, 1);
    }
    o.fillStyle = 'rgba(0, 0, 0, 0.32)';
    o.fillRect(0, 239, this.baseW, 1);
  }

  drawPlatform(o, x, y, w) {
    o.fillStyle = 'rgba(0, 0, 0, 0.32)';
    o.fillRect(x + 2, y + 7, w - 4, 4);
    o.fillStyle = '#3c2618';
    o.fillRect(x, y, w, 5);
    o.fillStyle = '#6f4a2a';
    o.fillRect(x, y, w, 3);
    o.fillStyle = '#9a6c3e';
    o.fillRect(x, y, w, 1);
    o.fillStyle = '#24160e';
    for (let px = x + 9; px < x + w; px += 17) {
      o.fillRect(px, y + 5, 2, 4);
    }
  }

  drawPotion(o, x, y, color) {
    o.fillStyle = 'rgba(0, 0, 0, 0.3)';
    o.fillRect(x + 1, y + 8, 5, 2);
    o.fillStyle = '#d9c9a2';
    o.fillRect(x + 2, y, 3, 2);
    o.fillStyle = '#714c2a';
    o.fillRect(x + 2, y - 2, 3, 2);
    o.fillStyle = '#c9d6cc';
    o.fillRect(x + 1, y + 2, 5, 6);
    o.fillStyle = color;
    o.fillRect(x + 2, y + 4, 3, 3);
    o.fillStyle = 'rgba(255, 255, 255, 0.65)';
    o.fillRect(x + 2, y + 2, 1, 2);
  }

  drawPurpleColumn(o, x, y, w, h) {
    o.fillStyle = '#2b153d';
    o.fillRect(x - 1, y - 1, w + 2, h + 2);
    o.fillStyle = '#5a2d7a';
    o.fillRect(x, y, w, h);
    for (let row = 0; row < h; row += 8) {
      const offset = row % 16 === 0 ? 0 : 5;
      for (let col = -10; col < w; col += 10) {
        o.fillStyle = (row + col) % 20 === 0 ? '#7a45a2' : '#633386';
        o.fillRect(x + col + offset, y + row, 8, 6);
        o.fillStyle = 'rgba(210, 160, 255, 0.18)';
        o.fillRect(x + col + offset, y + row, 8, 1);
      }
    }
    o.fillStyle = 'rgba(0, 0, 0, 0.28)';
    o.fillRect(x + w - 2, y, 2, h);
  }

  drawPortal(o, x, y, time) {
    const pulse = 0.82 + Math.sin(time * 2.2) * 0.08;
    const glow = o.createRadialGradient(x, y, 0, x, y, 38);
    glow.addColorStop(0, 'rgba(96, 255, 70, 0.42)');
    glow.addColorStop(0.55, 'rgba(96, 255, 70, 0.14)');
    glow.addColorStop(1, 'rgba(96, 255, 70, 0)');
    o.fillStyle = glow;
    o.fillRect(x - 40, y - 44, 80, 88);
    o.fillStyle = '#0a1b08';
    o.beginPath();
    o.ellipse(x, y, 16 * pulse, 25 * pulse, 0, 0, TAU);
    o.fill();
    o.strokeStyle = '#72ff55';
    o.lineWidth = 2;
    o.beginPath();
    o.ellipse(x, y, 18 * pulse, 28 * pulse, 0, 0, TAU);
    o.stroke();
    o.strokeStyle = 'rgba(114, 255, 85, 0.35)';
    o.lineWidth = 1;
    o.beginPath();
    o.ellipse(x, y, 24 * pulse, 36 * pulse, 0, 0, TAU);
    o.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = i * (TAU / 8) + time * 0.3;
      o.fillStyle = i % 2 === 0 ? '#b6ff9b' : '#5cff47';
      o.fillRect(Math.round(x + Math.cos(angle) * 22), Math.round(y + Math.sin(angle) * 33), 1, 1);
    }
  }

  drawStaff(o, x, y, time) {
    o.strokeStyle = '#6f4a2a';
    o.lineWidth = 2;
    o.beginPath();
    o.moveTo(x - 10, y + 16);
    o.lineTo(x + 2, y - 10);
    o.stroke();
    o.fillStyle = '#ff8a3d';
    o.fillRect(x + 1, y - 12, 3, 3);
    o.fillStyle = '#ffd23d';
    o.fillRect(x + 3, y - 16, 2, 2);
    o.fillRect(x - 1, y - 17, 2, 2);
    o.fillRect(x + 5, y - 19, 2, 2);
    o.fillRect(x - 3, y - 13, 2, 2);
    if (Math.floor(time * 4) % 2 === 0) {
      o.fillStyle = 'rgba(255, 210, 61, 0.55)';
      o.fillRect(x + 3, y - 18, 1, 1);
      o.fillRect(x - 3, y - 11, 1, 1);
    }
  }

  drawDragon(o, x, y) {
    const green = '#55d943';

    o.fillStyle = 'rgba(0, 0, 0, 0.32)';
    o.beginPath();
    o.ellipse(x - 24, y + 5, 50, 3, 0, 0, TAU);
    o.fill();

    // Straight body, at least as thick as the head, with a stepped tail taper.
    o.fillStyle = green;
    o.fillRect(x - 58, y - 13, 62, 24);
    o.fillRect(x - 63, y - 11, 5, 20);
    o.fillRect(x - 68, y - 8, 5, 14);
    o.fillRect(x - 72, y - 4, 4, 8);

    // Head and snout.
    o.fillRect(x - 6, y - 20, 26, 24);
    o.fillRect(x + 20, y - 12, 6, 13);

    // Black square eye and mouth, as in the reference.
    o.fillStyle = '#071108';
    o.fillRect(x + 13, y - 12, 3, 3);
    o.fillRect(x + 16, y - 3, 9, 2);
    o.fillRect(x + 14, y - 5, 2, 2);

    // Wide-brimmed purple wizard hat.
    o.fillStyle = '#2b1a4a';
    o.fillRect(x - 8, y - 25, 38, 4);
    o.fillRect(x + 2, y - 34, 20, 9);
    o.fillRect(x + 5, y - 41, 14, 7);
    o.fillRect(x + 8, y - 46, 8, 5);
    o.fillStyle = '#5c3b91';
    o.fillRect(x + 4, y - 34, 16, 9);
    o.fillRect(x + 7, y - 41, 10, 7);
    o.fillRect(x + 9, y - 46, 6, 5);
    o.fillStyle = '#d6d24f';
    o.fillRect(x + 7, y - 30, 2, 2);
    o.fillRect(x + 14, y - 37, 2, 2);
    o.fillRect(x + 9, y - 43, 2, 2);
    o.fillRect(x + 6, y - 27, 1, 1);
    o.fillRect(x + 12, y - 25, 1, 1);
  }
}

/* ---------------------------------------------------------
   Quantum sphere
   --------------------------------------------------------- */
class QuantumScene extends Scene {
  setup() {
    this.latitudes = [];
    this.longitudes = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const line = [];
      const phi = (lat * Math.PI) / 180;
      for (let i = 0; i <= 72; i++) {
        const theta = (i / 72) * TAU;
        line.push({
          x: Math.cos(theta) * Math.cos(phi),
          y: Math.sin(phi),
          z: Math.sin(theta) * Math.cos(phi)
        });
      }
      this.latitudes.push(line);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const line = [];
      const theta = (lon * Math.PI) / 180;
      for (let i = 0; i <= 72; i++) {
        const phi = (i / 72) * TAU - Math.PI / 2;
        line.push({
          x: Math.cos(phi) * Math.cos(theta),
          y: Math.sin(phi),
          z: Math.cos(phi) * Math.sin(theta)
        });
      }
      this.longitudes.push(line);
    }
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createRadialGradient(w * 0.52, h * 0.46, 0, w * 0.52, h * 0.46, Math.min(w, h) * 0.65);
    bg.addColorStop(0, 'rgba(144, 112, 255, 0.1)');
    bg.addColorStop(0.5, 'rgba(85, 230, 210, 0.025)');
    bg.addColorStop(1, 'rgba(8, 9, 11, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.47;
    const cy = h * 0.48;
    const radius = Math.min(w, h) * 0.27;
    const rotY = time * 0.2 + (this.pointer.active ? (this.pointer.x - 0.5) * 0.7 : 0);
    const rotX = -0.3 + (this.pointer.active ? (this.pointer.y - 0.5) * 0.4 : 0);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    const project = (x, y, z) => {
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const perspective = 1 / (1 + z2 * 0.28);
      return { x: cx + x1 * radius * perspective, y: cy + y1 * radius * perspective, z: z2 };
    };

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.04)';
    ctx.lineWidth = 0.6;
    for (let ring = 0; ring < 5; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (1.08 + ring * 0.09), 0, TAU);
      ctx.stroke();
    }

    const drawLine = (line) => {
      ctx.beginPath();
      line.forEach((point, index) => {
        const p = project(point.x, point.y, point.z);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.beginPath();
      line.forEach((point, index) => {
        const p = project(point.x, point.y, point.z);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    };

    ctx.lineWidth = 0.7;
    this.latitudes.forEach((line) => {
      ctx.strokeStyle = 'rgba(85, 230, 210, 0.16)';
      drawLine(line);
    });
    this.longitudes.forEach((line) => {
      ctx.strokeStyle = 'rgba(144, 112, 255, 0.17)';
      drawLine(line);
    });

    ctx.strokeStyle = 'rgba(216, 255, 62, 0.22)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const tilt = i * 1.05 + time * 0.06;
      ctx.beginPath();
      for (let step = 0; step <= 80; step++) {
        const angle = (step / 80) * TAU;
        const x = Math.cos(angle) * 1.2;
        const z = Math.sin(angle) * 1.2;
        const y = Math.sin(angle * 2 + tilt) * 0.12;
        const p = project(x, y, z);
        if (step === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.7);
    centerGlow.addColorStop(0, 'rgba(216, 255, 62, 0.14)');
    centerGlow.addColorStop(0.45, 'rgba(144, 112, 255, 0.08)');
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = 'italic 56px "Instrument Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(242, 239, 230, 0.85)';
    ctx.fillText('ψ', cx, cy + 2);
    ctx.restore();

    const qAngle = time * 1.15;
    const q1 = project(Math.cos(qAngle) * 1.28, Math.sin(qAngle * 1.4) * 0.2, Math.sin(qAngle) * 1.28);
    const q2 = project(-Math.cos(qAngle) * 1.28, -Math.sin(qAngle * 1.4) * 0.2, -Math.sin(qAngle) * 1.28);

    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(216, 255, 62, 0.32)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    [q1, q2].forEach((q, index) => {
      const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 16);
      glow.addColorStop(0, index === 0 ? 'rgba(216, 255, 62, 0.55)' : 'rgba(255, 107, 61, 0.55)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = index === 0 ? '#d8ff3e' : '#ff6b3d';
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3, 0, TAU);
      ctx.fill();
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(242, 239, 230, 0.5)';
      ctx.fillText(index === 0 ? '|0⟩' : '|1⟩', q.x + 9, q.y + 12);
    });

    const key = (Math.floor(time * 0.55) * 2654435761 >>> 0).toString(16).toUpperCase().padStart(8, '0');
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(216, 255, 62, 0.7)';
    ctx.fillText(`KEY  0x${key.slice(0, 4)} ${key.slice(4, 8)}`, 17, 34);
    ctx.fillStyle = 'rgba(242, 239, 230, 0.35)';
    ctx.fillText('DECRYPTING 10 FILES', 17, 46);

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(17, 57);
    ctx.lineTo(w * 0.42, 57);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(216, 255, 62, 0.8)';
    ctx.beginPath();
    ctx.moveTo(17, 57);
    ctx.lineTo(17 + (w * 0.42 - 17) * (0.3 + 0.7 * ((Math.sin(time * 0.7) + 1) / 2)), 57);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.16)';
    ctx.lineWidth = 0.8;
    const corner = 14;
    [[16, 16, 1, 1], [w - 16, 16, -1, 1], [16, h - 16, 1, -1], [w - 16, h - 16, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x + sx * corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * corner);
      ctx.stroke();
    });
  }
}

/* ---------------------------------------------------------
   Audio / spectrum
   --------------------------------------------------------- */
class AudioScene extends Scene {
  setup() {
    this.notes = ['♪', '♫', '♩', '♬'];
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#151021');
    bg.addColorStop(0.45, '#0b0e15');
    bg.addColorStop(1, '#101a17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const halo = ctx.createRadialGradient(w * 0.38, h * 0.48, 0, w * 0.38, h * 0.48, w * 0.55);
    halo.addColorStop(0, 'rgba(255, 107, 61, 0.13)');
    halo.addColorStop(0.5, 'rgba(144, 112, 255, 0.05)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(242, 239, 230, 0.07)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) {
      const y = h * 0.34 + i * 13;
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(w - 24, y);
      ctx.stroke();
    }

    const amplitude = (this.pointer.active ? 0.6 + this.pointer.y * 0.8 : 1) * 22;
    const waves = [
      { color: 'rgba(216, 255, 62, 0.85)', width: 1.5, speed: 1.1, phase: 0 },
      { color: 'rgba(255, 107, 61, 0.55)', width: 1, speed: 0.75, phase: 1.7 },
      { color: 'rgba(144, 112, 255, 0.45)', width: 0.8, speed: 1.45, phase: 3.2 }
    ];
    waves.forEach((wave) => {
      ctx.beginPath();
      for (let x = 24; x <= w - 24; x += 3) {
        const p = (x - 24) / (w - 48);
        const y = h * 0.45 + Math.sin(p * 18 + time * wave.speed + wave.phase) * amplitude * Math.sin(p * Math.PI) * (0.45 + 0.55 * Math.sin(p * 7 + time));
        if (x === 24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = wave.width;
      ctx.stroke();
    });

    const bars = Math.max(38, Math.floor(w / 9));
    const barW = (w - 48) / bars;
    for (let i = 0; i < bars; i++) {
      const p = i / bars;
      const envelope = Math.sin(p * Math.PI);
      const value = (Math.sin(time * 2.4 + i * 0.48) + Math.sin(time * 1.3 + i * 0.19) + 2.1) / 4.2;
      const barH = 4 + value * envelope * (h * 0.18 + amplitude * 1.4);
      const x = 24 + i * barW;
      const y = h * 0.63 - barH;
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, 'rgba(216, 255, 62, 0.8)');
      grad.addColorStop(0.55, 'rgba(85, 230, 210, 0.45)');
      grad.addColorStop(1, 'rgba(144, 112, 255, 0.06)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, Math.max(1, barW - 2), barH);
    }

    this.notes.forEach((note, index) => {
      const p = (time * 0.055 + index * 0.137) % 1;
      const x = w * (0.1 + ((index * 0.173) % 0.8)) + Math.sin(time * 0.55 + index) * 12;
      const y = h * 0.72 - p * h * 0.58;
      ctx.font = `${10 + (index % 3) * 5}px "Instrument Serif", Georgia, serif`;
      ctx.fillStyle = `rgba(216, 255, 62, ${0.18 + (1 - p) * 0.45})`;
      ctx.fillText(note, x, y);
    });

    const keys = 15;
    const pianoY = h - 48;
    const keyW = (w - 48) / keys;
    for (let i = 0; i < keys; i++) {
      const x = 24 + i * keyW;
      const active = (Math.floor(time * 3.2) % keys) === i;
      ctx.fillStyle = active ? 'rgba(216, 255, 62, 0.8)' : 'rgba(242, 239, 230, 0.11)';
      ctx.fillRect(x, pianoY, Math.max(1, keyW - 2), 34);
      ctx.strokeStyle = 'rgba(8, 9, 11, 0.45)';
      ctx.strokeRect(x, pianoY, Math.max(1, keyW - 2), 34);
      if ([0, 2, 4, 5, 7, 9, 11].includes(i % 12)) {
        ctx.fillStyle = active ? 'rgba(8, 9, 11, 0.8)' : 'rgba(8, 9, 11, 0.88)';
        ctx.fillRect(x + keyW * 0.65, pianoY, Math.max(2, keyW * 0.5), 21);
      }
    }

    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(242, 239, 230, 0.35)';
    ctx.fillText('ASTRALNOTE / 44.1 KHZ', 24, h - 63);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(216, 255, 62, 0.7)';
    ctx.fillText('LIVE', w - 24, h - 63);
    ctx.textAlign = 'left';
  }
}

/* ---------------------------------------------------------
   helpers for canvas
   --------------------------------------------------------- */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
function boot() {
  initPreloader();
  initNavigation();
  splitHeroType();
  initReveals();
  initCursor();
  initMagnetic();
  initTilt();
  initClock();
  initCopyEmail();
  initMarquee();
  initSkillGlow();
  initSoundToggle();
  initPiano();

  const bgCanvas = $('#bg-canvas');
  if (bgCanvas) {
    const background = new BackgroundScene(bgCanvas);
    ticker.add((dt, time) => background.draw(time, dt));
  }

  const orbCanvas = $('#orb-canvas');
  if (orbCanvas) observeScene(new OrbScene(orbCanvas));
  const fractalCanvas = $('#fractal-canvas');
  if (fractalCanvas) observeScene(new FractalScene(fractalCanvas));
  const campusCanvas = $('#campus-canvas');
  if (campusCanvas) observeScene(new CampusScene(campusCanvas));
  const pixelCanvas = $('#pixel-canvas');
  if (pixelCanvas) observeScene(new PixelScene(pixelCanvas));
  const quantumCanvas = $('#quantum-canvas');
  if (quantumCanvas) observeScene(new QuantumScene(quantumCanvas));
  const audioCanvas = $('#audio-canvas');
  if (audioCanvas) observeScene(new AudioScene(audioCanvas));

  ticker.start();

  if (prefersReduced) {
    body.classList.add('is-loaded');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
