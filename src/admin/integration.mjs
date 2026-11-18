import { fileURLToPath } from 'node:url';

const pages = {
  '/auth/': 'index.astro',
  '/auth/comments/': 'comments.astro',
  '/auth/argon/': 'argon/index.astro',
  '/auth/argon/config.json': 'argon/config.json.ts',
  '/auth/argon/save/': 'argon/save.ts',
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
