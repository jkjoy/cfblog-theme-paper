import MarkdownIt from 'markdown-it';

export const md = new MarkdownIt({
  html: true,      // 允许在 Markdown 中包含 HTML
  linkify: true,   // 自动链接 URL
  breaks: false,   // 不将换行符视为换行
});

/**
 * 判断字符串是否包含 Markdown 语法。
 * - 检测典型 Markdown 语法标记
 * - 即使包含 HTML 标签，只要有 Markdown 语法就返回 true
 */
export function isProbablyMarkdown(input: string): boolean {
  if (!input) return false;
  const indicators = [
    /(^|\n)#{1,6}\s+/,           // 标题：#、## ...
    /(^|\n)(>|-|\*|\d+\.)\s+/,   // 引用、无序/有序列表
    /\*\*[^*]+\*\*/,             // 加粗 **bold**
    /`{1,3}[^`]*`{1,3}/,         // 行内/多行代码
    /(^|\n)```/,                 // 代码块 fence
    /\[.+?\]\(.+?\)/,            // 链接和图片 [text](url)
  ];
  // 只要包含任何 Markdown 语法就返回 true（允许混合 HTML）
  return indicators.some((re) => re.test(input));
}

/**
 * 将输入转为 HTML：
 * - 检测是否包含 Markdown 语法（#、##、**、`、[]等）
 * - 如果包含 Markdown 语法，始终使用 markdown-it 渲染（即使有 HTML 标签）
 * - 否则直接返回原文
 */
export function mdToHtml(input: string): string {
  if (!input) return '';

  // 检测是否包含 Markdown 语法
  const hasMarkdownSyntax = isProbablyMarkdown(input);

  // 如果包含 Markdown 语法，总是进行渲染（markdown-it 会保留 HTML 标签）
  if (hasMarkdownSyntax) {
    return md.render(input);
  }

  // 如果没有 Markdown 语法，直接返回（可能是纯 HTML）
  return input;
}