(function () {
  // 首页专用的交互：滚动浮现、照片视差倾斜、入口卡光晕。全部是渐进增强，没有 JS 时内容照常显示。
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 1) 滚动浮现：IntersectionObserver 给 [data-reveal] 加 .is-in，延迟由 style="--d:n" 控制
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce && revealEls.length) {
    document.documentElement.classList.add('has-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  if (reduce || !finePointer) return;

  // 用 rAF 合并 pointermove，避免每个事件都写样式
  const onPointer = (el, handler) => {
    let frame = 0;
    let last = null;
    el.addEventListener('pointermove', (event) => {
      last = event;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          handler(last, el.getBoundingClientRect());
        });
      }
    });
  };

  // 2) 关于我：背景大字与色块随指针轻微漂移，照片做 3D 倾斜
  const about = document.querySelector('#about');
  if (about) {
    onPointer(about, (e, r) => {
      about.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      about.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    about.addEventListener('pointerleave', () => {
      about.style.setProperty('--px', 0);
      about.style.setProperty('--py', 0);
    });

    const photo = about.querySelector('[data-tilt]');
    if (photo) {
      onPointer(photo, (e, r) => {
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        photo.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
        photo.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      });
      photo.addEventListener('pointerleave', () => {
        photo.style.setProperty('--ry', '0deg');
        photo.style.setProperty('--rx', '0deg');
      });
    }
  }

  // 3) 探索更多：卡片光晕跟随指针，并做轻微倾斜
  document.querySelectorAll('[data-glow]').forEach((card) => {
    onPointer(card, (e, r) => {
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty('--mx', `${x.toFixed(0)}px`);
      card.style.setProperty('--my', `${y.toFixed(0)}px`);
      card.style.setProperty('--tx', `${((x / r.width - 0.5) * 5).toFixed(2)}deg`);
      card.style.setProperty('--ty', `${(-(y / r.height - 0.5) * 5).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tx', '0deg');
      card.style.setProperty('--ty', '0deg');
    });
  });
})();
