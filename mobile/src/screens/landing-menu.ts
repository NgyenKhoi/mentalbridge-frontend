const rows = [
  [
    '/community',
    'Cộng đồng &amp; Sẻ chia',
    'Không gian an toàn trao gửi tâm sự',
    '<path d="M8 20v-2a4 4 0 0 1 8 0v2M3 20v-2a3 3 0 0 1 4-3m14 5v-2a3 3 0 0 0-4-3M3 20h18"/><circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/>',
  ],
  [
    '#journey',
    'Hành trình hồi phục',
    'Theo dõi biểu đồ cảm xúc từng ngày',
    '<rect x="3" y="13" width="6" height="8" rx="2"/><rect x="9" y="9" width="6" height="12" rx="2"/><rect x="15" y="4" width="6" height="17" rx="2"/>',
  ],
  [
    '#features',
    'Tính năng &amp; Bài tập thở',
    'Thư viện thiền định &amp; viết nhật ký',
    '<path d="m13 3 2.3 6.7L22 12l-6.7 2.3L13 21l-2.3-6.7L4 12l6.7-2.3L13 3ZM4 3v5M1.5 5.5h5M4 16v5m-2.5-2.5h5"/>',
  ],
  [
    '#risk',
    'Cách đọc kết quả',
    'Hiểu đúng chỉ số PHQ-9 &amp; GAD-7',
    '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  ],
] as const

const menu = `
  <section class="mb-sheet" data-lenis-prevent>
    <div class="mb-grip" aria-hidden="true"></div>
    <header class="mb-sheet-heading">
      <h2 id="mb-sheet-title">Danh mục MentalBridge</h2>
      <button type="button" data-dismiss aria-label="Đóng menu" autofocus>×</button>
    </header>
    <nav class="mb-sheet-links" aria-label="Danh mục">
      ${rows
        .map(
          ([href, title, subtitle, path]) => `
        <a href="${href}">
          <span class="mb-sheet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>
          </span>
          <span class="mb-sheet-copy"><strong>${title}</strong><small>${subtitle}</small></span>
          <span class="mb-chevron" aria-hidden="true"></span>
        </a>`,
        )
        .join('')}
    </nav>
    <div class="mb-sheet-actions">
      <div class="mb-actions-row">
        <a class="mb-support" href="/safety-directory">Cần hỗ trợ ngay</a>
        <a class="mb-login" href="/login">Đăng nhập</a>
      </div>
      <a class="mb-start" href="/register">Bắt đầu miễn phí <span aria-hidden="true">→</span></a>
    </div>
  </section>
`

const styles = `
  #mb-landing-menu {
    position: fixed; inset: auto 0 0; margin: 0 auto; padding: 0;
    width: min(100%, 560px); max-width: 100%;
    max-height: calc(100dvh - 12px); overflow: auto; overscroll-behavior: contain;
    border: 0; border-radius: 32px 32px 0 0; background: #fff;
    color: #19241e; box-shadow: 0 -12px 48px #132c231c;
    font-family: var(--font-be-vietnam, system-ui), sans-serif;
  }
  #mb-landing-menu::backdrop { background: #25312a66; backdrop-filter: blur(4px); }
  #mb-landing-menu[open] { animation: mb-sheet-enter .24s cubic-bezier(.2,.75,.25,1); }
  @keyframes mb-sheet-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @media(prefers-reduced-motion: reduce) { #mb-landing-menu[open] { animation: none; } }
  #mb-landing-menu .mb-sheet { padding: 16px clamp(18px, 6vw, 28px) max(24px, env(safe-area-inset-bottom)); }
  #mb-landing-menu .mb-grip { width: 46px; height: 5px; border-radius: 6px; background: #d1d2ce; margin: 0 auto 10px; }
  #mb-landing-menu .mb-sheet-heading { display:flex; align-items:center; justify-content:space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid #edf0ec; }
  #mb-landing-menu h2 { display:flex; align-items:center; gap: 8px; margin:0; color:#59635b; font: inherit; font-size: .75rem; font-weight: 650; letter-spacing:.06em; text-transform:uppercase; }
  #mb-landing-menu h2::before, #mb-landing-menu .mb-support::before { content:''; width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:#285b48; }
  #mb-landing-menu button { flex:0 0 44px; height:44px; border:0; border-radius:50%; background:#f5f6f3; font: inherit; font-size:1.5rem; color:#5e685e; cursor:pointer; }
  #mb-landing-menu .mb-sheet-links { padding: 6px 0 12px; display:block; }
  #mb-landing-menu a { color: inherit; text-decoration:none; }
  #mb-landing-menu .mb-sheet-links a { display:grid; grid-template-columns:44px minmax(0,1fr) 12px; align-items:center; gap:12px; padding: 11px 4px; min-height:64px; border-bottom:1px solid #f2f4f0; }
  #mb-landing-menu .mb-sheet-links a:last-child { border-bottom:0; }
  #mb-landing-menu .mb-sheet-icon { display:grid; place-items:center; width:44px; height:44px; border-radius:15px; background:#eff8f1; color:#285b48; }
  #mb-landing-menu svg { width:30px; height:30px; }
  #mb-landing-menu .mb-sheet-copy { display:grid; gap:3px; overflow-wrap:anywhere; line-height:1.3; }
  #mb-landing-menu strong { font-size:.95rem; font-weight:650; }
  #mb-landing-menu small { font-size:.75rem; color:#646f65; }
  #mb-landing-menu .mb-chevron { width:7px; height:7px; border-top:1.5px solid #98a59b; border-right:1.5px solid #98a59b; transform:rotate(45deg); }
  #mb-landing-menu .mb-sheet-actions { display:grid; gap:10px; padding-top:14px; border-top:1px solid #edf0ec; }
  #mb-landing-menu .mb-actions-row { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(min(100%, 133px),1fr)); }
  #mb-landing-menu .mb-sheet-actions a { display:flex; justify-content:center; align-items:center; gap:7px; text-align:center; padding:9px; min-height:44px; border:1px solid #dfe5df; border-radius:16px; font-size:.85rem; font-weight:650; }
  #mb-landing-menu .mb-sheet-actions .mb-support { background:#fff5f6; border-color:#efcbd3; color:#a92143; }
  #mb-landing-menu .mb-support::before { background:#d83562; }
  #mb-landing-menu .mb-sheet-actions .mb-start { min-height:51px; background:#285743; color:#fff; border-color:#285743; font-size:1rem; box-shadow:0 7px 20px #28574328; }
  #mb-landing-menu a:active { opacity:.7; }
  #mb-landing-menu :focus-visible { outline:2px solid #285743; outline-offset:2px; }
`

export const installLandingMenu = `
  if (!document.getElementById('mb-landing-menu') &&
      document.querySelector('.marketing-page') &&
      typeof HTMLDialogElement !== 'undefined' &&
      typeof HTMLDialogElement.prototype.showModal === 'function') {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(styles)};
    document.head.appendChild(style);
    const dialog = document.createElement('dialog');
    dialog.id = 'mb-landing-menu';
    dialog.setAttribute('aria-labelledby', 'mb-sheet-title');
    dialog.innerHTML = ${JSON.stringify(menu)};
    document.body.appendChild(dialog);
    let trigger;
    dialog.addEventListener('close', () => {
      document.body.classList.remove('menu-open');
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.focus({ preventScroll: true });
      window.ReactNativeWebView.postMessage('mentalbridge:menu:closed');
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest?.('[data-dismiss], a[href]')) dialog.close();
    });
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('.marketing-header .nav-menu-btn');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      trigger = button;
      button.setAttribute('aria-controls', dialog.id);
      button.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      dialog.showModal();
      window.ReactNativeWebView.postMessage('mentalbridge:menu:opened');
    }, true);
  }
`
