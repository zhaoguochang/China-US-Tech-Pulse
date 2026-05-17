/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  Zap, 
  TrendingUp, 
  Newspaper, 
  ExternalLink, 
  Loader2, 
  RefreshCcw,
  Target,
  BarChart3,
  Download,
  Calendar,
  LayoutDashboard,
  XCircle,
  Copy,
  Image as ImageIcon,
  Sun,
  Moon
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Article {
  title: string;
  link: string;
  pubDate: string;
  content: string;
}

interface Keyword {
  word: string;
  score: number;
  mentionCount: number;
}

interface RegionAnalysis {
  keywords: Keyword[];
  summary: string;
}

interface PulseData {
  analysis: {
    us: RegionAnalysis;
    cn: RegionAnalysis;
  };
  articles: {
    us: Article[];
    cn: Article[];
  };
  counts: {
    us: number;
    cn: number;
  };
}

const translations = {
  en: {
    title: "Global Tech Pulse",
    subtitle: "China vs US",
    systemStatus: "System Status",
    liveAnalysis: "Live Analysis",
    refreshScan: "Refresh Pulse",
    scanning: "Scanning...",
    loadingText: "Scraping RSS Feeds & Analyzing with Gemini AI...",
    errorTitle: "Something went wrong",
    tryAgain: "Try Again",
    usTitle: "United States",
    usSub: "Western Tech Landscape",
    cnTitle: "China",
    cnSub: "Eastern Digital Frontier",
    aiSummary: "AI Strategic Summary",
    latestBriefing: "Latest Media Briefing",
    items: "Items",
    sectorPulsing: "Sector Pulsing",
    footerQuote: "Understanding the pulse of the two largest technology ecosystems in the world.",
    footerCredit: "Analyzed by Gemini-3-Flash / Powered by Tech Pulse Engine",
    author: "Created by Guochang Zhao",
    usSources: "US Sources",
    cnSources: "CN Sources",
    langToggle: "ZH",
    timeRange: "Time Range",
    last24h: "Last 24h",
    last3d: "Last 3d",
    last7d: "Last 7d",
    custom: "Custom",
    cancel: "Stop",
    daysUnit: "days",
    basedOn: "Based on {n} reports",
    download: "Download Report",
    copy: "Copy to Clipboard",
    viewAnalysis: "Analysis",
    viewCharts: "Charts",
    chartTitle: "Keyword Frequency & Importance",
    scoreNote: "Scores are relative to the current analysis period and may not be directly comparable across different dates.",
    apiLimitError: "API Limit Reached: Too many requests. Please wait about 1-2 minutes for the quota to reset.",
    period: "Period",
    snapshot: "Snapshot",
    downloadImage: "Export Image"
  },
  zh: {
    title: "全球科技脉搏",
    subtitle: "中国 vs 美国",
    systemStatus: "系统状态",
    liveAnalysis: "实时分析中",
    refreshScan: "刷新脉搏",
    scanning: "扫描中...",
    loadingText: "正在抓取 RSS 订阅并使用 Gemini AI 进行分析...",
    errorTitle: "出错了",
    tryAgain: "重试",
    usTitle: "美国",
    usSub: "西方科技版图",
    cnTitle: "中国",
    cnSub: "东方数字前沿",
    aiSummary: "AI 战略摘要",
    latestBriefing: "最新媒体简报",
    items: "条内容",
    sectorPulsing: "行业动态",
    footerQuote: "“洞察全球两大科技生态系统的脉动。”",
    footerCredit: "由 Gemini-3-Flash 分析 / 技术脉搏引擎驱动",
    author: "作者：Guochang Zhao",
    usSources: "美国来源",
    cnSources: "中国来源",
    langToggle: "EN",
    timeRange: "时间范围",
    last24h: "最近 24 小时",
    last3d: "最近 3 天",
    last7d: "最近 7 天",
    custom: "自定义",
    cancel: "停止",
    daysUnit: "天",
    basedOn: "基于 {n} 篇报道",
    download: "下载数据报告",
    copy: "复制到剪贴板",
    viewAnalysis: "分析视图",
    viewCharts: "图表视图",
    chartTitle: "关键词频次与重要性分析",
    scoreNote: "注：分值反映当前周期内的相对热度，不同时间段的数据可能不具直接可比性。",
    apiLimitError: "达到 API 限制：请求过于频繁。请等待约 1-2 分钟让配额重置后再试。",
    period: "统计周期",
    snapshot: "统计时点",
    downloadImage: "导出图片"
  }
};

export default function App() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "zh">("zh");
  const [days, setDays] = useState<number>(1);
  const [view, setView] = useState<"analysis" | "charts">("analysis");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customDays, setCustomDays] = useState("14");
  const abortControllerRef = useRef<AbortController | null>(null);
  const dataCache = useRef<Record<string, PulseData>>({});

  const t = translations[lang];

  const toggleLang = () => {
    const newLang = lang === "en" ? "zh" : "en";
    setLang(newLang);
    // fetchData will be triggered by useEffect
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(customDays);
    if (!isNaN(d) && d > 0) {
      setDays(d);
      setShowCustomRange(false);
    }
  };

  const downloadCSV = () => {
    if (!data) return;

    const timestamp = new Date().toISOString().split('T')[0];

    // 1. Keywords CSV
    let keywordsCsv = "\uFEFF"; // UTF-8 BOM
    keywordsCsv += "Region,Keyword,Importance Score (1-100),Mention Count (Approx)\n";
    data.analysis.us.keywords.forEach(k => {
      keywordsCsv += `US,"${k.word.replace(/"/g, '""')}",${k.score},${k.mentionCount}\n`;
    });
    data.analysis.cn.keywords.forEach(k => {
      keywordsCsv += `CN,"${k.word.replace(/"/g, '""')}",${k.score},${k.mentionCount}\n`;
    });

    const keywordsBlob = new Blob([keywordsCsv], { type: 'text/csv;charset=utf-8;' });
    const keywordsUrl = URL.createObjectURL(keywordsBlob);
    const keywordsLink = document.createElement('a');
    keywordsLink.href = keywordsUrl;
    keywordsLink.download = `TechPulse_Keywords_${timestamp}_${days}d.csv`;
    keywordsLink.click();
    URL.revokeObjectURL(keywordsUrl);

    // 2. Articles CSV (Source Data)
    let articlesCsv = "\uFEFF"; // UTF-8 BOM
    articlesCsv += "Region,Title,Link,Publication Date\n";
    data.articles.us.forEach(a => {
      articlesCsv += `US,"${a.title.replace(/"/g, '""')}",${a.link},${a.pubDate}\n`;
    });
    data.articles.cn.forEach(a => {
      articlesCsv += `CN,"${a.title.replace(/"/g, '""')}",${a.link},${a.pubDate}\n`;
    });

    const articlesBlob = new Blob([articlesCsv], { type: 'text/csv;charset=utf-8;' });
    const articlesUrl = URL.createObjectURL(articlesBlob);
    const articlesLink = document.createElement('a');
    articlesLink.href = articlesUrl;
    articlesLink.download = `TechPulse_Sources_${timestamp}_${days}d.csv`;
    // Slight delay to ensure first download starts
    setTimeout(() => {
      articlesLink.click();
      URL.revokeObjectURL(articlesUrl);
    }, 100);
  };

  const copyToClipboard = async () => {
    if (!data) return;
    
    let csv = "";
    // SECTION: KEYWORDS ANALYSIS
    csv += "SECTION: KEYWORDS ANALYSIS\n";
    csv += "Region,Keyword,Importance Score,Mention Count\n";
    data.analysis.cn.keywords.forEach(k => {
      csv += `CN,"${k.word.replace(/"/g, '""')}",${k.score},${k.mentionCount}\n`;
    });
    data.analysis.us.keywords.forEach(k => {
      csv += `US,"${k.word.replace(/"/g, '""')}",${k.score},${k.mentionCount}\n`;
    });
    
    csv += "\n";
    
    // SECTION: SOURCE ARTICLES
    csv += "SECTION: SOURCE ARTICLES\n";
    csv += "Region,Title,Link,Publication Date\n";
    data.articles.cn.forEach(a => {
      csv += `CN,"${a.title.replace(/"/g, '""')}",${a.link},${a.pubDate}\n`;
    });
    data.articles.us.forEach(a => {
      csv += `US,"${a.title.replace(/"/g, '""')}",${a.link},${a.pubDate}\n`;
    });

    try {
      await navigator.clipboard.writeText(csv);
      const msg = lang === "zh" ? "已复制到剪贴板 (UTF-8)" : "Copied to clipboard (UTF-8)";
      alert(msg);
    } catch (err) {
      console.error("Clipboard Error:", err);
    }
  };

  const exportChartAsImage = async (chartId: string, filename: string) => {
    const element = document.getElementById(chartId);
    if (!element) return;
    
    try {
      // Small timeout to ensure browser is settled
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(element, {
        backgroundColor: theme === 'light' ? '#E4E3E0' : '#141414',
        scale: 2, 
        logging: false,
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(chartId);
          if (clonedElement) {
            clonedElement.style.width = '1200px'; 
            clonedElement.style.height = 'auto';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.padding = '60px'; // More padding for nicer export
            clonedElement.style.borderRadius = '0';
            
            // Ensure Recharts SVGs have enough space to render
            const svgs = clonedElement.getElementsByTagName('svg');
            for (let i = 0; i < svgs.length; i++) {
              svgs[i].style.overflow = 'visible';
              svgs[i].setAttribute('width', '1100');
            }
          }
        }
      });
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png', 1.0);
    } catch (err) {
      console.error("Export Error Detail:", err);
    }
  };

  const getSnapshotTime = () => {
    return new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPeriodRange = () => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = lang === 'zh' ? 'zh-CN' : 'en-US';
    const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit' };
    return `${start.toLocaleString(fmt, opt)} - ${now.toLocaleString(fmt, opt)}`;
  };

  const fetchData = async (currentLang: "en" | "zh", currentDays: number) => {
    const cacheKey = `${currentLang}_${currentDays}`;
    
    // Client-side cache check
    if (dataCache.current[cacheKey]) {
      setData(dataCache.current[cacheKey]);
      setLoading(false);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/pulse?lang=${currentLang}&days=${currentDays}`, {
        signal: controller.signal
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const rawError = errorData.error?.message || errorData.error || "";
        const errorMsg = errorData.message || (typeof rawError === 'string' ? rawError : "Failed to fetch pulse data");
        
        // Handle specific limit errors
        if (res.status === 429 || errorData.error === "DAILY_LIMIT" || errorData.error === "API_LIMIT") {
          throw new Error(errorMsg || t.apiLimitError);
        }
        
        throw new Error(errorMsg);
      }
      
      const d = await res.json();
      dataCache.current[cacheKey] = d; // Update client cache
      setData(d);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Pulse scan cancelled by user');
        // Loading state is handled in handleCancel for explicit stop
      } else {
        console.error("Fetch Error:", err);
        setError(err.message || "Connection lost with the pulse engine");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    fetchData(lang, days);
  }, [lang, days]);

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-current transition-colors duration-300",
      theme === "light" ? "bg-[#E4E3E0] text-[#141414]" : "bg-[#141414] text-[#E4E3E0]"
    )}>
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-50 backdrop-blur-md transition-colors",
        theme === "light" ? "border-[#141414] bg-[#E4E3E0]/80" : "border-[#E4E3E0]/10 bg-[#141414]/80"
      )}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-sm shadow-lg transition-colors",
              theme === "light" ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#E4E3E0] text-[#141414]"
            )}>
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter leading-none">{t.title}</h1>
              <p className="text-[9px] font-mono opacity-50 tracking-[0.2em] mt-1 italic">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* View Switcher */}
            <div className={cn(
              "flex items-center rounded-sm p-1 border shrink-0 transition-colors",
              theme === "light" ? "bg-[#141414]/5 border-[#141414]/10" : "bg-white/5 border-white/10"
            )}>
              <button
                onClick={() => setView("analysis")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase transition-all",
                  view === "analysis" 
                    ? (theme === "light" ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#E4E3E0] text-[#141414]")
                    : "opacity-50 hover:opacity-100"
                )}
              >
                <LayoutDashboard className="w-3 h-3" />
                {t.viewAnalysis}
              </button>
              <button
                onClick={() => setView("charts")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase transition-all",
                  view === "charts" 
                    ? (theme === "light" ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#E4E3E0] text-[#141414]")
                    : "opacity-50 hover:opacity-100"
                )}
              >
                <BarChart3 className="w-3 h-3" />
                {t.viewCharts}
              </button>
            </div>

            {/* Time Range Selector */}
            <div className={cn(
              "hidden lg:flex items-center rounded-sm p-1 border shrink-0 transition-colors",
              theme === "light" ? "bg-[#141414]/5 border-[#141414]/10" : "bg-white/5 border-white/10"
            )}>
              {[1, 3, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase transition-all",
                    days === d 
                      ? (theme === "light" ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#E4E3E0] text-[#141414]")
                      : "opacity-50 hover:opacity-100"
                  )}
                >
                  {d === 1 ? t.last24h : d === 3 ? t.last3d : t.last7d}
                </button>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowCustomRange(!showCustomRange)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase transition-all flex items-center gap-1",
                    (![1, 3, 7].includes(days) || showCustomRange)
                      ? (theme === "light" ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#E4E3E0] text-[#141414]")
                      : "opacity-50 hover:opacity-100"
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {![1, 3, 7].includes(days) ? `${days}${t.daysUnit}` : t.custom}
                </button>
                <AnimatePresence>
                  {showCustomRange && (
                    <motion.form
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onSubmit={handleCustomRangeSubmit}
                      className={cn(
                        "absolute top-full right-0 mt-2 p-4 shadow-2xl z-[60] flex flex-col gap-2 rounded-sm border",
                        theme === "light" ? "bg-[#141414] text-[#E4E3E0] border-[#E4E3E0]/10" : "bg-[#E4E3E0] text-[#141414] border-[#141414]/10"
                      )}
                    >
                      <label className="text-[9px] uppercase font-bold tracking-widest opacity-50">{t.custom} ({t.daysUnit})</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          className={cn(
                            "border px-2 py-1 text-xs outline-none w-20",
                            theme === "light" ? "bg-[#E4E3E0]/10 border-[#E4E3E0]/20" : "bg-[#141414]/10 border-[#141414]/20"
                          )}
                        />
                        <button type="submit" className={cn(
                          "px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                          theme === "light" ? "bg-[#E4E3E0] text-[#141414]" : "bg-[#141414] text-[#E4E3E0]"
                        )}>OK</button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={copyToClipboard}
                disabled={!data || loading}
                className={cn(
                  "p-2 border transition-colors disabled:opacity-20",
                  theme === "light" ? "border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" : "border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]"
                )}
                title={t.copy}
              >
                <Copy className="w-4 h-4" />
              </button>

              <button 
                onClick={downloadCSV}
                disabled={!data || loading}
                className={cn(
                  "p-2 border transition-colors disabled:opacity-20",
                  theme === "light" ? "border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" : "border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]"
                )}
                title={t.download}
              >
                <Download className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={cn(
                  "p-2 border transition-colors",
                  theme === "light" ? "border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" : "border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]"
                )}
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              <button 
                onClick={toggleLang}
                className={cn(
                  "px-3 py-1 border transition-colors text-[10px] font-bold h-[34px]",
                  theme === "light" ? "border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" : "border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]"
                )}
              >
                {t.langToggle}
              </button>
            </div>

            <div className="hidden xl:flex flex-col items-end mr-4">
              <span className="text-[10px] font-mono opacity-40 tracking-widest">{t.systemStatus}</span>
              <span className={cn(
                "text-[9px] font-bold flex items-center gap-1",
                loading ? "text-amber-500" : "text-green-500"
              )}>
                <div className={cn(
                  "w-1 h-1 rounded-full animate-pulse",
                  loading ? "bg-amber-500" : "bg-green-500"
                )} /> {loading ? t.scanning : t.liveAnalysis}
              </span>
            </div>
            
            {loading ? (
              <button 
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 font-bold uppercase text-[11px] tracking-widest"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t.cancel}
              </button>
            ) : (
              <button 
                onClick={() => fetchData(lang, days)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 border transition-all active:scale-95 disabled:opacity-50 font-bold text-[11px] tracking-widest",
                  theme === "light" ? "border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" : "border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]"
                )}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                {t.refreshScan}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <Loader2 className="w-12 h-12 animate-spin" />
              <p className="font-mono text-sm animate-pulse">{t.loadingText}</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-12 text-center rounded-sm border-2 flex flex-col items-center gap-6",
                theme === 'light' 
                  ? "bg-red-50 border-red-200 text-red-900" 
                  : "bg-red-950/20 border-red-900/50 text-red-200"
              )}
            >
              <div className="p-4 bg-red-500 text-white rounded-full">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h2 className="text-xl font-bold uppercase tracking-tighter mb-2 italic">
                  {error === t.apiLimitError ? "System Congestion" : "System Error"}
                </h2>
                <p className="text-sm font-mono opacity-80 leading-relaxed">{error}</p>
              </div>
              <button 
                onClick={() => fetchData(lang, days)} 
                className={cn(
                  "px-8 py-3 font-bold uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95",
                  theme === 'light' ? "bg-red-900 text-white" : "bg-red-500 text-white"
                )}
              >
                {t.tryAgain || "Try Again"}
              </button>
            </motion.div>
          ) : data ? (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {view === "analysis" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <RegionColumn 
                    title={t.cnTitle} 
                    sub={t.cnSub}
                    analysis={data.analysis.cn}
                    articles={data.articles.cn.slice(0, 20)}
                    count={data.counts.cn}
                    accent="red"
                    theme={theme}
                    labels={{
                      aiSummary: t.aiSummary,
                      latestBriefing: t.latestBriefing,
                      items: t.items,
                      sectorPulsing: t.sectorPulsing,
                      basedOn: t.basedOn
                    }}
                  />
                  <RegionColumn 
                    title={t.usTitle} 
                    sub={t.usSub}
                    analysis={data.analysis.us}
                    articles={data.articles.us.slice(0, 20)}
                    count={data.counts.us}
                    accent="cyan"
                    theme={theme}
                    labels={{
                      aiSummary: t.aiSummary,
                      latestBriefing: t.latestBriefing,
                      items: t.items,
                      sectorPulsing: t.sectorPulsing,
                      basedOn: t.basedOn
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-16">
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">{t.chartTitle}</h2>
                    <p className="font-mono text-[9px] opacity-40 uppercase tracking-[0.3em] max-w-2xl mx-auto">{t.scoreNote}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <RegionChart 
                      id="chart-cn"
                      title={t.cnTitle} 
                      data={data.analysis.cn.keywords} 
                      color="#ef4444" 
                      sub={t.cnSub}
                      days={days}
                      snapshot={getSnapshotTime()}
                      theme={theme}
                      onExport={() => exportChartAsImage("chart-cn", `CN_TechPulse_${days}d.png`)}
                      labels={{
                        period: t.period,
                        snapshot: t.snapshot,
                        downloadImage: t.downloadImage
                      }}
                    />
                    <RegionChart 
                      id="chart-us"
                      title={t.usTitle} 
                      data={data.analysis.us.keywords} 
                      color="#0891b2" 
                      sub={t.usSub}
                      days={days}
                      snapshot={getSnapshotTime()}
                      theme={theme}
                      onExport={() => exportChartAsImage("chart-us", `US_TechPulse_${days}d.png`)}
                      labels={{
                        period: t.period,
                        snapshot: t.snapshot,
                        downloadImage: t.downloadImage
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <footer className={cn(
        "border-t py-12 mt-24 mb-12 transition-colors",
        theme === 'light' ? "border-[#141414]/10" : "border-white/10"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 opacity-40" />
              <span className="font-bold uppercase tracking-tighter opacity-80">{t.title}</span>
            </div>
            <p className="text-[10px] font-mono opacity-30 mb-4 tracking-widest">{t.author}</p>
            <p className="font-serif italic text-lg mb-2 opacity-80 truncate-lines-3">{t.footerQuote}</p>
            <p className="text-[10px] opacity-40 font-mono uppercase tracking-widest">{t.footerCredit}</p>
          </div>
          <div className="grid grid-cols-2 gap-12 sm:gap-24">
            <div>
              <h4 className="text-[10px] uppercase font-bold opacity-30 mb-4 tracking-widest border-b pb-1 inline-block">{t.cnSources}</h4>
              <ul className="text-[10px] space-y-1 font-mono hover:opacity-100 opacity-60 transition-opacity">
                <li>36Kr / ITHome</li>
                <li>PingWest / TMTPost</li>
                <li>Huxiu / Lieyunwang</li>
                <li>DoNews / GeekPark</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold opacity-30 mb-4 tracking-widest border-b pb-1 inline-block">{t.usSources}</h4>
              <ul className="text-[10px] space-y-1 font-mono hover:opacity-100 opacity-60 transition-opacity">
                <li>TechCrunch / Verge</li>
                <li>Wired / Engadget</li>
                <li>Ars Technica / VentureBeat</li>
                <li>CNET / Mashable</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RegionChart({ id, title, data, color, sub, days, snapshot, theme, onExport, labels }: { 
  id: string,
  title: string, 
  data: Keyword[], 
  color: string, 
  sub: string, 
  days: number, 
  snapshot: string,
  theme: 'light' | 'dark',
  onExport: () => void,
  labels: { period: string, snapshot: string, downloadImage: string }
}) {
  const chartData = [...data].sort((a, b) => b.score - a.score);

  return (
    <div id={id} className={cn(
      "p-8 rounded-sm shadow-2xl border transition-colors relative overflow-hidden",
      theme === 'light' ? "bg-white border-[#141414]/10" : "bg-[#141414] border-white/5"
    )}>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
        <div className="border-l-4 border-current pl-6" style={{ color }}>
          <h3 className="text-3xl font-black tracking-tighter italic">{title}</h3>
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-80" style={{ color }}>{sub}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-6 self-stretch sm:self-auto">
          <div className="flex flex-col text-[10px] font-mono tracking-widest opacity-80" style={{ color }}>
            <p>
              {labels.period}: <span className="font-bold">{days}D</span>
            </p>
            <p>
              {labels.snapshot}: <span className="font-bold">{snapshot}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="h-[450px] w-full mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? "#DDD" : "#333"} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="word" 
              type="category" 
              stroke={theme === 'light' ? "#141414" : "#FFF"} 
              fontSize={10} 
              width={150}
              tick={{ fill: theme === 'light' ? "#141414" : "#FFF" }}
            />
            <RechartsTooltip 
              cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as Keyword;
                  return (
                    <div className={cn(
                      "px-3 py-2 text-xs font-bold border-2 shadow-xl",
                      theme === 'light' ? "bg-[#141414] text-[#E4E3E0] border-[#141414]" : "bg-white text-black border-white"
                    )}>
                      <p>{item.word}</p>
                      <p className="opacity-60 text-[10px]">IMPORTANCE: {item.score}</p>
                      <p className="opacity-60 text-[10px]">MENTIONS: {item.mentionCount}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8 - (index * 0.05)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-end pt-4 border-t border-current/10" style={{ borderColor: `${color}20` }}>
        <button 
          onClick={onExport}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 border font-bold uppercase text-[12px] tracking-widest transition-all active:scale-95 shadow-md",
            theme === 'light' 
              ? "border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]" 
              : "border-white text-white hover:bg-white hover:text-[#141414]"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          {labels.downloadImage}
        </button>
      </div>
    </div>
  );
}

function RegionColumn({ 
  title, 
  sub, 
  analysis, 
  articles, 
  count, 
  accent, 
  labels,
  theme
}: { 
  title: string, 
  sub: string, 
  analysis: RegionAnalysis, 
  articles: Article[],
  count: number,
  accent: "cyan" | "red",
  theme: 'light' | 'dark',
  labels: {
    aiSummary: string;
    latestBriefing: string;
    items: string;
    sectorPulsing: string;
    basedOn: string;
  }
}) {
  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="relative">
        <div className={cn(
          "absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-3/4",
          accent === "cyan" ? "bg-cyan-600" : "bg-red-600"
        )} />
        <h2 className={cn(
          "text-5xl font-black tracking-tighter leading-none italic font-serif text-current",
          title.length > 5 ? "text-4xl" : "text-5xl"
        )}>{title}</h2>
        <p className="text-xs font-mono tracking-[0.3em] mt-1" style={{ color: accent === "cyan" ? "#0891b2" : "#ef4444" }}>{sub}</p>
      </div>

      {/* Analysis Block */}
      <div className={cn(
        "p-8 rounded-sm shadow-2xl relative overflow-hidden transition-colors border",
        theme === 'light' ? "bg-white text-[#141414] border-[#141414]/10" : "bg-[#141414] text-[#E4E3E0] border-white/5"
      )}>
        <div className={cn(
          "absolute top-0 right-0 px-3 py-1 text-[9px] font-mono",
          accent === "cyan" 
            ? (theme === 'light' ? "bg-cyan-100 text-cyan-800" : "bg-cyan-900/50 text-cyan-400") 
            : (theme === 'light' ? "bg-red-100 text-red-800" : "bg-red-900/50 text-red-400")
        )}>
          {labels.basedOn.replace("{n}", count.toString())}
        </div>
        <div className="flex items-center gap-2 mb-6 opacity-60">
          <Target className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-widest">{labels.aiSummary}</span>
        </div>
        <p className="text-lg font-serif leading-relaxed italic mb-8">
          {analysis.summary}
        </p>
        
        <div className="flex flex-wrap gap-2">
          {analysis.keywords.map((item, i) => (
            <span 
              key={i} 
              className={cn(
                "px-3 py-1 text-[10px] font-bold border transition-colors",
                accent === "cyan" 
                  ? (theme === 'light' ? "border-cyan-200 bg-cyan-50/50 text-cyan-700" : "border-cyan-500 text-cyan-400") 
                  : (theme === 'light' ? "border-red-200 bg-red-50/50 text-red-700" : "border-red-500 text-red-400")
              )}
            >
              {item.word}
            </span>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex flex-col gap-6">
        <div className={cn(
          "flex items-center justify-between border-b pb-2",
          theme === 'light' ? "border-[#141414]/20" : "border-[#E4E3E0]/20"
        )}>
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-widest">{labels.latestBriefing}</span>
          </div>
          <span className="text-[10px] font-mono opacity-50">{articles.length} {labels.items}</span>
        </div>

        <ul className={cn(
          "divide-y",
          theme === 'light' ? "divide-[#141414]/10" : "divide-[#E4E3E0]/10"
        )}>
          {articles.map((article, i) => (
            <motion.li 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group py-4 flex flex-col gap-1"
            >
              <div className="flex justify-between items-start gap-4">
                <a 
                  href={article.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-bold text-sm group-hover:underline underline-offset-4 decoration-2 leading-snug"
                >
                  {article.title}
                </a>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono opacity-50 mt-1">
                <span className="flex items-center gap-1"><TrendingUp className="w-2 h-2" /> {labels.sectorPulsing}</span>
                <span>{new Date(article.pubDate).toLocaleDateString()}</span>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
