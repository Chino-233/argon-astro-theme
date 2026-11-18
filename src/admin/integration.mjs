import { fileURLToPath } from 'node:url';

const pages = {
  '/auth/': 'index.astro',
  '/auth/comments/': 'comments.astro',
  '/auth/argon/': 'argon/index.astro',
  '/auth/argon/config.json': 'argon/config.json.ts',
  '/auth/argon/save/': 'argon/save.ts',
  '/auth/content/': 'content/index.astro',
  '/auth/content/save/': 'content/save.ts',
  '/auth/content/media/': 'content/media.ts',
  '/auth/content/render/': 'content/render.ts',
  '/auth/content/preview/': 'content/preview.astro',
};

export default function argonAdmin() {
  return {
    name: 'argon-admin',
    hooks: {
      'astro:config:setup'({ injectRoute }) {
        for (const [pattern, entry] of Object.entries(pages)) {
          const entrypoint = fileURLToPath(new URL(entry, import.meta.url));
          injectRoute({ pattern, entrypoint });
        }
      },
    },
  };
}
