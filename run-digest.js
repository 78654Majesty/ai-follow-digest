#!/usr/bin/env node

// ============================================================================
// AI Follow Digest — 整合 AI Builders 动态 + HN 顶级博客精选
// ============================================================================

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Constants
// ============================================================================

const FEED_X_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json';
const FEED_PODCASTS_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json';
const FEED_BLOGS_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json';
const PROMPTS_BASE = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts';
const PROMPT_FILES = ['summarize-podcast.md', 'summarize-tweets.md', 'summarize-blogs.md', 'translate.md'];

const RSS_FEEDS = [
  { name: "simonwillison.net", xmlUrl: "https://simonwillison.net/atom/everything/", htmlUrl: "https://simonwillison.net" },
  { name: "jeffgeerling.com", xmlUrl: "https://www.jeffgeerling.com/blog.xml", htmlUrl: "https://jeffgeerling.com" },
  { name: "krebsonsecurity.com", xmlUrl: "https://krebsonsecurity.com/feed/", htmlUrl: "https://krebsonsecurity.com" },
  { name: "daringfireball.net", xmlUrl: "https://daringfireball.net/feeds/main", htmlUrl: "https://daringfireball.net" },
  { name: "mitchellh.com", xmlUrl: "https://mitchellh.com/feed.xml", htmlUrl: "https://mitchellh.com" },
  { name: "dynomight.net", xmlUrl: "https://dynomight.net/feed.xml", htmlUrl: "https://dynomight.net" },
  { name: "xeiaso.net", xmlUrl: "https://xeiaso.net/blog.rss", htmlUrl: "https://xeiaso.net" },
  { name: "overreacted.io", xmlUrl: "https://overreacted.io/rss.xml", htmlUrl: "https://overreacted.io" },
  { name: "matklad.github.io", xmlUrl: "https://matklad.github.io/feed.xml", htmlUrl: "https://matklad.github.io" },
  { name: "gwern.net", xmlUrl: "https://gwern.substack.com/feed", htmlUrl: "https://gwern.net" },
  { name: "bernsteinbear.com", xmlUrl: "https://bernsteinbear.com/feed.xml", htmlUrl: "https://bernsteinbear.com" },
  { name: "troyhunt.com", xmlUrl: "https://www.troyhunt.com/rss/", htmlUrl: "https://troyhunt.com" },
  { name: "paulgraham.com", xmlUrl: "http://www.aaronsw.com/2002/feeds/pgessays.rss", htmlUrl: "https://paulgraham.com" },
  { name: "eli.thegreenplace.net", xmlUrl: "https://eli.thegreenplace.net/feeds/all.atom.xml", htmlUrl: "https://eli.thegreenplace.net" },
  { name: "fabiensanglard.net", xmlUrl: "https://fabiensanglard.net/rss.xml", htmlUrl: "https://fabiensanglard.net" },
  { name: "steveblank.com", xmlUrl: "https://steveblank.com/feed/", htmlUrl: "https://steveblank.com" },
  { name: "experimental-history.com", xmlUrl: "https://www.experimental-history.com/feed", htmlUrl: "https://experimental-history.com" },
];

const FEED_FETCH_TIMEOUT_MS = 15_000;
const FEED_CONCURRENCY = 10;
const AI_BATCH_SIZE = 10;
const HN_HOURS = 48;
const HN_TOP_N = 15;

const DEFAULT_OUTPUT_DIR = join(homedir(), 'digest-output');
const DEFAULT_LANGUAGE = 'zh';

const CATEGORY_META = {
  'ai-ml':       { emoji: '🤖', label: 'AI / ML' },
  'security':    { emoji: '🔒', label: '安全' },
  'engineering': { emoji: '⚙️', label: '工程' },
  'tools':       { emoji: '🛠', label: '工具 / 开源' },
  'opinion':     { emoji: '💡', label: '观点 / 杂谈' },
  'other':       { emoji: '📝', label: '其他' },
};

// ============================================================================
// Fetch Helpers
// ============================================================================

async function fetchJSON(url) {
  console.log(`[digest] Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

// ============================================================================
// AI Client
// ============================================================================

async function callAI(prompt, apiKey, apiBase, model) {
  const normalizedBase = apiBase.replace(/\/+$/, '');
  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, top_p: 0.8 }),
  });
  if (!response.ok) throw new Error(`AI API error (${response.status})`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// PART 1: AI Builders
// ============================================================================

async function loadPrompts() {
  const prompts = {};
  for (const filename of PROMPT_FILES) {
    const key = filename.replace('.md', '').replace(/-/g, '_');
    const remote = await fetchText(`${PROMPTS_BASE}/${filename}`);
    if (remote) prompts[key] = remote;
  }
  return prompts;
}

async function generatePodcastSummary(podcast, prompts, aiConfig) {
  const content = podcast.transcript || podcast.description || '';
  if (!content) return null;
  return await callAI(`${prompts.summarize_podcast}\n\n${content.slice(0, 8000)}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
}

async function generateTweetsSummary(builder, prompts, aiConfig) {
  const tweets = builder.tweets || [];
  if (tweets.length === 0) return null;
  const content = tweets.map(t => `${t.text || t.content}`).join('\n\n');
  return await callAI(`${prompts.summarize_tweets}\n\nAuthor: ${builder.name}\n\n${content.slice(0, 6000)}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
}

async function generateBlogSummary(blog, prompts, aiConfig) {
  const content = blog.content || blog.description || '';
  if (!content) return null;
  return await callAI(`${prompts.summarize_blogs}\n\nTitle: ${blog.title}\n\n${content.slice(0, 8000)}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
}

async function fetchAIBuildersData(aiConfig, language) {
  console.log('[digest] === Part 1: AI Builders ===');

  const prompts = await loadPrompts();
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(FEED_X_URL),
    fetchJSON(FEED_PODCASTS_URL),
    fetchJSON(FEED_BLOGS_URL)
  ]);

  const summaries = { x: [], podcasts: [], blogs: [] };

  for (const builder of (feedX?.x || [])) {
    if (builder.tweets?.length > 0) {
      console.log(`[digest] Summarizing ${builder.name}...`);
      const summary = await generateTweetsSummary(builder, prompts, aiConfig);
      if (summary) summaries.x.push({ name: builder.name, handle: builder.handle, summary, url: builder.tweets[0]?.url });
    }
  }

  for (const podcast of (feedPodcasts?.podcasts || [])) {
    console.log(`[digest] Summarizing: ${podcast.title?.slice(0, 30)}...`);
    const summary = await generatePodcastSummary(podcast, prompts, aiConfig);
    if (summary) summaries.podcasts.push({ title: podcast.title, summary, url: podcast.url });
  }

  for (const blog of (feedBlogs?.blogs || [])) {
    console.log(`[digest] Summarizing: ${blog.title?.slice(0, 30)}...`);
    const summary = await generateBlogSummary(blog, prompts, aiConfig);
    if (summary) summaries.blogs.push({ title: blog.title, summary, url: blog.url });
  }

  // Build simple content
  let content = `## 一、AI Builders 动态\n\n`;
  content += `> 来源: [follow-builders](https://github.com/zarazhangrui/follow-builders)\n\n`;

  if (summaries.x.length > 0) {
    content += `### 1.1 X / Twitter (${summaries.x.length} 位建造者)\n\n`;
    let i = 1;
    for (const item of summaries.x) {
      content += `${i}. **${item.name}**\n\n`;
      content += `   > [摘要] ${item.summary.slice(0, 200)}\n\n`;
      content += `   [原文链接](${item.url})\n\n`;
      i++;
    }
  }

  if (summaries.blogs.length > 0) {
    content += `### 1.2 官方博客 (${summaries.blogs.length} 篇)\n\n`;
    let i = 1;
    for (const item of summaries.blogs) {
      content += `${i}. **${item.title?.slice(0, 60)}**\n\n`;
      content += `   > [摘要] ${item.summary.slice(0, 200)}\n\n`;
      content += `   [原文链接](${item.url})\n\n`;
      i++;
    }
  }

  if (summaries.podcasts.length > 0) {
    content += `### 1.3 播客 (${summaries.podcasts.length} 期)\n\n`;
    let i = 1;
    for (const item of summaries.podcasts) {
      content += `${i}. **${item.title?.slice(0, 60)}**\n\n`;
      content += `   > [摘要] ${item.summary.slice(0, 200)}\n\n`;
      content += `   [原文链接](${item.url})\n\n`;
      i++;
    }
  }

  if (language === 'zh') {
    content = await callAI(`${prompts.translate}\n\n${content}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
  }

  return { content, stats: { builders: summaries.x.length, podcasts: summaries.podcasts.length, blogs: summaries.blogs.length } };
}

// ============================================================================
// PART 2: HN Blog Digest
// ============================================================================

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function getTagContent(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function parseRSSItems(xml) {
  const items = [];
  let match;
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: stripHtml(getTagContent(itemXml, 'title')),
      link: getTagContent(itemXml, 'link') || getTagContent(itemXml, 'guid'),
      pubDate: getTagContent(itemXml, 'pubDate'),
      description: stripHtml(getTagContent(itemXml, 'description')).slice(0, 500)
    });
  }
  const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  while ((match = entryPattern.exec(xml)) !== null) {
    const entryXml = match[1];
    const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']*)["']/i);
    items.push({
      title: stripHtml(getTagContent(entryXml, 'title')),
      link: linkMatch?.[1] || '',
      pubDate: getTagContent(entryXml, 'published') || getTagContent(entryXml, 'updated'),
      description: stripHtml(getTagContent(entryXml, 'summary') || getTagContent(entryXml, 'content')).slice(0, 500)
    });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);
    const res = await fetch(feed.xmlUrl, { signal: controller.signal, headers: { 'User-Agent': 'AI-Follow-Digest/1.0' } });
    clearTimeout(timeout);
    if (!res.ok) return [];
    return parseRSSItems(await res.text()).map(item => ({
      title: item.title, link: item.link, pubDate: new Date(item.pubDate || 0),
      description: item.description, sourceName: feed.name
    }));
  } catch { return []; }
}

async function fetchAllFeeds(feeds) {
  const all = [];
  for (let i = 0; i < feeds.length; i += FEED_CONCURRENCY) {
    const batch = feeds.slice(i, i + FEED_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchFeed));
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
    console.log(`[digest] RSS: ${Math.min(i + FEED_CONCURRENCY, feeds.length)}/${feeds.length}`);
  }
  return all;
}

function parseJson(text) {
  let json = text.trim();
  if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

async function fetchHNDigestData(aiConfig, hours, topN) {
  console.log('[digest] === Part 2: HN Blog Digest ===');

  const all = await fetchAllFeeds(RSS_FEEDS);
  if (!all.length) return { content: '', stats: { total: 0, selected: 0 } };

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recent = all.filter(a => a.pubDate > cutoff);
  console.log(`[digest] ${recent.length} articles in ${hours}h`);

  if (!recent.length) return { content: '', stats: { total: all.length, selected: 0 } };

  // Score
  const indexed = recent.map((a, i) => ({ index: i, title: a.title, description: a.description, sourceName: a.sourceName }));
  const scores = new Map();

  for (let i = 0; i < indexed.length; i += AI_BATCH_SIZE) {
    const batch = indexed.slice(i, i + AI_BATCH_SIZE);
    try {
      const list = batch.map(a => `${a.index}: [${a.sourceName}] ${a.title}`).join('\n');
      const res = await callAI(`评分文章1-10，分类ai-ml/security/engineering/tools/opinion/other。\n${list}\n返回JSON:{results:[{index:0,relevance:8,quality:7,timeliness:9,category:"engineering"}]}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
      const parsed = parseJson(res);
      if (parsed.results) for (const r of parsed.results) scores.set(r.index, { ...r, category: r.category || 'other' });
    } catch {}
  }

  // Sort
  const scored = recent.map((a, i) => {
    const s = scores.get(i) || { relevance: 5, quality: 5, timeliness: 5, category: 'other' };
    return { ...a, totalScore: s.relevance + s.quality + s.timeliness, category: s.category };
  }).sort((a, b) => b.totalScore - a.totalScore).slice(0, topN);

  console.log(`[digest] Selected ${scored.length}`);

  // Summarize
  const summaries = new Map();
  for (let i = 0; i < scored.length; i += AI_BATCH_SIZE) {
    const batch = scored.slice(i, i + AI_BATCH_SIZE).map((a, j) => ({ index: i + j, title: a.title, link: a.link }));
    try {
      const list = batch.map(a => `${a.index}: ${a.title}\n${a.link}`).join('\n');
      const res = await callAI(`生成中文标题和简短摘要。\n${list}\n返回JSON:{results:[{index:0,titleZh:"标题",summary:"摘要"}]}`, aiConfig.apiKey, aiConfig.apiBase, aiConfig.model);
      const parsed = parseJson(res);
      if (parsed.results) for (const r of parsed.results) summaries.set(r.index, r);
    } catch {}
  }

  const final = scored.map((a, i) => {
    const sm = summaries.get(i) || { titleZh: a.title, summary: a.description.slice(0, 100) };
    return { ...a, titleZh: sm.titleZh, summary: sm.summary };
  });

  // Build simple content
  let content = `## 二、HN 博客精选\n\n`;
  content += `> 来源: [ai-daily-digest](https://github.com/Cunninger/ai-daily-digest) — Karpathy 推荐 90 个顶级博客\n`;
  content += `> 统计: 抓取 ${all.length} 篇 → 过滤 ${recent.length} 篇 → 精选 ${final.length} 篇\n\n`;

  // Top 3
  if (final.length >= 3) {
    content += `### 2.1 今日必读\n\n`;
    for (let i = 0; i < 3; i++) {
      const a = final[i];
      const medal = ['🥇', '🥈', '🥉'][i];
      content += `${i + 1}. ${medal} **${a.titleZh}** [翻译]\n\n`;
      content += `   *原文: ${a.title}*\n\n`;
      content += `   > [摘要] ${a.summary.slice(0, 150)}\n\n`;
      content += `   [原文链接](${a.link}) — ${a.sourceName}\n\n`;
    }
  }

  // Categories
  const groups = new Map();
  for (const a of final) {
    const list = groups.get(a.category) || [];
    list.push(a);
    groups.set(a.category, list);
  }

  let catIdx = 2;
  for (const [catId, articles] of groups) {
    const cat = CATEGORY_META[catId] || CATEGORY_META['other'];
    content += `### 2.${catIdx} ${cat.emoji} ${cat.label} (${articles.length} 篇)\n\n`;
    let idx = 1;
    for (const a of articles) {
      content += `${idx}. **${a.titleZh}** [翻译]\n\n`;
      content += `   *原文: ${a.title}*\n\n`;
      content += `   > [摘要] ${a.summary.slice(0, 100)}\n\n`;
      content += `   [原文链接](${a.link}) — ${a.sourceName}\n\n`;
      idx++;
    }
    catIdx++;
  }

  return { content, stats: { total: all.length, selected: final.length } };
}

// ============================================================================
// Main
// ============================================================================

async function assemble(aiContent, hnContent) {
  const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  let digest = `# AI Follow Digest — ${dateStr}\n\n`;
  digest += `---\n\n`;
  digest += `## 目录\n\n`;
  digest += `1. [AI Builders 动态](#一ai-builders-动态)\n`;
  digest += `   - [X / Twitter](#11-x--twitter)\n`;
  digest += `   - [官方博客](#12-官方博客)\n`;
  digest += `   - [播客](#13-播客)\n`;
  digest += `2. [HN 博客精选](#二hn-博客精选)\n`;
  digest += `   - [今日必读](#21-今日必读)\n`;
  digest += `   - [分类文章](#22-ai--ml)\n`;
  digest += `\n---\n\n`;
  digest += aiContent;
  digest += `\n---\n\n`;
  digest += hnContent;
  digest += `\n---\n\n`;
  digest += `*生成时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} | AI模型: DeepSeek*\n`;

  return digest;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(`Usage: node run-digest.js --output /path --language zh`);
    process.exit(0);
  }

  let outputDir = DEFAULT_OUTPUT_DIR;
  let language = DEFAULT_LANGUAGE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) outputDir = args[++i];
    else if (args[i] === '--language' && args[i + 1]) language = args[++i];
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.deepseek.com/v1';
  const model = process.env.OPENAI_MODEL || 'deepseek-chat';

  if (!apiKey) {
    console.error('[digest] Error: OPENAI_API_KEY required');
    process.exit(1);
  }

  const aiConfig = { apiKey, apiBase, model };

  console.log('[digest] === AI Follow Digest ===');
  console.log(`[digest] Output: ${outputDir}`);

  const aiResult = await fetchAIBuildersData(aiConfig, language);
  const hnResult = await fetchHNDigestData(aiConfig, HN_HOURS, HN_TOP_N);

  console.log('[digest] === Assembling ===');
  const digest = await assemble(aiResult.content, hnResult.content);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `ai-follow-digest-${dateStr}.md`;
  const outputPath = join(outputDir, filename);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, digest);

  console.log(`[digest] Done: ${outputPath}`);
  console.log(`[digest] AI Builders: ${aiResult.stats.builders + aiResult.stats.podcasts + aiResult.stats.blogs} | HN: ${hnResult.stats.selected}`);
}

main().catch(err => {
  console.error(`[digest] Error: ${err.message}`);
  process.exit(1);
});