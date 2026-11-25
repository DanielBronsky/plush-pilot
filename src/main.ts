import { Application } from 'pixi.js';
import { App } from './app';
import { AudioManager } from './audio/audio';
import { CONFIG } from './config';
import { devLog } from './log';
import { choosePlatform } from './platform/choose';
import { loadSave } from './platform/storage';

function setProgress(k: number): void {
  const el = document.getElementById('boot-fill');
  if (el) el.style.width = `${Math.round(k * 100)}%`;
}

async function boot(): Promise<void> {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  setProgress(0.05);
  const platform = await choosePlatform(location.search, import.meta.env.DEV);
  await platform.init();
  platform.loadingStart();
  setProgress(0.3);
  const pixi = new Application();
  await pixi.init({
    resizeTo: window,
    resolution: Math.min(window.devicePixelRatio || 1, CONFIG.render.maxResolution),
    autoDensity: true,
    antialias: true,
    background: '#7cc46a',
    preference: 'webgl',
  });
  setProgress(0.8);
  const save = loadSave(platform);
  const audio = new AudioManager();
  document.body.appendChild(pixi.canvas);
  const app = new App(pixi, platform, audio, save);
  app.start();
  app.layout();
  setProgress(1);
  platform.loadingStop();
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    bootEl.style.opacity = '0';
    setTimeout(() => bootEl.remove(), 300);
  }
  if (import.meta.env.DEV) Object.assign(window, { __app: app });
}

boot().catch((e: unknown) => {
  const el = document.getElementById('boot');
  if (el)
    el.innerHTML =
      '<div style="font:700 18px system-ui;color:#fff;text-align:center;padding:20px">Something went wrong. Please reload the page.</div>';
  devLog('boot', 'fatal', e);
});
