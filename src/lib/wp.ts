// WordPress REST API 客户端（无认证，SSG，分页 9）
// 站点：https://cfblog.zxd.im/wp-json

export const API_ROOT = `${import.meta.env.CFBLOG_API ?? 'https://cfblog.zxd.im'}/wp-json`;
export const WP_V2 = `${API_ROOT}/wp/v2`;
export const PAGE_SIZE = 9;

export interface WPPostRaw {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  date: string;
  modified: string;
  author: number;
  link?: string;
  categories?: number[];
  tags?: number[];
}

export interface WPPost {
  id: number;
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  date: string;
  modified: string;
  author: number;
  categories?: number[];
  tags?: number[];
}

function buildURL(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function fetchJSON<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WordPress API 请求失败: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

function htmlToText(html?: string, maxLen = 180): string | undefined {
  if (!html) return undefined;
  const txt = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (txt.length > maxLen) return txt.slice(0, maxLen) + '…';
  return txt;
}

function mapPost(p: WPPostRaw): WPPost {
  return {
    id: p.id,
    slug: decodeURIComponent(p.slug), // 解码 URL 编码的 slug
    title: p.title?.rendered ?? '',
    excerpt: htmlToText(p.excerpt?.rendered),
    content: p.content?.rendered,
    date: p.date,
    modified: p.modified,
    author: p.author,
    categories: p.categories,
    tags: p.tags,
  };
}

export async function getPosts(
  page = 1,
  perPage = PAGE_SIZE
): Promise<{ posts: WPPost[]; total: number; totalPages: number }> {
  const url = buildURL(`${WP_V2}/posts`, {
    page,
    per_page: perPage,
    _embed: 1,
    _fields: 'id,slug,title,excerpt,content,date,modified,author,categories,tags',
  });
  const { data, headers } = await fetchJSON<WPPostRaw[]>(url);
  const totalPages = Number(headers.get('X-WP-TotalPages') || 0);
  const total = Number(headers.get('X-WP-Total') || 0);
  return { posts: data.map(mapPost), total, totalPages };
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const url = buildURL(`${WP_V2}/posts`, {
    slug,
    _embed: 1,
    _fields: 'id,slug,title,excerpt,content,date,modified,author,categories,tags',
  });
  const { data } = await fetchJSON<WPPostRaw[]>(url);
  const p = data[0];
  return p ? mapPost(p) : null;
}

// 计算页码范围，便于分页组件使用
export function calcPagination(current: number, totalPages: number, window = 5) {
  const half = Math.floor(window / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(totalPages, start + window - 1);
  start = Math.max(1, end - window + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return { pages, hasPrev: current > 1, hasNext: current < totalPages };
}

// 获取总分页数（用于 SSG 生成）
export async function getTotalPages(perPage = PAGE_SIZE): Promise<number> {
  const { totalPages } = await getPosts(1, perPage);
  return totalPages || 1;
}

// 获取所有文章 slug（用于生成文章详情静态路径）
export async function getAllPostSlugs(limit = 1000, perPage = PAGE_SIZE): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;

  // 通过分页遍历全部文章，提取 slug
  // 若远端数据很多，limit 可限制最大数量以避免构建时间过长
  // 注意：Cloudflare Pages 构建时间有限，建议根据实际数据调整 limit
  while (true) {
    try {
      const { posts, totalPages } = await getPosts(page, perPage);
      slugs.push(...posts.map((p) => p.slug));

      console.log(`[getAllPostSlugs] 第 ${page} 页：获取到 ${posts.length} 篇文章，总页数: ${totalPages}`);

      if (page >= (totalPages || 1)) break;
      if (slugs.length >= limit) {
        console.warn(`[getAllPostSlugs] 达到限制 ${limit}，可能还有更多文章未获取`);
        break;
      }

      page += 1;
    } catch (error) {
      console.error(`[getAllPostSlugs] 获取第 ${page} 页失败:`, error);
      break;
    }
  }

  // 去重
  const uniqueSlugs = Array.from(new Set(slugs));
  console.log(`[getAllPostSlugs] 总共获取 ${uniqueSlugs.length} 个唯一 slug`);
  return uniqueSlugs;
}

// 站点信息（用于从 API 读取网站标题与描述）
export interface WPSiteInfo {
  name: string;
  description?: string;
  url?: string;
  home?: string;
}

let __siteCache: WPSiteInfo | null = null;
export async function getSiteInfo(): Promise<WPSiteInfo> {
  if (__siteCache) return __siteCache;
  const { data } = await fetchJSON<any>(API_ROOT);
  const info = data || {};
  __siteCache = {
    name: info?.name ?? 'CFBlog',
    description: info?.description,
    url: info?.url,
    home: info?.home,
  };
  return __siteCache;
}
// 分类/标签类型与相关 API
export interface WPTerm {
  id: number;
  name: string;
  slug: string;
  count?: number;
  description?: string;
}

export async function getCategories(perPage = 100): Promise<WPTerm[]> {
  const url = buildURL(`${WP_V2}/categories`, {
    per_page: perPage,
    _fields: 'id,name,slug,count,description',
  });
  const { data } = await fetchJSON<WPTerm[]>(url);
  return data;
}

export async function getTags(perPage = 100): Promise<WPTerm[]> {
  const url = buildURL(`${WP_V2}/tags`, {
    per_page: perPage,
    _fields: 'id,name,slug,count,description',
  });
  const { data } = await fetchJSON<WPTerm[]>(url);
  return data;
}

export async function getPostsByCategory(categoryId: number, page = 1, perPage = PAGE_SIZE): Promise<{ posts: WPPost[]; total: number; totalPages: number }> {
  const url = buildURL(`${WP_V2}/posts`, {
    categories: categoryId,
    page,
    per_page: perPage,
    _embed: 1,
    _fields: 'id,slug,title,excerpt,content,date,modified,author,categories,tags',
  });
  const { data, headers } = await fetchJSON<WPPostRaw[]>(url);
  const totalPages = Number(headers.get('X-WP-TotalPages') || 0);
  const total = Number(headers.get('X-WP-Total') || 0);
  return { posts: data.map(mapPost), total, totalPages };
}

export async function getPostsByTag(tagId: number, page = 1, perPage = PAGE_SIZE): Promise<{ posts: WPPost[]; total: number; totalPages: number }> {
  const url = buildURL(`${WP_V2}/posts`, {
    tags: tagId,
    page,
    per_page: perPage,
    _embed: 1,
    _fields: 'id,slug,title,excerpt,content,date,modified,author,categories,tags',
  });
  const { data, headers } = await fetchJSON<WPPostRaw[]>(url);
  const totalPages = Number(headers.get('X-WP-TotalPages') || 0);
  const total = Number(headers.get('X-WP-Total') || 0);
  return { posts: data.map(mapPost), total, totalPages };
}

// 获取所有文章（用于归档页面），注意构建时间与接口限流
export async function getAllPosts(limit = 2000, perPage = PAGE_SIZE): Promise<WPPost[]> {
  const all: WPPost[] = [];
  let page = 1;
  while (true) {
    const { posts, totalPages } = await getPosts(page, perPage);
    all.push(...posts);
    if (page >= (totalPages || 1)) break;
    if (all.length >= limit) break;
    page += 1;
  }
  return all;
}
// 根据 ID 获取分类/标签（用于详情页显示元信息）
export async function getCategoriesByIds(ids: number[] = []): Promise<WPTerm[]> {
  if (!ids || ids.length === 0) return [];
  const url = buildURL(`${WP_V2}/categories`, {
    include: ids.join(','),
    per_page: Math.max(ids.length, 1),
    _fields: 'id,name,slug,count,description',
  });
  const { data } = await fetchJSON<WPTerm[]>(url);
  return data;
}

export async function getTagsByIds(ids: number[] = []): Promise<WPTerm[]> {
  if (!ids || ids.length === 0) return [];
  const url = buildURL(`${WP_V2}/tags`, {
    include: ids.join(','),
    per_page: Math.max(ids.length, 1),
    _fields: 'id,name,slug,count,description',
  });
  const { data } = await fetchJSON<WPTerm[]>(url);
  return data;
}
// WordPress Pages 支持：按 slug 获取页面（用于 Links 页接入 WP 数据源）
export interface WPPageRaw {
  id: number;
  slug: string;
  title: { rendered: string };
  content?: { rendered: string };
  date: string;
  modified: string;
  link?: string;
}

export interface WPPage {
  id: number;
  slug: string;
  title: string;
  content?: string;
  date: string;
  modified: string;
}

function mapPage(p: WPPageRaw): WPPage {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title?.rendered ?? '',
    content: p.content?.rendered,
    date: p.date,
    modified: p.modified,
  };
}

export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  const url = buildURL(`${WP_V2}/pages`, {
    slug,
    _fields: 'id,slug,title,content,date,modified',
  });
  const { data } = await fetchJSON<WPPageRaw[]>(url);
  const p = data[0];
  return p ? mapPage(p) : null;
}
// WP Settings & Gravatar helpers (for Hugo Paper-like avatar and footer)
export interface WPSettings {
  admin_email?: string;
  site_footer_text?: string;
  site_title?: string;
  site_description?: string;
  site_url?: string;
  site_logo?: string;
  site_favicon?: string;
  site_author?: string;
  site_keywords?: string;
  head_html?: string;
}

export async function getSettings(): Promise<WPSettings> {
  try {
    const { data } = await fetchJSON<WPSettings>(`${WP_V2}/settings`);
    return data || {};
  } catch (error) {
    console.warn('无法获取 WordPress 设置，使用默认值:', error);
    return {};
  }
}

/**
 * Build gravatar image URL from email (MD5 hashed, lowercased, trimmed)
 * Uses Node crypto via dynamic import to avoid bundling issues.
 * 使用 Cravatar 中国加速节点
 */
export async function gravatarUrl(email: string, size = 160): Promise<string> {
  const { createHash } = await import('node:crypto');
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://cravatar.cn/avatar/${hash}?s=${size}&d=identicon`;
}
// Links API (WordPress custom endpoint)
export interface WPLink {
  id: number;
  name: string;
  url: string;
  description?: string;
  avatar?: string;
  category?: { id: number; name: string; slug: string };
  target?: string;
  visible?: string;
  rating?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** Fetch links from /wp-json/wp/v2/links; filters out invisible items */
export async function getLinks(perPage = 200): Promise<WPLink[]> {
  try {
    const url = buildURL(`${WP_V2}/links`, { per_page: perPage });
    const { data } = await fetchJSON<any[]>(url);
    const list: WPLink[] = (data || []).map((l) => ({
      id: l.id,
      name: l.name,
      url: l.url,
      description: l.description,
      avatar: l.avatar,
      category: l.category,
      target: l.target,
      visible: l.visible,
      rating: l.rating,
      sort_order: l.sort_order,
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
    return list.filter((l) => (l.visible ?? 'yes') === 'yes');
  } catch (e) {
    return [];
  }
}
// 获取全部 WP Pages 的 slug（用于静态路径生成）
export async function getAllPageSlugs(limit = 1000, perPage = 50): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  while (true) {
    const url = buildURL(`${WP_V2}/pages`, {
      page,
      per_page: perPage,
      _fields: 'slug',
    });
    const { data, headers } = await fetchJSON<any[]>(url);
    const totalPages = Number(headers.get('X-WP-TotalPages') || 0);
    slugs.push(
      ...((data || []).map((d: any) => d?.slug).filter(Boolean) as string[])
    );
    if (page >= (totalPages || 1)) break;
    if (slugs.length >= limit) break;
    page += 1;
  }
  return Array.from(new Set(slugs));
}
// Comments API (WordPress REST: /wp/v2/comments)
export interface WPCommentRaw {
  id: number;
  post: number;
  parent: number;
  author_name?: string;
  author_url?: string;
  author_avatar_urls?: Record<string, string>;
  author_avatar_hash?: string;
  post_title?: string;
  author_ip?: string;
  children?: WPCommentRaw[];
  date: string;
  content: { rendered: string };
}

export interface WPComment {
  id: number;
  post: number;
  parent: number;
  authorName: string;
  authorUrl?: string;
  avatar?: string;
  avatarHash?: string;
  postTitle?: string;
  // authorIp intentionally removed from public model to avoid rendering/location lookup
  children?: WPComment[];
  date: string;
  contentHtml: string;
}

function mapComment(c: WPCommentRaw): WPComment {
  const avatars = c.author_avatar_urls || {};
  const hash = c.author_avatar_hash;
  const avatarFromHash = hash ? `https://cravatar.cn/avatar/${hash}?s=96&d=identicon` : undefined;
  const avatar =
    avatarFromHash ||
    avatars['96'] ||
    avatars['48'] ||
    avatars['24'] ||
    undefined;
  const children = Array.isArray(c.children) ? c.children.map(mapComment) : undefined;
  return {
    id: c.id,
    post: c.post,
    parent: c.parent,
    authorName: c.author_name || '访客',
    authorUrl: c.author_url,
    avatar,
    avatarHash: hash,
    postTitle: c.post_title,
    // omit authorIp to avoid exposing IP/location data in generated output
    children,
    date: c.date,
    contentHtml: c.content?.rendered || '',
  };
}

/**
 * 获取指定文章的评论列表
 * - 默认最多 100 条，可根据需要调整 perPage
 * - WordPress 评论内容已为 HTML，直接渲染即可
 */
export async function getCommentsByPostId(postId: number, perPage = 100): Promise<WPComment[]> {
  const url = buildURL(`${WP_V2}/comments`, {
    post: postId,
    per_page: perPage,
  });
  const { data } = await fetchJSON<WPCommentRaw[]>(url);
  return (data || []).map(mapComment);
}

// Users API (WordPress REST: /wp/v2/users)
export interface WPUserRaw {
  id: number;
  name: string;
  url?: string;
  description?: string;
  link?: string;
  slug?: string;
  avatar_urls?: Record<string, string>;
  email?: string;
  roles?: string[];
  role?: string;
}

export interface WPUser {
  id: number;
  name: string;
  url?: string;
  description?: string;
  slug?: string;
  avatar?: string;
  email?: string;
  role?: string;
}

function mapUser(u: WPUserRaw): WPUser {
  const avatars = u.avatar_urls || {};

  // 将 Gravatar URL 替换为 Cravatar 加速节点
  let avatar = avatars['96'] || avatars['48'] || avatars['24'] || undefined;
  if (avatar) {
    avatar = avatar.replace('www.gravatar.com', 'cravatar.cn');
  }

  return {
    id: u.id,
    name: u.name || '访客',
    url: u.url,
    description: u.description,
    slug: u.slug,
    avatar,
    email: u.email,
    role: u.role,
  };
}

/**
 * 获取指定用户信息
 */
export async function getUserById(userId: number): Promise<WPUser | null> {
  try {
    const url = `${WP_V2}/users/${userId}`;
    const { data } = await fetchJSON<WPUserRaw>(url);
    return data ? mapUser(data) : null;
  } catch (err) {
    console.error(`获取用户 ${userId} 失败:`, err);
    return null;
  }
}