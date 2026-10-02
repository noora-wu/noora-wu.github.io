// 项目作品页：分类标签筛选（淡出 → 切换 → 淡入）
(function () {
  const stage = document.querySelector('[data-project-stage]');
  if (!stage) return;
  const tabs = Array.from(document.querySelectorAll('.project-tab'));
  const cards = Array.from(stage.querySelectorAll('.project-card'));
  const empty = stage.querySelector('.project-empty');
  const grid = stage.querySelector('.project-grid');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null;

  const show = (cat) => {
    let visible = 0;
    cards.forEach((card) => {
      const match = cat === 'all' || card.dataset.cat === cat;
      card.hidden = !match;
      if (match) visible += 1;
    });
    grid.hidden = visible === 0;
    empty.hidden = visible !== 0;
  };

  const select = (cat, animate) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.cat === cat;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    clearTimeout(timer);
    if (!animate || reduce) {
      show(cat);
      return;
    }
    stage.classList.add('is-fading');
    timer = setTimeout(() => {
      show(cat);
      stage.classList.remove('is-fading');
    }, 180);
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      select(tab.dataset.cat, true);
      history.replaceState(null, '', tab.dataset.cat === 'all' ? location.pathname : '#' + tab.dataset.cat);
    });
  });

  // 支持 projects.html#web 这样的链接直接打开某个分类
  const initial = location.hash.slice(1);
  if (initial && tabs.some((t) => t.dataset.cat === initial)) select(initial, false);
})();
