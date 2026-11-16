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
  searchType?: string;
  linkStyle?: 'cards' | 'square' | 'compact' | 'large';
  html: string;
  excerpt: string;
  featuredImage?: string;
  categories?: number[];
  tags?: number[];
  views?: string | number | null;
  wordCount?: number;
  readingTime?: string;
  likes?: number;
  visibility?: 'private' | 'password';
  passwordHash?: string | null;
  media?: string[];
}

export interface Heading {
  id: string;
  label: string;
  depth: number;
}

export interface Comment {
  id: number;
  post_id: Entry['id'];
  parent: number;
  author: string;
  author_url: string;
  date: string;
  html: string;
  ownerOnly?: boolean;
  media?: string[];
  avatar?: string;
  likes?: number;
  pinned?: boolean;
  device?: { browser?: string; version?: string; platform?: string };
}

export interface MenuItem {
  id: number;
  parent: number;
  title: string;
  url: string;
  target: string;
  classes: string[];
  description?: string;
}

export interface Bookmark {
  name: string;
  url: string;
  description?: string;
  image?: string;
  group?: string;
}

export interface Term {
  id: number;
  parent: number;
  name: string;
  slug: string;
  description: string;
  url: string;
}
