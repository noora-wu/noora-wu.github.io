(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 顶栏：浮在 hero 上时保持透明，离开首屏后切换为毛玻璃实底
  // 内页没有 hero，顶栏保持实底，不参与滚动切换
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  if (header && hero) {
    const solidFrom = () => hero.offsetHeight - header.offsetHeight * 1.5;
    const updateHeader = () => {
      header.classList.toggle('is-solid', window.scrollY > solidFrom());
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    window.addEventListener('resize', updateHeader);
  } else if (header) {
    header.classList.add('is-solid');
  }

  // hero 身份词轮播
  const rotator = document.querySelector('.hero-rotator');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rotator && !reduceMotion) {
    const items = Array.from(rotator.querySelectorAll('.hero-rotator__item'));
    if (items.length > 1) {
      let index = 0;
      setInterval(() => {
        items[index].classList.remove('is-active');
        index = (index + 1) % items.length;
        items[index].classList.add('is-active');
      }, 2400);
    }
  }

  // 手札列表页：按分类筛选 + 顶部计数
  const postList = document.querySelector('.post-list');
  if (postList) {
    const posts = Array.from(postList.querySelectorAll('.post-item'));
    const chips = Array.from(document.querySelectorAll('.filter-chip'));
    const emptyHint = document.querySelector('.filter-empty');

    const applyFilter = (value) => {
      let visible = 0;
      posts.forEach((post) => {
        const match = value === 'all' || post.dataset.category === value;
        post.hidden = !match;
        if (match) visible += 1;
      });
      chips.forEach((chip) => {
        chip.classList.toggle('is-active', chip.dataset.filter === value);
      });
      if (emptyHint) emptyHint.hidden = visible > 0;
    };

    document.querySelectorAll('[data-filter]').forEach((control) => {
      control.addEventListener('click', () => applyFilter(control.dataset.filter));
    });

    const countOf = (selector) => posts.filter((p) => p.matches(selector)).length;
    const stats = {
      published: countOf(':not(.post-item--draft)'),
      draft: countOf('.post-item--draft'),
    };
    Object.entries(stats).forEach(([key, value]) => {
      const target = document.querySelector(`[data-stat="${key}"]`);
      if (target) target.textContent = value;
    });
  }

  // 正文内嵌的 Mastermind：按需加载，避免拖慢其他页面
  if (document.querySelector('[data-mastermind]')) {
    const main = document.querySelector('script[src*="main.js"]');
    const script = document.createElement('script');
    const baseSrc = (main && main.src)
      ? main.src.replace(/main\.js(?:\?.*)?$/, 'mastermind.js')
      : 'js/mastermind.js';
    script.src = baseSrc.includes('?') ? baseSrc : `${baseSrc}?v=3`;
    document.body.appendChild(script);
  }
})();
