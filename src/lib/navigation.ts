import { canonicalPath } from './site';
import type { MenuItem } from './types';

export interface MenuNode extends MenuItem {
  children: MenuNode[];
}

export function menuTree(items: MenuItem[]): MenuNode[] {
  const nodes = new Map<number, MenuNode>();
  for (const item of items) {
    if (!nodes.has(item.id)) nodes.set(item.id, { ...item, children: [] });
  }
  const roots: MenuNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parent);
    const ancestors = new Set([node.id]);
    let ancestor = parent;
    while (ancestor && !ancestors.has(ancestor.id)) {
      ancestors.add(ancestor.id);
      ancestor = nodes.get(ancestor.parent);
    }
    if (parent && !ancestor) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function menuPage(url: string, request: URL) {
  if (!url || url.startsWith('#')) return false;
  try {
    const target = new URL(url, request);
    return target.origin === request.origin && canonicalPath(target.pathname) === canonicalPath(request.pathname);
  } catch { return false; }
}

export function hasMenuPage(node: MenuNode, request: URL): boolean {
  return menuPage(node.url, request) || node.children.some((item) => hasMenuPage(item, request));
}

export function flattenMenu(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenu(node.children)]);
}
