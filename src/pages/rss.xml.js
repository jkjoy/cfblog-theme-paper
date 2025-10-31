import rss from '@astrojs/rss';
import { getAllPosts, getSiteInfo, getCategoriesByIds } from '../lib/wp';

/**
 * RSS Feed 生成器
 * 提供博客文章的 RSS 订阅源
 */
export async function GET(context) {
  try {
    // 获取所有文章
    const posts = await getAllPosts(100); // 限制最近100篇文章

    // 获取站点信息
    const site = await getSiteInfo();

    // 为每篇文章获取分类名称
    const items = await Promise.all(
      posts.map(async (post) => {
        // 获取分类名称
        let categoryNames = [];
        if (post.categories && post.categories.length > 0) {
          const categories = await getCategoriesByIds(post.categories);
          categoryNames = categories.map(cat => cat.name);
        }

        return {
          title: post.title,
          pubDate: new Date(post.date),
          description: post.excerpt || '',
          link: `/post/${post.slug}`,
          // 添加分类名称
          categories: categoryNames,
        };
      })
    );

    return rss({
      title: site?.name || 'CFBlog',
      description: site?.description || '基于 WordPress REST API 的 Astro 博客',
      site: context.site,
      items,
      // 自定义样式表（可选）
      customData: `<language>zh-CN</language>`,
      // RSS 规范版本
      xmlns: {
        atom: "http://www.w3.org/2005/Atom",
      },
    });
  } catch (error) {
    console.error('RSS 生成失败:', error);
    return new Response('RSS Feed generation failed', { status: 500 });
  }
}
