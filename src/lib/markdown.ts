import MarkdownIt from 'markdown-it';

export const md = new MarkdownIt({
  html: true,      // 允许在 Markdown 中包含 HTML
  linkify: true,   // 自动链接 URL
  breaks: false,   // 不将换行符视为换行
});

/**
 * 粗略判断字符串是否更像 Markdown 而非 HTML。
 * - 存在典型 Markdown 语法
 * - 且不包含明显的 HTML 标签
 */
export function isProbablyMarkdown(input: string): boolean {
  if (!input) return false;
  const indicators = [
    /(^|\n)#{1,6}\s+/,           // 标题：#、## ...
    /(^|\n)(>|-|\*|\d+\.)\s+/,   // 引用、无序/有序列表
    /\*\*[^*]+\*\*/,             // 加粗 **bold**
    /`{1,3}[^`]*`{1,3}/,         // 行内/多行代码
    /(^|\n)```/,                 // 代码块 fence
  ];
  const looksMarkdown = indicators.some((re) => re.test(input));
  const hasHtmlTag = /<\w+[^>]*>/.test(input);
  return looksMarkdown && !hasHtmlTag;
}

/**
 * 将输入转为 HTML：
 * - 若输入包含明显 HTML 标签，则直接返回原文（认为其已是 HTML）
 * - 否则使用 markdown-it 进行 Markdown 渲染
 */
export function mdToHtml(input: string): string {
  if (!input) return '';
  if (/<\w+[^>]*>/.test(input)) {
    return input;
  }
  return md.render(input);
}