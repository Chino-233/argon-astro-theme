import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const argonPosts = (base = './src/content/posts') => defineCollection({
  loader: glob({ base, pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    path: z.string().regex(/^\/(?!\/).+\/$/),
    type: z.enum(['post', 'page', 'shuoshuo']).default('post'),
    searchType: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/).optional(),
    template: z.enum(['friendlinks']).optional(),
    linkStyle: z.enum(['cards', 'square', 'compact', 'large']).optional(),
    excerpt: z.string().optional(),
    featuredImage: z.string().optional(),
    categories: z.array(z.number()).default([]),
    tags: z.array(z.number()).default([]),
  }),
});
