/**
 * Astro 配置：服务端渲染（SSR），适配 Cloudflare Pages/Workers
 */
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// 从环境变量获取前端站点 URL
// 构建时应通过环境变量 SITE_URL 指定前端地址
// 例如: SITE_URL=https://your-frontend-site.com npm run build
const siteUrl = process.env.SITE_URL || 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  // 服务端渲染模式
  // 'server' - 全部页面动态渲染
  // 'hybrid' - 默认静态渲染，可按需标记页面为动态
  output: 'server',
  // Cloudflare 适配器
  adapter: cloudflare({
    mode: 'advanced',
    runtime: {
      mode: 'local',
      type: 'pages',
    },
  }),
  // 简洁 URL：不带结尾斜杠
  trailingSlash: 'never',
  // 站点 URL（用于 RSS 和 sitemap）
  // 可通过环境变量 SITE_URL 配置前端站点地址
  site: siteUrl,
  // 集成
  integrations: [sitemap()],
});
