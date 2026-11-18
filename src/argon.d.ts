declare namespace App {
  interface Locals {
    argonOverrides: Record<string, string>;
  }
}

declare module 'argon:site-data' {
  const data: {
    site: {
      url: string;
      title: string;
      description: string;
      language: string;
      timezone: string;
      site_icon: string;
      posts_per_page: number;
      started_at?: string;
    };
    argon: Record<string, string | boolean | number>;
    menus: Record<string, import('argon-astro-theme/runtime/types').MenuItem[]>;
    terms: Record<'category' | 'post_tag', import('argon-astro-theme/runtime/types').Term[]>;
    customCss: string;
    bookmarks?: import('argon-astro-theme/runtime/types').Bookmark[];
    searchTypes?: Record<string, string>;
  };
  export default data;
}

declare module 'argon:posts' {
  const posts: import('argon-astro-theme/runtime/types').Entry[];
  export default posts;
}

declare module 'argon:comments' {
  const comments: import('argon-astro-theme/runtime/types').Comment[];
  export default comments;
}

declare module 'argon:content-overrides' {
  type Entry = import('argon-astro-theme/runtime/types').Entry;
  export function publishedChanges(): ReadonlyMap<string, Entry | undefined> | Promise<ReadonlyMap<string, Entry | undefined>>;
}
