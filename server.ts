import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Parser from "rss-parser";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const parser = new Parser();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json());

const SOURCES = {
  US: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { name: "Wired", url: "https://www.wired.com/feed/rss" },
    { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
    { name: "CNET", url: "https://www.cnet.com/rss/news/" },
    { name: "Mashable", url: "https://mashable.com/feeds/rss/all" },
    { name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml" },
    { name: "9to5Mac", url: "https://9to5mac.com/feed/" },
    { name: "Forbes Tech", url: "https://www.forbes.com/technology/feed/" },
  ],
  CN: [
    { name: "36Kr", url: "https://36kr.com/feed" },
    { name: "ITHome", url: "https://www.ithome.com/rss/" },
    { name: "TMTPost", url: "https://www.tmtpost.com/rss.xml" },
    { name: "TechNode", url: "https://cn.technode.com/feed/" },
    { name: "Solidot", url: "https://www.solidot.org/index.rss" },
    { name: "iFanr", url: "https://www.ifanr.com/feed" },
    { name: "SSPAI", url: "https://sspai.com/feed" },
    { name: "CNBeta", url: "https://www.cnbeta.com.tw/backend.php" },
    { name: "GeekPark", url: "https://www.geekpark.net/rss" },
    { name: "The Paper Tech", url: "https://www.thepaper.cn/rss_news.jsp?nodeid=25961" },
  ],
};

// Simple Cache
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours cache to conserve daily quota (limit: 20/day)

// Track in-flight requests to deduplicate concurrent calls
const inFlightRequests: Record<string, Promise<any>> = {};

async function getFeedItems(urls: string[]) {
  const results = await Promise.allSettled(urls.map(url => 
    parser.parseURL(url).catch(e => {
      console.warn(`Warning: Failed to fetch feed ${url}:`, e.message);
      return null;
    })
  ));
  
  const allItems: any[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      const feed = result.value;
      allItems.push(...feed.items.slice(0, 60).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.contentSnippet || item.content || "",
      })));
    }
  });
  return allItems;
}

async function generateWithRetry(prompt: any, schema: any, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      return result;
    } catch (error: any) {
      lastError = error;
      const is429 = error.message?.includes("429") || error.status === 429 || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
      
      // If it's a daily quota hit (limit: 20), retrying won't help today unless it's a transient glitch
      // But if it's a per-minute limit, retrying might help.
      const isDailyQuota = JSON.stringify(error).includes("GenerateRequestsPerDayPerProjectPerModel-FreeTier");

      if (is429 && i < maxRetries && !isDailyQuota) {
        const waitTime = Math.pow(2, i) * 5000 + Math.random() * 2000; // Longer wait for 429
        console.log(`API Rate limited (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function performPulseCrawl(days: number) {
  const cacheKey = `pulse_${days}`;

  // 1. Fetch RSS Feeds
  const [usArticles, cnArticles] = await Promise.all([
    getFeedItems(SOURCES.US.map(s => s.url)),
    getFeedItems(SOURCES.CN.map(s => s.url)),
  ]);

  // 2. Filter by date
  const now = new Date();
  const filterByDate = (articles: any[]) => articles.filter(a => {
    if (!a.pubDate) return true;
    const pubDate = new Date(a.pubDate);
    const diffTime = Math.abs(now.getTime() - pubDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  });

  const filteredUS = filterByDate(usArticles);
  const filteredCN = filterByDate(cnArticles);

  // 3. Prepare prompt for Gemini
  const usText = filteredUS.slice(0, 200).map(a => a.title).join("\n");
  const cnText = filteredCN.slice(0, 200).map(a => a.title).join("\n");

  const prompt = `
    Analyze the following tech news titles from the US and China from the last ${days} days.
    1. Extract the top 10 keywords/topics for each region based on frequency and significance.
    2. For each keyword, provide:
       - "word": keyword representation (Use bilingual format: "中文 (英文)" for China, "English (Chinese)" for US).
       - "score": importance/trend score (1-100).
       - "mentionCount": frequency of this topic.
    3. For each region, provide two summaries:
       - "summary_zh": A brief summary in Chinese (max 150 characters).
       - "summary_en": A brief summary in English (max 120 words).
    Return the data in a strict JSON format.

    US News Titles:
    ${usText || "No recent news found."}

    China News Titles:
    ${cnText || "No recent news found."}
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      us: {
        type: Type.OBJECT,
        properties: {
          keywords: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                score: { type: Type.NUMBER },
                mentionCount: { type: Type.NUMBER }
              },
              required: ["word", "score", "mentionCount"]
            } 
          },
          summary_zh: { type: Type.STRING },
          summary_en: { type: Type.STRING },
        },
        required: ["keywords", "summary_zh", "summary_en"],
      },
      cn: {
        type: Type.OBJECT,
        properties: {
          keywords: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                score: { type: Type.NUMBER },
                mentionCount: { type: Type.NUMBER }
              },
              required: ["word", "score", "mentionCount"]
            } 
          },
          summary_zh: { type: Type.STRING },
          summary_en: { type: Type.STRING },
        },
        required: ["keywords", "summary_zh", "summary_en"],
      },
    },
    required: ["us", "cn"],
  };

  const response = (await generateWithRetry(prompt, schema)) as any;

  let analysis;
  try {
    analysis = JSON.parse(response.text || "{}");
  } catch (e) {
    throw new Error("Failed to parse analysis data from AI");
  }

  const responseData = {
    analysis,
    articles: {
      us: filteredUS,
      cn: filteredCN,
    },
    counts: {
      us: filteredUS.length,
      cn: filteredCN.length
    }
  };

  // Save to cache
  cache[cacheKey] = {
    data: responseData,
    timestamp: Date.now()
  };

  return responseData;
}

app.get("/api/pulse", async (req, res) => {
  const days = parseInt(req.query.days as string) || 7;
  const isRefresh = req.query.refresh === "true";
  const cacheKey = `pulse_${days}`;

  // 1. Check if we should use Cache
  // For 24h view (days = 1), as long as cache exists, we serve it (unless user explicitly refreshes).
  // For 3 days view, we bypass long cache and fetch fresh, but allow a 5-second safety debounce cache.
  const useCache = !isRefresh && (
    days === 1 
      ? !!cache[cacheKey] 
      : (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < 5000))
  );

  if (useCache) {
    console.log(`Serving from shared cache for days: ${days}`);
    return res.json(cache[cacheKey].data);
  }

  // 2. Deduplicate In-Flight Requests
  if (inFlightRequests[cacheKey]) {
    console.log(`Deduplicating shared request for days: ${days}`);
    try {
      const result = await inFlightRequests[cacheKey];
      return res.json(result);
    } catch (err) {
      // If the tracked request failed, we continue
    }
  }

  const pulsePromise = performPulseCrawl(days);
  inFlightRequests[cacheKey] = pulsePromise;

  try {
    const data = await pulsePromise;
    delete inFlightRequests[cacheKey];
    res.json(data);
  } catch (error: any) {
    delete inFlightRequests[cacheKey];
    console.error("Pulse Engine Error:", error);
    if (!res.headersSent) {
      const errorStr = JSON.stringify(error);
      const is429 = error.message?.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED");
      const isDailyQuota = errorStr.includes("GenerateRequestsPerDayPerProjectPerModel-FreeTier");
      
      res.status(is429 ? 429 : 500).json({ 
        error: isDailyQuota ? "DAILY_LIMIT" : (is429 ? "API_LIMIT" : "ENGINE_ERROR"),
        message: isDailyQuota 
          ? "每日配额已用完（20次/天）。请明天再试，或联系管理员切换为付费版以获取更高配额。" 
          : (is429 ? "请求过于频繁，请稍后再试。" : error.message)
      });
    }
  }
});

function getMsUntil9AMBeijing() {
  const now = new Date();
  const tzOffset = 8 * 60; // Beijing time zone offset (UTC+8) in minutes
  const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const nowBeijing = new Date(nowUtc + (tzOffset * 60 * 1000));
  
  const targetBeijing = new Date(nowBeijing);
  targetBeijing.setHours(9, 0, 0, 0);
  
  if (nowBeijing.getTime() >= targetBeijing.getTime()) {
    targetBeijing.setDate(targetBeijing.getDate() + 1);
  }
  
  return targetBeijing.getTime() - nowBeijing.getTime();
}

function scheduleDailyCrawl() {
  const msToNext9AM = getMsUntil9AMBeijing();
  const minsToNext12 = Math.round(msToNext9AM / 1000 / 60);
  console.log(`[Scheduler] Next daily 24h background crawl scheduled in ${minsToNext12} minutes (approx ${(minsToNext12 / 60).toFixed(1)} hours) at Beijing Time 09:00 AM.`);
  
  setTimeout(async () => {
    console.log(`[Scheduler] Triggering scheduled daily background crawl for 24h view (Beijing Time 09:00 AM)...`);
    try {
      await performPulseCrawl(1);
      console.log(`[Scheduler] Daily 24h background crawl successfully completed and cached.`);
    } catch (error: any) {
      console.error(`[Scheduler] Daily background crawl failed:`, error.message || error);
    }
    // Schedule the next daily one
    scheduleDailyCrawl();
  }, msToNext9AM);
}

async function warmUpCache() {
  const cacheKey = "pulse_1";
  if (!cache[cacheKey]) {
    console.log("[Scheduler] Indexing 24h data on server startup to warm up cache...");
    try {
      await performPulseCrawl(1);
      console.log("[Scheduler] Cache warmed up successfully on startup.");
    } catch (error: any) {
      console.warn("[Scheduler] Cache warming failed on startup (will fetch on demand):", error.message || error);
    }
  }
}

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Warm up cache and start daily scheduler (non-blocking)
    warmUpCache();
    scheduleDailyCrawl();
  });
}

start();
