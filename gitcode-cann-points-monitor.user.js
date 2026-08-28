// ==UserScript==
// @name         GitCode CANN Points Monitor
// @namespace    https://github.com/KaranocaVe/gitcode-cann-points-monitor
// @version      1.1.0
// @description  Show and monitor your CANN exclusive points with rate-limited checks.
// @author       KaranocaVe
// @match        https://gitcode.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/KaranocaVe/gitcode-cann-points-monitor/main/gitcode-cann-points-monitor.user.js
// @updateURL    https://raw.githubusercontent.com/KaranocaVe/gitcode-cann-points-monitor/main/gitcode-cann-points-monitor.user.js
// ==/UserScript==

(async () => {
  'use strict';

  const SETTINGS_KEY = 'settings';
  const LAST_CHECKED_AT_KEY = 'lastCheckedAt';
  const LAST_POINTS_KEY = 'lastPoints';
  const DEFAULT_INTERVAL_MINUTES = 30;
  const POINTS_SELECTOR = '.cann-score-card__value';
  const CANN_LABEL = 'CANN Exclusive Points';
  const HEADER_BADGE_ID = 'gitcode-cann-points-monitor-badge';
  const CANN_POINTS_URL = 'https://gitcode.com/setting/points?type=shop&tid=cann';

  const isCannPointsPage = () =>
    location.pathname === '/setting/points' &&
    new URLSearchParams(location.search).get('tid') === 'cann';

  const normalizeSettings = (settings) => ({
    intervalMinutes: Math.max(1, Number(settings?.intervalMinutes) || DEFAULT_INTERVAL_MINUTES),
  });

  const formatPoints = (points) => Number(points).toLocaleString('en-US');

  function placeHeaderBadge(points, checkedAt) {
    const existing = document.getElementById(HEADER_BADGE_ID);
    if (existing) {
      existing.querySelector('[data-cann-points-value]').textContent = formatPoints(points);
      existing.title = `CANN points: ${formatPoints(points)}\nLast checked: ${new Date(checkedAt).toLocaleString()}`;
      return true;
    }

    const header = document.querySelector(
      'header, .gc-base-header, .gc-base-layout-header, [class*="layout-header"]',
    );
    if (!header) return false;

    const host = header.querySelector(
      '.g-toolbar-right, .gc-base-header-right, .header-right, [class*="header-right"], [class*="headerRight"]',
    ) || header;
    const badge = document.createElement('a');
    badge.id = HEADER_BADGE_ID;
    badge.href = CANN_POINTS_URL;
    badge.target = '_self';
    badge.title = `CANN points: ${formatPoints(points)}\nLast checked: ${new Date(checkedAt).toLocaleString()}`;
    badge.setAttribute('aria-label', `CANN points: ${formatPoints(points)}`);
    Object.assign(badge.style, {
      alignItems: 'center',
      background: 'linear-gradient(135deg, #fff4e5, #ffe0b2)',
      border: '1px solid #ffb74d',
      borderRadius: '999px',
      color: '#9a4b00',
      display: 'inline-flex',
      fontSize: '12px',
      fontWeight: '600',
      gap: '5px',
      lineHeight: '20px',
      margin: '0 10px',
      padding: '2px 9px',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    });
    badge.innerHTML = 'CANN 积分 <span data-cann-points-value></span>';
    badge.querySelector('[data-cann-points-value]').textContent = formatPoints(points);
    const avatar = host.querySelector('.g-user-avatar');
    if (avatar) avatar.before(badge);
    else host.append(badge);
    return true;
  }

  function showHeaderBadge(points, checkedAt) {
    if (points === null || points === undefined) return;
    if (placeHeaderBadge(points, checkedAt)) return;

    const observer = new MutationObserver(() => {
      if (placeHeaderBadge(points, checkedAt)) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15_000);
  }

  function extractCannPoints() {
    // Confirm the value belongs to the CANN card before using the stable value selector.
    for (const valueNode of document.querySelectorAll(POINTS_SELECTOR)) {
      const card = valueNode.closest('.cann-score-card__info, .cann-score-card');
      if (card?.textContent?.includes(CANN_LABEL)) {
        const points = Number(valueNode.textContent.replace(/[^0-9]/g, ''));
        if (Number.isSafeInteger(points)) return points;
      }
    }

    // A label-based fallback keeps the monitor usable if GitCode renames CSS classes.
    const label = [...document.querySelectorAll('span, div, p')].find(
      (node) => node.childElementCount === 0 && node.textContent.trim() === CANN_LABEL,
    );
    for (let card = label?.parentElement; card; card = card.parentElement) {
      const valueText = card.querySelector('[class*="value"]')?.textContent;
      const points = Number(valueText?.replace(/[^0-9]/g, ''));
      if (Number.isSafeInteger(points)) return points;
    }
    return null;
  }

  async function waitForCannPoints(timeoutMs = 15_000) {
    const immediate = extractCannPoints();
    if (immediate !== null) return immediate;

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const points = extractCannPoints();
        if (points !== null) finish(points);
      });
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      const finish = (points) => {
        observer.disconnect();
        window.clearTimeout(timer);
        resolve(points);
      };
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
  }

  async function notifyChange(previous, current) {
    const delta = current - previous;
    const direction = delta > 0 ? 'increased' : 'decreased';
    await GM_notification({
      title: 'GitCode CANN points changed',
      text: `${formatPoints(previous)} → ${formatPoints(current)} (${direction} ${formatPoints(Math.abs(delta))})`,
      timeout: 12_000,
    });
  }

  async function check({ force = false, source = 'page visit' } = {}) {
    if (!isCannPointsPage()) return { status: 'wrong-page' };

    const settings = normalizeSettings(await GM_getValue(SETTINGS_KEY, {}));
    const lastCheckedAt = Number(await GM_getValue(LAST_CHECKED_AT_KEY, 0));
    const intervalMs = settings.intervalMinutes * 60_000;
    if (!force && Date.now() - lastCheckedAt < intervalMs) {
      const remainingMinutes = Math.ceil((intervalMs - (Date.now() - lastCheckedAt)) / 60_000);
      console.info(`[CANN points monitor] Skipped ${source}; next check in about ${remainingMinutes} minute(s).`);
      return { status: 'throttled' };
    }

    const current = await waitForCannPoints();
    if (current === null) {
      console.warn('[CANN points monitor] CANN points were not found; leaving the last successful check unchanged.');
      return { status: 'not-found' };
    }

    const previous = await GM_getValue(LAST_POINTS_KEY, null);
    await GM_setValue(LAST_POINTS_KEY, current);
    const checkedAt = Date.now();
    await GM_setValue(LAST_CHECKED_AT_KEY, checkedAt);
    showHeaderBadge(current, checkedAt);

    if (previous !== null && Number(previous) !== current) {
      await notifyChange(Number(previous), current);
      console.info(`[CANN points monitor] Change detected: ${previous} -> ${current}.`);
      return { status: 'changed', previous: Number(previous), current };
    }

    console.info(`[CANN points monitor] ${previous === null ? 'Baseline saved' : 'No change'}: ${current}.`);
    return { status: previous === null ? 'baseline' : 'unchanged', current };
  }

  GM_registerMenuCommand('Check CANN points now', () => check({ force: true, source: 'manual check' }));
  GM_registerMenuCommand('Set check interval', async () => {
    const current = normalizeSettings(await GM_getValue(SETTINGS_KEY, {}));
    const answer = window.prompt('Check CANN points no more often than every how many minutes?', current.intervalMinutes);
    if (answer === null) return;
    const intervalMinutes = Number(answer);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) {
      window.alert('Please enter a whole number of at least 1 minute.');
      return;
    }
    await GM_setValue(SETTINGS_KEY, { intervalMinutes: Math.floor(intervalMinutes) });
    window.alert(`CANN points will be checked at most once every ${Math.floor(intervalMinutes)} minute(s) when the CANN points page is visited.`);
  });

  const cachedPoints = await GM_getValue(LAST_POINTS_KEY, null);
  const cachedCheckedAt = Number(await GM_getValue(LAST_CHECKED_AT_KEY, 0));
  showHeaderBadge(cachedPoints, cachedCheckedAt);
  await check();
})();
