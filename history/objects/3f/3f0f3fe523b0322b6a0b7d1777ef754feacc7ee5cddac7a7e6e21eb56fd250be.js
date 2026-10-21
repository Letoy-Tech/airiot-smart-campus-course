// 阅读页交互：桌面目录展开、当前位置、窄屏抽屉目录与代码复制。脚本失效时，页面仍可按锚点阅读。
(function () {
  var desktop = window.matchMedia('(min-width:901px)');
  var wide = window.matchMedia('(min-width:1280px)');
  var root = document.documentElement;
  var main = document.getElementById('book-main');
  var side = document.getElementById('book-side');
  var toc = document.querySelector('.main-toc');
  var outline = document.querySelector('.side-outline');
  var fab = document.querySelector('.back-to-top');
  var fabWhere = fab && fab.querySelector('.fab-where');
  var backdrop = document.querySelector('.drawer-backdrop');
  var closer = document.querySelector('.drawer-close');
  var bar = document.querySelector('.reading-progress span');
  var list = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };
  var idOf = function (a) { return decodeURIComponent(a.getAttribute('href').slice(1)); };

  // 桌面默认展开目录与本章定位；读者自己点过的折叠状态不再被覆盖。
  var autoOpen = list('[data-desktop-open]');
  autoOpen.forEach(function (el) {
    el.querySelector('summary').addEventListener('click', function () { el.setAttribute('data-user-toggled', ''); });
  });
  function applyDesktopOpen() {
    autoOpen.forEach(function (el) { if (!el.hasAttribute('data-user-toggled')) el.open = desktop.matches; });
  }
  applyDesktopOpen();

  function openAncestors(target) {
    for (var p = target.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    if (target.tagName === 'DETAILS') target.open = true;
  }

  function scroller(el) {
    for (var p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      var y = getComputedStyle(p).overflowY;
      if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  // 只滚动侧栏自身，不带动正文位置。
  function keepVisible(el) {
    var box = scroller(el);
    if (!box) return;
    var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 12) box.scrollTop -= b.top + 12 - r.top + 48;
    else if (r.bottom > b.bottom - 12) box.scrollTop += r.bottom - b.bottom + 12 + 48;
  }

  // 窄屏抽屉：沿用页首目录本身，打开时补偿它离开文档流造成的位移。
  var drawerOpen = false, shift = 0, tocWasOpen = false, lastFocus = null;
  // Chrome 会自动做滚动锚定，Safari 不会；切换期间关闭锚定，统一手动补偿。
  function toggleLayout(apply, delta) {
    root.style.overflowAnchor = 'none';
    apply();
    if (delta) window.scrollBy(0, delta);
    window.requestAnimationFrame(function () { root.style.overflowAnchor = ''; });
  }
  function openDrawer(targetId) {
    if (drawerOpen || desktop.matches || !side) return;
    var rect = side.getBoundingClientRect();
    shift = rect.bottom < 0 ? side.offsetHeight + parseFloat(getComputedStyle(side).marginBottom || '0') : 0;
    tocWasOpen = toc.open;
    lastFocus = document.activeElement;
    drawerOpen = true;
    toggleLayout(function () { root.classList.add('drawer-open'); }, -shift);
    toc.open = true;
    var target = targetId && document.getElementById(targetId);
    if (target && target.tagName === 'DETAILS') target.open = true;
    if (main) main.inert = true;
    backdrop.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    side.scrollTop = 0;
    var current = side.querySelector('.book-nav [aria-current]');
    if (target && target.tagName === 'DETAILS') side.scrollTop += target.getBoundingClientRect().top - side.getBoundingClientRect().top - 8;
    else if (current) keepVisible(current);
    (closer || side).focus({ preventScroll: true });
  }
  function closeDrawer(navigating) {
    if (!drawerOpen) return;
    drawerOpen = false;
    toc.open = tocWasOpen;
    toggleLayout(function () { root.classList.remove('drawer-open'); }, navigating ? 0 : shift);
    if (main) main.inert = false;
    backdrop.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    if (!navigating && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  // 桌面侧栏常驻：返回目录只展开并聚焦侧栏，不把正文滚回页首。
  function revealInSide(id) {
    var target = document.getElementById(id);
    if (!target) return;
    var box = target.tagName === 'DETAILS' ? target : toc;
    box.open = true;
    var focus = box.querySelector('[aria-current]') || box.querySelector('summary');
    keepVisible(focus);
    focus.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (event) {
    var copy = event.target.closest && event.target.closest('.copy-code');
    if (copy) return copyCode(copy);
    if (event.target === backdrop || (closer && event.target.closest && event.target.closest('.drawer-close'))) return closeDrawer();
    var a = event.target.closest && event.target.closest('a[href^="#"]');
    if (!a) return;
    var id = idOf(a);
    if (a === fab || id === 'contents' || id === 'resource-contents') {
      event.preventDefault();
      if (desktop.matches) revealInSide(id === 'resource-contents' ? id : 'contents');
      else if (drawerOpen) closeDrawer();
      else openDrawer(id);
      return;
    }
    if (drawerOpen && side.contains(a)) closeDrawer(true);
    var target = document.getElementById(id);
    if (target) openAncestors(target);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && drawerOpen) closeDrawer();
    if (event.key === ' ' && event.target === fab) { event.preventDefault(); fab.click(); }
  });

  // 当前位置：目录高亮、章内小节、阅读进度和窄屏按钮标签。
  var sections = list('#book-main > section');
  var tocLinks = {};
  list('.book-nav a[href^="#"]').forEach(function (a) { tocLinks[idOf(a)] = a; });
  var sectionTops = [], current = null, headings = [], headingTops = [], outlineLinks = [], activeLink = null, ticking = false;
  var topOf = function (el) { return el.getBoundingClientRect().top + window.pageYOffset; };
  var sectionId = function (s) { var h = s.querySelector('h1[id]'); return h ? h.id : s.id; };
  function lastAtOrBefore(tops, y) {
    var lo = 0, hi = tops.length - 1, found = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (tops[mid] <= y) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    return found;
  }
  function setSection(s) {
    var old = current && tocLinks[sectionId(current)];
    if (old) old.removeAttribute('aria-current');
    current = s;
    activeLink = null;
    headings = []; outlineLinks = [];
    if (fabWhere) fabWhere.textContent = s && s.getAttribute('data-short') || '';
    if (outline) outline.hidden = true;
    if (!s) return;
    var link = tocLinks[sectionId(s)];
    if (link) { link.setAttribute('aria-current', 'location'); if (desktop.matches || drawerOpen) keepVisible(link); }
    if (!outline) return;
    // 宽屏右栏列出二、三级标题；侧栏下方和抽屉只列二级标题。
    headings = list(wide.matches ? 'h2[id], h3[id]' : 'h2[id]', s);
    if (headings.length > 45) headings = headings.filter(function (h) { return h.tagName === 'H2'; });
    if (headings.length < 2) { headings = []; return; }
    var items = headings.map(function (h) {
      return '<li class="outline-' + h.tagName.toLowerCase() + '"><a href="#' + encodeURIComponent(h.id) + '"></a></li>';
    }).join('');
    outline.innerHTML = '<p class="outline-kicker">当前阅读</p><a class="outline-current" href="#' + encodeURIComponent(sectionId(s)) + '"></a><ol>' + items + '</ol>';
    outline.querySelector('.outline-current').textContent = s.getAttribute('data-title') || '';
    outlineLinks = list('ol a', outline);
    outlineLinks.forEach(function (a, i) { a.textContent = headings[i].textContent; });
    headingTops = headings.map(topOf);
    outline.hidden = false;
  }
  function update() {
    ticking = false;
    var y = window.pageYOffset + Math.min(120, window.innerHeight * 0.2);
    var i = lastAtOrBefore(sectionTops, y);
    var s = i >= 0 ? sections[i] : null;
    if (s !== current) setSection(s);
    if (!s) { if (bar) bar.style.width = '0'; return; }
    var link = outlineLinks[lastAtOrBefore(headingTops, y)] || null;
    if (link !== activeLink) {
      if (activeLink) activeLink.removeAttribute('aria-current');
      activeLink = link;
      if (link) { link.setAttribute('aria-current', 'location'); if (desktop.matches || drawerOpen) keepVisible(link); }
    }
    if (bar) {
      var p = (window.pageYOffset + window.innerHeight - sectionTops[i]) / Math.max(1, s.offsetHeight);
      bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
    }
  }
  function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  function measure() {
    sectionTops = sections.map(topOf);
    headingTops = headings.map(topOf);
    schedule();
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (window.ResizeObserver && main) new ResizeObserver(function () { window.requestAnimationFrame(measure); }).observe(main);
  if (desktop.addEventListener) desktop.addEventListener('change', function () { closeDrawer(); applyDesktopOpen(); measure(); });
  if (wide.addEventListener) wide.addEventListener('change', function () { var s = current; setSection(null); setSection(s); measure(); });
  measure();

  // 可复制的提示词与代码：复制原文，不含标签与按钮文字。
  list('.copy-code').forEach(function (b) { b.hidden = false; });
  function copyCode(button) {
    var text = button.closest('.code-example').querySelector('pre code').textContent.replace(/\n$/, '');
    var done = function (ok) {
      button.textContent = ok ? '已复制' : '请手动选择复制';
      clearTimeout(button._reset);
      button._reset = setTimeout(function () { button.textContent = '复制'; }, 1800);
    };
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      done(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
})();
