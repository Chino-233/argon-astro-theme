export interface Entry {
  id: number | string;
  type: 'post' | 'page' | 'shuoshuo';
  parent?: number;
  title: string;
  path: string;
  published: string;
  updated?: string;
  author?: string;
  template?: string;
  html: string;
  excerpt: string;
  featuredImage?: string;
  categories?: number[];
  tags?: number[];
  views?: string | number | null;
  wordCount?: number;
  readingTime?: string;
  visibility?: 'private' | 'password';
  passwordHash?: string | null;
  media?: string[];
}

export interface Comment {
  id: number;
  post_id: number;
  parent: number;
  author: string;
  author_url: string;
  date: string;
  html: string;
  ownerOnly?: boolean;
  media?: string[];
}

export interface MenuItem {
  id: number;
  parent: number;
  title: string;
  url: string;
  target: string;
  classes: string[];
}

export interface Term {
  id: number;
  parent: number;
  name: string;
  slug: string;
  description: string;
  url: string;
}
