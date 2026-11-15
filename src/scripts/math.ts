import bundledKatex from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

type MathJaxGlobal = {
  startup?: { promise?: Promise<void> };
  typesetPromise?: (elements: HTMLElement[]) => Promise<void>;
  Hub?: { Queue: (...tasks: unknown[]) => void };
};
const host = window as typeof window & { MathJax?: MathJaxGlobal; renderMathInElement?: typeof bundledKatex };
const katexOptions = { delimiters: [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
], throwOnError: false };
const scripts = new Map<string, Promise<void>>();

function script(url: string) {
  if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
    const node = document.createElement('script');
    node.src = url;
    node.onload = () => resolve();
    node.onerror = () => { scripts.delete(url); node.remove(); reject(new Error('Could not load math assets')); };
    document.head.append(node);
  }));
  return scripts.get(url)!;
}

export async function renderMath(elements: HTMLElement[]) {
  const { mathEngine, mathScript, katexCdn } = document.documentElement.dataset;
  const pending = elements.filter((element) => !element.dataset.mathRendered && /\$|\\[([]/.test(element.textContent ?? ''));
  if (!pending.length || !mathEngine || mathEngine === 'false') return;
  for (const element of pending) element.dataset.mathRendered = 'true';
  if (mathEngine === 'katex') {
    if (katexCdn && !host.renderMathInElement) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = katexCdn + 'katex.min.css';
      document.head.append(css);
      try {
        await script(katexCdn + 'katex.min.js');
        await script(katexCdn + 'contrib/auto-render.min.js');
      } catch { css.remove(); }
    }
    for (const element of pending) if (element.isConnected) (host.renderMathInElement ?? bundledKatex)(element, katexOptions);
    return;
  }
  if (!mathScript) return;
  try {
    await script(mathScript);
    const engine = host.MathJax;
    if (engine?.startup?.promise) await engine.startup.promise;
    const live = pending.filter((element) => element.isConnected);
    if (engine?.typesetPromise) await engine.typesetPromise(live);
    else if (engine?.Hub) for (const element of live) engine.Hub.Queue(['Typeset', engine.Hub, element]);
  } catch {
    for (const element of pending) delete element.dataset.mathRendered;
  }
}
