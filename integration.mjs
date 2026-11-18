import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import send from 'send';

const source = (path) => new URL(path, import.meta.url);
const assets = fileURLToPath(source('./public/assets/argon/'));
const routes = {
  '/[...path]': '[...path].astro',
  '/feed': 'feed.ts',
  '/robots.txt': 'robots.txt.ts',
  '/sitemap.xml': 'sitemap.xml.ts',
  '/traffic': 'traffic.ts',
  '/interactions': 'interactions.ts',
  '/comment-captcha': 'comment-captcha.ts',
  '/comment-subscription': 'comment-subscription.astro',
  '/auth/action': 'auth/action.ts',
  '/auth/media/[scope]/[...file]': 'auth/media/[scope]/[...file].ts',
};

function themeAssets(publicDir) {
  const overrides = resolve(fileURLToPath(publicDir), 'assets/argon');
  return {
    name: 'argon-theme-assets',
    configureServer(server) {
      if (relative(assets, overrides) === '') return;
      server.middlewares.use('/assets/argon', (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        const pathname = new URL(request.url, 'http://localhost').pathname;
        try {
          const local = resolve(overrides, '.' + decodeURIComponent(pathname));
          const path = relative(overrides, local);
          if (isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) return next();
          if (statSync(local, { throwIfNoEntry: false })?.isFile()) return next();
        } catch {
          return next();
        }
        send(request, pathname, { root: assets, index: false, dotfiles: 'deny' })
          .on('error', () => response.headersSent ? response.destroy() : next())
          .pipe(response);
      });
    },
  };
}

/**
 * @param {{ dataDir?: string | URL, contentOverrides?: string | URL }} [options]
 * @returns {import('astro').AstroIntegration}
 */
export default function argonTheme({ dataDir = './src/data', contentOverrides } = {}) {
  return {
    name: 'argon-astro-theme',
    hooks: {
      'astro:config:setup'({ config, updateConfig, injectRoute, addMiddleware }) {
        const root = fileURLToPath(config.root);
        const absolute = (path) => path instanceof URL ? fileURLToPath(path) : resolve(root, path);
        const data = absolute(dataDir);
        const alias = {
          'argon:site-data': resolve(data, 'site.json'),
          'argon:posts': resolve(data, 'posts.json'),
          'argon:comments': resolve(data, 'comments.json'),
          'argon:content-overrides': absolute(contentOverrides ?? source('./src/lib/content-overrides.ts')),
        };
        for (const file of Object.values(alias)) {
          if (!existsSync(file)) throw new Error('Argon configuration file not found: ' + file);
        }
        updateConfig({
          vite: {
            resolve: { alias },
            ssr: { noExternal: ['argon-astro-theme'] },
            optimizeDeps: { exclude: ['argon-astro-theme'] },
            plugins: [themeAssets(config.publicDir)],
          },
        });
        addMiddleware({ entrypoint: source('./src/site-middleware.ts'), order: 'pre' });
        for (const [pattern, file] of Object.entries(routes)) {
          injectRoute({ pattern, entrypoint: source('./src/routes/' + file), prerender: false });
        }
      },
      'astro:config:done'({ injectTypes }) {
        injectTypes({
          filename: 'argon.d.ts',
          content: readFileSync(source('./src/argon.d.ts'), 'utf8'),
        });
      },
      'astro:build:done'({ dir }) {
        cpSync(assets, fileURLToPath(new URL('./assets/argon/', dir)), { recursive: true, force: false });
      },
    },
  };
}
