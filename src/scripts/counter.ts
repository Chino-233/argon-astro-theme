let recorded = false;
document.addEventListener('astro:before-swap', () => { recorded = false; });

async function countPage() {
  if (recorded || !document.body?.hasAttribute('data-argon-track') || !globalThis.crypto?.randomUUID) return;
  recorded = true;
  const path = location.pathname;
  const page = location.href;
  let visitor = '';
  try {
    const key = 'argon-visitor-id';
    visitor = localStorage.getItem(key) ?? crypto.randomUUID();
    localStorage.setItem(key, visitor);
  } catch { /* Browsers that block storage still contribute page views. */ }
  try {
    const response = await fetch('/traffic/', {
      method: 'POST', body: new URLSearchParams({ path, visitor, event: crypto.randomUUID() }), keepalive: true,
    });
    if (response.status !== 200) return;
    const totals = await response.json() as { views: number; visitors: number; article?: number };
    if (location.href !== page || !document.body?.hasAttribute('data-argon-track')) return;
    const update = (selector: string, value: number) => {
      document.querySelectorAll(selector).forEach((node) => { node.textContent = value.toLocaleString('zh-CN'); });
    };
    update('[data-argon-total-views]', totals.views);
    update('[data-argon-total-visitors]', totals.visitors);
    const article = document.querySelector<HTMLElement>('.post-full [data-argon-view-baseline]');
    if (article && totals.article !== undefined) article.textContent = (Number(article.dataset.argonViewBaseline) + totals.article).toLocaleString('zh-CN');
  } catch { /* Site navigation remains independent of the counter. */ }
}

document.addEventListener('astro:page-load', () => { void countPage(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void countPage(); }, { once: true });
else void countPage();
