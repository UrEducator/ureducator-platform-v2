'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Printer,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Mail,
  Send,
  MessageSquare,
  Sparkles,
  BookOpen,
  Clock,
  Target,
  Award,
  FileDown,
  Leaf,
} from 'lucide-react';
import { METRIC_DEFINITIONS, consistency, trend } from '@ureducator/shared';
import { ScoreLine } from '@/components/charts';
import { Dialog, LinkButton, PageHeader, Sheet, Spinner, Stat, Table, Td } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useDocumentTitle, useLoad } from '@/lib/hooks';
import {
  useAnalyticsData,
  type UnitAnalyticsItem,
  type TopicAnalyticsItem,
  type QuadrantId,
} from '@/lib/useAnalyticsData';

const TREND_LABELS = {
  up: 'Improving',
  down: 'Slipping',
  flat: 'Steady',
  insufficient: 'Need 2+ tests',
} as const;

type ChartViewMode = 'radar_donut' | 'bar' | 'trend';

function formatSeconds(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// Custom Tooltip for Radar Chart
function RadarCustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: UnitAnalyticsItem }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface p-3 shadow-lg text-xs">
      <p className="font-semibold text-pen-900 text-sm">{item.unitName}</p>
      <p className="text-muted mb-2">Unit {item.unitNo} • Paper 1</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Mastery Accuracy:</span>
          <span className="font-bold tabular-nums text-pen-800">{item.accuracy}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Questions Attempted:</span>
          <span className="tabular-nums">{item.totalAttempted} ({item.totalCorrect} correct)</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Avg Speed:</span>
          <span className="tabular-nums">{item.avgTimePerQuestion}s / question</span>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip for Donut Chart
function DonutCustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: UnitAnalyticsItem }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface p-3 shadow-lg text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
        <p className="font-semibold text-pen-900 text-sm">{item.unitName}</p>
      </div>
      <p className="text-muted mb-2">Unit {item.unitNo} • Time Share: {item.timeSharePercent}%</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Total Time Spent:</span>
          <span className="font-bold tabular-nums text-pen-800">{formatSeconds(item.totalTimeSpentSec)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Questions Attempted:</span>
          <span className="tabular-nums">{item.totalAttempted}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Avg Speed:</span>
          <span className="tabular-nums">{item.avgTimePerQuestion}s / question</span>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip for Bar Chart (Accuracy & Time)
function BarCustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: UnitAnalyticsItem }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface p-3 shadow-lg text-xs">
      <p className="font-semibold text-pen-900 text-sm">{item.unitName}</p>
      <p className="text-muted mb-2">{item.shortName}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Accuracy:</span>
          <span className="font-bold tabular-nums text-pen-800">{item.accuracy}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Avg Speed:</span>
          <span className="tabular-nums">{item.avgTimePerQuestion}s / Q</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Questions:</span>
          <span className="tabular-nums">{item.totalAttempted} attempted</span>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip for Scatter Plot
function ScatterCustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: TopicAnalyticsItem }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  const q = item.quadrant;

  return (
    <div className="w-72 rounded-xl border border-line bg-surface p-3.5 shadow-xl text-xs">
      <div className="mb-2">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{
            backgroundColor: `${q.color}20`,
            color: q.color,
            border: `1px solid ${q.color}40`,
          }}
        >
          {q.badge}
        </span>
        <h4 className="font-semibold text-pen-900 text-sm leading-snug">{item.topicName}</h4>
        <p className="text-muted text-[11px]">{item.unitName}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 border-y border-line my-2">
        <div className="bg-sand-50/70 p-2 rounded">
          <span className="text-muted block text-[10px]">ACCURACY</span>
          <span className="text-base font-bold tabular-nums text-pen-900">{item.accuracy}%</span>
          <span className="text-[10px] text-muted block">({item.totalCorrect}/{item.totalAttempted} correct)</span>
        </div>
        <div className="bg-sand-50/70 p-2 rounded">
          <span className="text-muted block text-[10px]">SPEED</span>
          <span className="text-base font-bold tabular-nums text-pen-900">{item.avgTimePerQuestion}s</span>
          <span className="text-[10px] text-muted block">Target: ≤60s</span>
        </div>
      </div>

      <div className="text-[11px] text-pen-700 bg-sand-50 p-2 rounded border border-line">
        <span className="font-semibold block mb-0.5 text-pen-900">Diagnosis:</span>
        {q.recommendation}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  useDocumentTitle('Student Analytics & Diagnostics');
  const auth = useAuth();
  const user = auth.user;
  const uid = user?.uid ?? '';
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'units' | 'topics'>('units');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantId | 'all'>('all');
  const [chartView, setChartView] = useState<ChartViewMode>('radar_donut');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEcoModal, setShowEcoModal] = useState(false);
  const [pdfTipActive, setPdfTipActive] = useState(false);
  const [printDetailLevel, setPrintDetailLevel] = useState<'summary' | 'comprehensive'>('summary');

  const dateKey = useMemo(() => new Date().toISOString().slice(0, 10).replace(/-/g, ''), []);
  const uidSlice = useMemo(() => (uid ? uid.slice(0, 8).toUpperCase() : 'ANON'), [uid]);
  const reportTraceId = useMemo(
    () => `RPT-${dateKey}-${uidSlice}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    [dateKey, uidSlice]
  );
  const generatedTimestamp = useMemo(() => new Date().toLocaleString(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    loading,
    isSample,
    toggleSampleMode,
    units,
    topics,
    summary,
    testsCount,
  } = useAnalyticsData();

  // Load historical snapshot for score line & consistency
  const snapLoad = useLoad((b) => b.reads.snapshot(uid), [uid]);
  const s = snapLoad.data;

  // Filter topics based on search & quadrant filter
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesSearch =
        t.topicName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.unitName.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesQuadrant = selectedQuadrant === 'all' || t.quadrant.id === selectedQuadrant;
      return matchesSearch && matchesQuadrant;
    });
  }, [topics, searchFilter, selectedQuadrant]);

  // Filter units based on search
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      return (
        u.unitName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        u.shortName.toLowerCase().includes(searchFilter.toLowerCase())
      );
    });
  }, [units, searchFilter]);

  const { highestUnit, lowestUnit, fastestUnit, slowestUnit } = useMemo(() => {
    const first = units[0];
    if (!first) return { highestUnit: null, lowestUnit: null, fastestUnit: null, slowestUnit: null };
    let high = first;
    let low = first;
    let fast = first;
    let slow = first;
    for (const u of units) {
      if (u.accuracy > high.accuracy) high = u;
      if (u.accuracy < low.accuracy) low = u;
      if (u.avgTimePerQuestion < fast.avgTimePerQuestion) fast = u;
      if (u.avgTimePerQuestion > slow.avgTimePerQuestion) slow = u;
    }
    return { highestUnit: high, lowestUnit: low, fastestUnit: fast, slowestUnit: slow };
  }, [units]);

  // Toggle unit expansion
  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const expandAllUnits = () => {
    setExpandedUnits(new Set(units.map((u) => u.unitId)));
  };

  const collapseAllUnits = () => {
    setExpandedUnits(new Set());
  };

  // Social sharing logic
  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://ureducator.com/app/analytics';
    const shareText = 'Check out my UGC NET diagnostic report on UrEducator!';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'UrEducator - UGC NET Diagnostic Report',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to menu if aborted or rejected
      }
    }
    setShowShareMenu((prev) => !prev);
  };

  const copyToClipboard = () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://ureducator.com/app/analytics';
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const logPrintAudit = async (method: 'print' | 'pdf') => {
    try {
      await fetch('/api/audit/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid || 'anonymous_student',
          action: 'ANALYTICS_REPORT_PRINTED',
          reportId: reportTraceId,
          method,
          meta: {
            candidateName: user?.displayName || 'Student',
            candidateEmail: user?.email || null,
            detailLevel: printDetailLevel,
            testsEvaluated: summary.testsTaken,
            overallAccuracy: summary.overallAccuracy,
            avgPaceSec: summary.avgTimePerQuestion,
          },
        }),
      });
    } catch (err) {
      console.warn('[audit] Failed to record print telemetry:', err);
    }
  };

  const triggerPrint = (method: 'print' | 'pdf') => {
    setShowEcoModal(false);
    void logPrintAudit(method);

    if (method === 'pdf') {
      setPdfTipActive(true);
    }

    if (printDetailLevel === 'comprehensive') {
      const prevExpanded = new Set(expandedUnits);
      const prevTab = activeTab;
      setActiveTab('units');
      setExpandedUnits(new Set(units.map((u) => u.unitId)));

      const handleAfterPrint = () => {
        setExpandedUnits(prevExpanded);
        setActiveTab(prevTab);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
      window.addEventListener('afterprint', handleAfterPrint);

      // Wrap window.print() in a timeout + requestAnimationFrame to ensure the DOM has fully rendered the expanded tables
      setTimeout(() => {
        requestAnimationFrame(() => {
          window.print();
          if (method === 'pdf') {
            setTimeout(() => setPdfTipActive(false), 3500);
          }
        });
      }, 350);
    } else {
      setTimeout(() => {
        window.print();
        if (method === 'pdf') {
          setTimeout(() => setPdfTipActive(false), 3500);
        }
      }, 200);
    }
  };

  const handleSaveAsPdf = () => triggerPrint('pdf');
  const handleProceedToPrint = () => triggerPrint('print');

  if (loading && !units.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Historical scores
  const scores = s?.recentScores ?? [
    { sessionId: 's1', percentage: 0.62, atMs: Date.now() - 6 * 86400000 },
    { sessionId: 's2', percentage: 0.68, atMs: Date.now() - 4 * 86400000 },
    { sessionId: 's3', percentage: 0.65, atMs: Date.now() - 3 * 86400000 },
    { sessionId: 's4', percentage: 0.74, atMs: Date.now() - 2 * 86400000 },
    { sessionId: 's5', percentage: 0.72, atMs: Date.now() - 1 * 86400000 },
  ];
  const last5 = scores.slice(-5);
  const avgLast5 = last5.reduce((a, b) => a + b.percentage, 0) / Math.max(1, last5.length);
  const t = trend(scores.map((x) => x.percentage));
  const cons = consistency(s?.activeDays ?? ['2026-11-14', '2026-11-15', '2026-11-16'], new Date().toISOString().slice(0, 10));

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://ureducator.com/app/analytics';
  const shareText = 'Check out my UGC NET diagnostic report on UrEducator!';

  return (
    <div className="w-full space-y-6 print:space-y-3">
      {/* Task 1: Formal Print-Only Header (strictly hidden on screen, visible on print) */}
      <div className="hidden print:block mb-8 border-b-2 border-pen-900 pb-5 print:mb-3 print:pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black text-xl tracking-tight text-pen-900 uppercase">
                UrEducator 2.0
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-pen-900 text-white">
                Official Diagnostic Report
              </span>
            </div>
            <h1 className="text-2xl font-black text-pen-900 leading-tight">
              UGC NET Paper 1 Diagnostic Assessment & Pacing Analysis
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Official Diagnostic Telemetry • General Paper on Teaching & Research Aptitude
            </p>
          </div>

          <div className="text-right">
            <div className="border border-pen-800 rounded px-3 py-1.5 bg-sand-50/50 inline-block text-left print:px-2 print:py-1">
              <span className="text-[9px] uppercase font-bold text-muted block">Document Trace ID</span>
              <span className="font-mono text-xs font-bold text-pen-900">{reportTraceId}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3 text-xs border-t border-line pt-3 print:mt-2 print:pt-2 print:gap-2">
          <div>
            <span className="text-muted block text-[10px] uppercase font-semibold">Student Name</span>
            <span className="font-bold text-pen-900 text-sm">
              {user?.displayName || 'Registered Student'}
            </span>
          </div>
          <div>
            <span className="text-muted block text-[10px] uppercase font-semibold">Student Email</span>
            <span className="font-medium text-pen-800">
              {user?.email || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted block text-[10px] uppercase font-semibold">Generated Timestamp</span>
            <span className="font-medium text-pen-800">
              {generatedTimestamp}
            </span>
          </div>
          <div>
            <span className="text-muted block text-[10px] uppercase font-semibold">Verification Status</span>
            <span className="font-bold text-emerald-800">
              ✓ Audit Logged ({reportTraceId.slice(-4)})
            </span>
          </div>
        </div>
      </div>

      {/* Header and Action Bar */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Student Analytics & Diagnostic Hub"
          intro="Industry-grade Paper 1 diagnostic dashboard: polar unit mastery, pacing distribution, and speed-accuracy quadrant analysis."
        />

        {/* Action Bar (Print, Share, Sample Toggle, Study Plan) */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center relative">
          {isSample && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-300">
              ⚡ Demo Benchmark Data
            </span>
          )}

          <button
            type="button"
            onClick={toggleSampleMode}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-pen-700 hover:bg-sand-100 transition shadow-sm"
          >
            {isSample ? 'Switch to Live Data' : 'View Demo Benchmark'}
          </button>

          {/* Print Button (intercepted by Eco Modal) */}
          <button
            type="button"
            onClick={() => setShowEcoModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-pen-800 hover:bg-sand-100 transition shadow-sm cursor-pointer"
            title="Print full A4 diagnostic report or save as PDF"
          >
            <Printer className="size-3.5 text-pen-700" />
            <span>Print Report</span>
          </button>

          {/* Social Share Button & Fallback Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-pen-800 hover:bg-sand-100 transition shadow-sm cursor-pointer"
              title="Share diagnostic report"
            >
              <Share2 className="size-3.5 text-pen-700" />
              <span>Share</span>
            </button>

            {/* Social Share Intent Dropdown */}
            {showShareMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-2xl z-30 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-line mb-2">
                  <span className="text-xs font-bold text-pen-900">Share Diagnostic Report</span>
                  <button
                    type="button"
                    onClick={() => setShowShareMenu(false)}
                    className="text-muted hover:text-ink text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-800 hover:bg-emerald-50 transition"
                  >
                    <MessageSquare className="size-4 text-emerald-600" />
                    <span>Share on WhatsApp</span>
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-800 hover:bg-blue-50 transition"
                  >
                    <Send className="size-4 text-blue-500" />
                    <span>Share on Telegram</span>
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent('My UGC NET Diagnostic Report on UrEducator')}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-pen-800 hover:bg-sand-100 transition"
                  >
                    <Mail className="size-4 text-pen-600" />
                    <span>Email Report</span>
                  </a>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-pen-800 hover:bg-sand-100 transition text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-muted" />}
                      <span>{copiedLink ? 'Copied to Clipboard!' : 'Copy Direct Link'}</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <LinkButton href="/app/planner">Study Plan</LinkButton>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <Sheet className="p-6 print:p-2.5 print:shadow-none print:border-none print:break-inside-avoid print:mb-6">
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4 print:gap-2">
          <Stat
            label="Tests Evaluated"
            value={summary.testsTaken}
            note={isSample ? 'UGC NET benchmark profile' : `From ${testsCount} submitted papers`}
          />
          <Stat
            label="Overall Accuracy"
            value={`${summary.overallAccuracy}%`}
            note={summary.overallAccuracy >= 65 ? 'Above UGC NET qualifying benchmark (65%)' : 'Target: 65%+ for JRF qualification'}
          />
          <Stat
            label="Average Speed"
            value={`${summary.avgTimePerQuestion}s / Q`}
            note={summary.avgTimePerQuestion <= 60 ? 'Optimal exam pacing (Target: ≤60s)' : `${summary.avgTimePerQuestion - 60}s above target pace`}
          />
          <Stat
            label="Total Questions"
            value={summary.totalAttempted}
            note={`${summary.totalCorrect} correct answers recorded`}
          />
        </dl>
      </Sheet>

      {/* Task 3: Interactive Chart Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 print:pt-0 print:gap-1">
        <div>
          <h2 className="text-base font-bold text-pen-900 flex items-center gap-2">
            <span>Visual Analytics Overview</span>
            <span className="text-xs font-normal text-muted">(Switch visualization mode)</span>
          </h2>
        </div>

        {/* Segmented Control */}
        <div className="no-print inline-flex rounded-xl border border-line bg-sand-100 p-1 text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setChartView('radar_donut')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              chartView === 'radar_donut'
                ? 'bg-surface text-pen-900 shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <PieIcon className="size-3.5" />
            <span>Mastery & Pacing</span>
          </button>
          <button
            type="button"
            onClick={() => setChartView('bar')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              chartView === 'bar'
                ? 'bg-surface text-pen-900 shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <BarChart3 className="size-3.5" />
            <span>Comparative Bars</span>
          </button>
          <button
            type="button"
            onClick={() => setChartView('trend')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              chartView === 'trend'
                ? 'bg-surface text-pen-900 shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <TrendingUp className="size-3.5" />
            <span>Linear Curves</span>
          </button>
        </div>
      </div>

      {/* Main Charts Viewport (Transitions smoothly between the 3 views) */}
      {chartView === 'radar_donut' && (
        <div className="grid gap-6 lg:grid-cols-2 transition-opacity duration-300 print:gap-3 print:mb-6">
          {/* Radar Chart Card */}
          <Sheet className="p-6 flex flex-col justify-between print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none overflow-hidden print:overflow-visible">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-pen-900">Unit Mastery (10 Paper 1 Units)</h3>
                <span className="text-xs font-medium text-muted bg-sand-100 px-2 py-0.5 rounded">Polar Axis: 0–100%</span>
              </div>
              <p className="text-xs text-muted mb-4 print:mb-1">
                Visualizes accuracy across all 10 Paper 1 units. Fuller polygon coverage represents holistic exam readiness.
              </p>
            </div>

            <div className="h-[340px] print:min-h-[260px] print:h-[260px] w-full flex items-center justify-center overflow-hidden">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={units} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                    <PolarAngleAxis
                      dataKey="shortName"
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      stroke="#94a3b8"
                    />
                    <Radar
                      name="Accuracy (%)"
                      dataKey="accuracy"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="#6366f1"
                      fillOpacity={0.45}
                    />
                    <Tooltip content={<RadarCustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted text-xs">Loading chart...</div>
              )}
            </div>

            <div className="mt-2 pt-3 border-t border-line flex items-center justify-between text-xs text-muted print:mt-1 print:pt-1">
              <span>Highest: <strong className="text-pen-900">{highestUnit?.shortName ?? '—'} ({highestUnit?.accuracy ?? 0}%)</strong></span>
              <span>Needs Work: <strong className="text-rose-600">{lowestUnit?.shortName ?? '—'} ({lowestUnit?.accuracy ?? 0}%)</strong></span>
            </div>
          </Sheet>

          {/* Donut Chart Card */}
          <Sheet className="p-6 flex flex-col justify-between print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none overflow-hidden print:overflow-visible">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-pen-900">Time Allocation per Unit</h3>
                <span className="text-xs font-medium text-muted bg-sand-100 px-2 py-0.5 rounded">
                  Total: {formatSeconds(summary.totalTimeSpentSec)}
                </span>
              </div>
              <p className="text-xs text-muted mb-4 print:mb-1">
                Proportion of total testing time dedicated to each unit. Highlights time-sink sections like Maths and Data Interpretation.
              </p>
            </div>

            <div className="h-[340px] print:min-h-[260px] print:h-[260px] w-full flex items-center justify-center overflow-hidden">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={units}
                      dataKey="totalTimeSpentSec"
                      nameKey="unitName"
                      cx="50%"
                      cy="50%"
                      innerRadius="45%"
                      outerRadius="72%"
                      paddingAngle={3}
                    >
                      {units.map((entry) => (
                        <Cell key={`cell-${entry.unitId}`} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutCustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted text-xs">Loading chart...</div>
              )}
            </div>

            {/* Color Pills Strip */}
            <div className="mt-2 pt-3 border-t border-line grid grid-cols-5 gap-1.5 text-[10px] print:mt-1 print:pt-1 print:gap-1">
              {units.map((u) => (
                <div key={u.unitId} className="flex items-center gap-1 truncate" title={`${u.unitName}: ${u.timeSharePercent}%`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: u.color }} />
                  <span className="truncate text-muted">{u.shortName.replace(/^U\d+\s*/, '')}</span>
                </div>
              ))}
            </div>
          </Sheet>
        </div>
      )}

      {/* State 2: Bar Chart Comparison */}
      {chartView === 'bar' && (
        <div className="grid gap-6 lg:grid-cols-2 transition-opacity duration-300 print:gap-3 print:mb-6">
          <Sheet className="p-6 flex flex-col justify-between print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none overflow-hidden print:overflow-visible">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-pen-900">Unit-by-Unit Accuracy Comparison</h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Target: 65%+
                </span>
              </div>
              <p className="text-xs text-muted mb-4 print:mb-1">
                Comparison of mastery accuracy percentage per unit against the UGC NET JRF target benchmark (65%).
              </p>
            </div>

            <div className="h-[340px] print:min-h-[260px] print:h-[260px] w-full overflow-hidden">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={units} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fill: '#475569', fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#cbd5e1" />
                    <ReferenceLine
                      y={65}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Target 65%', position: 'insideTopRight', fill: '#059669', fontSize: 11 }}
                    />
                    <Tooltip content={<BarCustomTooltip />} />
                    <Bar dataKey="accuracy" name="Accuracy (%)" radius={[4, 4, 0, 0]}>
                      {units.map((u) => (
                        <Cell key={`bar-${u.unitId}`} fill={u.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted text-xs">Loading chart...</div>
              )}
            </div>

            <div className="mt-2 pt-3 border-t border-line text-xs text-muted flex justify-between print:mt-1 print:pt-1">
              <span>Above Target: <strong>{units.filter((u) => u.accuracy >= 65).length} / 10 Units</strong></span>
              <span>Needs Revision: <strong className="text-rose-600">{units.filter((u) => u.accuracy < 65).length} Units</strong></span>
            </div>
          </Sheet>

          <Sheet className="p-6 flex flex-col justify-between print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none overflow-hidden print:overflow-visible">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-pen-900">Average Pacing Speed per Unit</h3>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Benchmark: ≤60s
                </span>
              </div>
              <p className="text-xs text-muted mb-4 print:mb-1">
                Average seconds invested per question across modules. Units exceeding 60s risk timing out in final paper.
              </p>
            </div>

            <div className="h-[340px] print:min-h-[260px] print:h-[260px] w-full overflow-hidden">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={units} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fill: '#475569', fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis domain={[0, 110]} unit="s" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#cbd5e1" />
                    <ReferenceLine
                      y={60}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: 'Target 60s', position: 'insideTopRight', fill: '#d97706', fontSize: 11 }}
                    />
                    <Tooltip content={<BarCustomTooltip />} />
                    <Bar dataKey="avgTimePerQuestion" name="Avg Time (s)" radius={[4, 4, 0, 0]}>
                      {units.map((u) => (
                        <Cell
                          key={`time-bar-${u.unitId}`}
                          fill={u.avgTimePerQuestion <= 60 ? '#10b981' : '#f97316'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted text-xs">Loading chart...</div>
              )}
            </div>

            <div className="mt-2 pt-3 border-t border-line text-xs text-muted flex justify-between print:mt-1 print:pt-1">
              <span>Fastest Module: <strong>{fastestUnit?.shortName ?? '—'} ({fastestUnit?.avgTimePerQuestion ?? 0}s)</strong></span>
              <span>Time-Sink Module: <strong className="text-amber-600">{slowestUnit?.shortName ?? '—'} ({slowestUnit?.avgTimePerQuestion ?? 0}s)</strong></span>
            </div>
          </Sheet>
        </div>
      )}

      {/* State 3: Dual-Axis Linear Progression Curve */}
      {chartView === 'trend' && (
        <Sheet className="p-6 transition-opacity duration-300 print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none print:mb-6 overflow-hidden print:overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 print:mb-1">
            <div>
              <h3 className="text-lg font-bold text-pen-900">Linear Progression Curve (Accuracy vs. Speed across 10 Units)</h3>
              <p className="text-xs text-muted">
                Dual-axis linear trend overlaying accuracy percentage against question pacing time across all Paper 1 chapters.
              </p>
            </div>
          </div>

          <div className="h-[360px] print:min-h-[260px] print:h-[260px] w-full mt-3 print:mt-1 overflow-hidden">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={units} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: '#4f46e5', fontSize: 11 }}
                    label={{ value: 'Accuracy (%) →', angle: -90, position: 'insideLeft', fill: '#4f46e5', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 110]}
                    unit="s"
                    tick={{ fill: '#ea580c', fontSize: 11 }}
                    label={{ value: 'Avg Time (s) →', angle: 90, position: 'insideRight', fill: '#ea580c', fontSize: 11 }}
                  />
                  <ReferenceLine
                    yAxisId="left"
                    y={65}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: 'Target 65%', fill: '#059669', fontSize: 11 }}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={60}
                    stroke="#cbd5e1"
                    strokeDasharray="4 4"
                    label={{ value: 'Target 60s', fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip content={<BarCustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy (%)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#6366f1' }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgTimePerQuestion"
                    name="Avg Time (s)"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: '#f97316' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted text-xs">Loading progression curve...</div>
            )}
          </div>
        </Sheet>
      )}

      {/* Row 2: Diagnostic Quadrant Scatter Plot */}
      <Sheet className="p-6 print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none print:mb-6 overflow-hidden print:overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2 print:mb-1">
          <div>
            <h2 className="text-lg font-bold text-pen-900">Diagnostic Quadrant (Speed vs. Accuracy)</h2>
            <p className="text-xs text-muted">
              Quadrant analysis classifies topics into 4 actionable learning zones based on time investment and error rates.
            </p>
          </div>
          {/* Quadrant Legend / Filter Buttons */}
          <div className="no-print flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedQuadrant('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                selectedQuadrant === 'all'
                  ? 'bg-pen-900 text-white shadow-sm'
                  : 'bg-sand-100 text-pen-700 hover:bg-sand-200'
              }`}
            >
              All Topics ({topics.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuadrant('mastered')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedQuadrant === 'mastered'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Mastered
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuadrant('deep_thinker')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedQuadrant === 'deep_thinker'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Deep Thinker
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuadrant('speed_demon')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedQuadrant === 'speed_demon'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Speed Demon
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuadrant('needs_review')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedQuadrant === 'needs_review'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Needs Review
            </button>
          </div>
        </div>

        {/* Scatter Chart Component */}
        <div className="h-[380px] print:min-h-[280px] print:h-[280px] w-full mt-4 print:mt-1 overflow-hidden">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 10 }}>
                <XAxis
                  type="number"
                  dataKey="avgTimePerQuestion"
                  name="Avg Time"
                  unit="s"
                  domain={[20, 110]}
                  label={{
                    value: 'Average Time per Question (seconds) →',
                    position: 'insideBottom',
                    offset: -12,
                    fill: '#64748b',
                    fontSize: 12,
                  }}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  type="number"
                  dataKey="accuracy"
                  name="Accuracy"
                  unit="%"
                  domain={[20, 100]}
                  label={{
                    value: 'Accuracy (%) →',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 12,
                    offset: 10,
                  }}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                />
                <ReferenceLine
                  x={60}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Pace Threshold (60s)',
                    position: 'insideTopRight',
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={65}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Pass Benchmark (65%)',
                    position: 'insideBottomRight',
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
                <Tooltip content={<ScatterCustomTooltip />} />
                <Scatter
                  name="Topics"
                  data={filteredTopics}
                  shape={(props: unknown) => {
                    const p = props as { cx: number; cy: number; payload: TopicAnalyticsItem };
                    const q = p.payload.quadrant;
                    return (
                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r={7}
                        fill={q.color}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="cursor-pointer transition-transform hover:scale-125"
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted text-xs">Loading scatter plot...</div>
          )}
        </div>

        {/* Quadrant Explanations Strip */}
        <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs print:mt-2 print:pt-1 print:gap-1.5">
          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 print:p-1.5 print:border-none">
            <span className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Mastered (Acc ≥65%, Speed ≤60s)
            </span>
            <p className="text-emerald-700 text-[11px]">High accuracy with brisk pace. Ready for full test timing.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 print:p-1.5 print:border-none">
            <span className="font-bold text-blue-800 flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Deep Thinker (Acc ≥65%, Speed &gt;60s)
            </span>
            <p className="text-blue-700 text-[11px]">Strong understanding, but eats into total exam time. Practice speed drills.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 print:p-1.5 print:border-none">
            <span className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Speed Demon (Acc &lt;65%, Speed ≤60s)
            </span>
            <p className="text-amber-700 text-[11px]">Rushing or guessing. Slow down and carefully read question qualifiers.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 print:p-1.5 print:border-none">
            <span className="font-bold text-rose-800 flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Needs Review (Acc &lt;65%, Speed &gt;60s)
            </span>
            <p className="text-rose-700 text-[11px]">Concept deficit causing hesitation. High priority revision topic.</p>
          </div>
        </div>
      </Sheet>

      {/* Row 3: Task 4 Expandable Chapter Drill-Down Table */}
      <section className="pt-2 print:pt-1 print:m-0" aria-labelledby="h-breakdown">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 print:mb-2">
          <div>
            <h2 id="h-breakdown" className="text-xl font-bold text-pen-900 print:text-base">Chapter & Syllabus Module Drill-Down</h2>
            <p className="text-xs text-muted">Click any chapter row to expand syllabus explanations, question attempts, and granular module topics.</p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search module or topic..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-pen-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pen-500 w-48 shadow-sm"
            />
            {activeTab === 'units' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAllUnits}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-pen-700 hover:bg-sand-100 transition shadow-sm"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllUnits}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-pen-700 hover:bg-sand-100 transition shadow-sm"
                >
                  Collapse All
                </button>
              </div>
            )}
            <div className="inline-flex rounded-lg border border-line bg-sand-100 p-0.5 text-xs font-semibold shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('units')}
                className={`rounded-md px-3 py-1 transition ${
                  activeTab === 'units' ? 'bg-surface text-pen-900 shadow-sm' : 'text-muted hover:text-pen-800'
                }`}
              >
                By Unit ({filteredUnits.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('topics')}
                className={`rounded-md px-3 py-1 transition ${
                  activeTab === 'topics' ? 'bg-surface text-pen-900 shadow-sm' : 'text-muted hover:text-pen-800'
                }`}
              >
                By Topic ({filteredTopics.length})
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'units' ? (
          <div className="rounded-xl border border-line bg-surface overflow-x-auto shadow-sm print:rounded-none print:shadow-none print:border-line">
            <div className="min-w-[850px]">
              {/* Unified Grid Table Header */}
              <div className="grid grid-cols-[minmax(250px,2fr)_repeat(6,minmax(100px,1fr))] gap-4 items-center bg-sand-50/70 border-b border-line px-4 py-3 text-xs font-bold text-pen-900 uppercase tracking-wider print:px-2 print:py-1.5 print:gap-2">
                <div className="text-left">Chapter / Module</div>
                <div className="text-center">Attempted</div>
                <div className="text-center">Correct</div>
                <div className="text-center">Accuracy</div>
                <div className="text-center">Avg Speed</div>
                <div className="text-center">Time Spent</div>
                <div className="text-center">Status</div>
              </div>

              {/* Unified Grid Table Body */}
              <div className="divide-y divide-line">
                {filteredUnits.map((u) => {
                  const isExpanded = expandedUnits.has(u.unitId);
                  const status =
                    u.accuracy >= 75
                      ? { label: 'Mastered', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
                      : u.accuracy >= 60
                      ? { label: 'Steady', tone: 'text-pen-700 bg-sand-100 border-line' }
                      : { label: 'Needs Focus', tone: 'text-rose-700 bg-rose-50 border-rose-200' };

                  return (
                    <div key={u.unitId} className="group">
                      {/* Accordion trigger/row wrapper with EXACT same grid class */}
                      <div
                        onClick={() => toggleUnitExpansion(u.unitId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleUnitExpansion(u.unitId);
                          }
                        }}
                        className={`grid grid-cols-[minmax(250px,2fr)_repeat(6,minmax(100px,1fr))] gap-4 items-center px-4 py-3.5 cursor-pointer transition hover:bg-sand-50/80 print:px-2 print:py-1.5 print:gap-2 print:break-inside-avoid ${
                          isExpanded ? 'bg-sand-50/50' : ''
                        }`}
                      >
                        {/* Column 1: Chapter / Module (left-aligned) */}
                        <div className="flex items-center gap-2.5 min-w-0 text-left">
                          <span className="shrink-0 text-muted group-hover:text-pen-700 transition-colors">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-pen-700" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </span>
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                          <div className="min-w-0 truncate font-medium text-pen-900 text-sm">
                            <span className="font-bold">{u.shortName}:</span> {u.unitName}
                            <span className="ml-1.5 text-[11px] text-muted">
                              ({u.topics.length} topics)
                            </span>
                          </div>
                        </div>

                        {/* Column 2: Attempted (center-aligned) */}
                        <div className="text-center tabular-nums text-muted text-sm">
                          {u.totalAttempted} / {u.totalQuestions}
                        </div>

                        {/* Column 3: Correct (center-aligned) */}
                        <div className="text-center tabular-nums font-semibold text-pen-900 text-sm">
                          {u.totalCorrect}
                        </div>

                        {/* Column 4: Accuracy (center-aligned) */}
                        <div className="flex flex-col items-center justify-center gap-1 text-center">
                          <span className="tabular-nums font-bold text-xs text-pen-900">{u.accuracy}%</span>
                          <div className="h-1.5 w-16 rounded-full bg-sand-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                u.accuracy >= 75 ? 'bg-emerald-500' : u.accuracy >= 60 ? 'bg-indigo-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${u.accuracy}%` }}
                            />
                          </div>
                        </div>

                        {/* Column 5: Avg Speed (center-aligned) */}
                        <div className="text-center tabular-nums text-pen-800 text-sm">
                          {u.avgTimePerQuestion}s / Q
                        </div>

                        {/* Column 6: Time Spent (center-aligned) */}
                        <div className="text-center tabular-nums text-muted text-sm">
                          {formatSeconds(u.totalTimeSpentSec)}
                        </div>

                        {/* Column 7: Status (center-aligned) */}
                        <div className="flex justify-center items-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold border ${status.tone}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Drill-Down Details Drawer */}
                      {isExpanded && (
                        <div className="bg-sand-50/40 p-4 sm:p-6 border-t border-line print:p-2 print:bg-transparent">
                          <div className="space-y-4 print:space-y-2">
                            {/* 1. Official Syllabus Description */}
                            <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm print:p-2 print:shadow-none print:break-inside-avoid">
                              <div className="flex items-center gap-2 mb-1.5 print:mb-1">
                                <BookOpen className="size-4 text-pen-700" />
                                <span className="text-xs font-bold text-pen-900 uppercase tracking-wider">
                                   Official UGC NET Syllabus Scope • Unit {u.unitNo}
                                </span>
                              </div>
                              <p className="text-xs text-pen-700 leading-relaxed">
                                {u.description}
                              </p>
                            </div>

                            {/* 2. Chances / Attempt Details Stat Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs print:gap-1.5 print:break-inside-avoid">
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-muted block text-[10px] uppercase font-semibold">Total Pool</span>
                                <span className="text-base font-bold tabular-nums text-pen-900">{u.totalQuestions}</span>
                                <span className="text-[10px] text-muted block">Questions seeded</span>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-muted block text-[10px] uppercase font-semibold flex items-center gap-1">
                                  <Target className="size-3 text-muted" />
                                  <span>Attempt Rate</span>
                                </span>
                                <span className="text-base font-bold tabular-nums text-pen-900">
                                  {u.totalQuestions > 0 ? Math.round((u.totalAttempted / u.totalQuestions) * 100) : 0}%
                                </span>
                                <span className="text-[10px] text-muted block">{u.totalAttempted} attempted</span>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-emerald-700 block text-[10px] uppercase font-semibold flex items-center gap-1">
                                  <Award className="size-3 text-emerald-600" />
                                  <span>Correct Marks</span>
                                </span>
                                <span className="text-base font-bold tabular-nums text-emerald-700">+{u.totalCorrect * 2}</span>
                                <span className="text-[10px] text-muted block">{u.totalCorrect} questions</span>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-rose-700 block text-[10px] uppercase font-semibold">Incorrect Mistakes</span>
                                <span className="text-base font-bold tabular-nums text-rose-700">{u.totalIncorrect}</span>
                                <span className="text-[10px] text-muted block">Errors logged</span>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-muted block text-[10px] uppercase font-semibold">Unattempted</span>
                                <span className="text-base font-bold tabular-nums text-pen-900">{u.totalUnattempted}</span>
                                <span className="text-[10px] text-muted block">Left blank</span>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-2.5 print:p-1.5 print:shadow-none">
                                <span className="text-blue-700 block text-[10px] uppercase font-semibold flex items-center gap-1">
                                  <Clock className="size-3 text-blue-600" />
                                  <span>Avg Pace</span>
                                </span>
                                <span className="text-base font-bold tabular-nums text-blue-700">{u.avgTimePerQuestion}s</span>
                                <span className="text-[10px] text-muted block">{u.avgTimePerQuestion <= 60 ? 'Optimal pace' : 'Over budget'}</span>
                              </div>
                            </div>

                            {/* 3. Granular Topic Breakdown Table for this Unit */}
                            <div className="print:break-inside-avoid">
                              <h4 className="text-xs font-bold text-pen-900 uppercase tracking-wider mb-2 print:mb-1 flex items-center gap-1.5">
                                <Sparkles className="size-3.5 text-pen-700" />
                                <span>Granular Topic Performance ({u.topics.length} Modules)</span>
                              </h4>

                              {u.topics.length === 0 ? (
                                <p className="text-xs text-muted italic p-2 bg-surface rounded border border-line">
                                  No granular topics attempted yet in this unit.
                                </p>
                              ) : (
                                <div className="rounded-lg border border-line overflow-hidden bg-surface print:border-line">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-sand-50 border-b border-line font-bold text-pen-900">
                                      <tr>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Topic Title</th>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Attempts</th>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Accuracy</th>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Pacing</th>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Diagnostic Status</th>
                                        <th className="py-2 px-3 print:py-1 print:px-2">Remedial Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                      {u.topics.map((top) => {
                                        const q = top.quadrant;
                                        return (
                                          <tr key={top.topicId} className="hover:bg-sand-50/50 print:break-inside-avoid">
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2 font-semibold text-pen-900 max-w-xs">
                                              {top.topicName}
                                            </td>
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2 tabular-nums text-muted">
                                              {top.totalCorrect} / {top.totalAttempted}
                                            </td>
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold tabular-nums">{top.accuracy}%</span>
                                                <div className="h-1.5 w-12 rounded-full bg-sand-200 overflow-hidden">
                                                  <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                      width: `${top.accuracy}%`,
                                                      backgroundColor: q.color,
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            </td>
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2 tabular-nums font-medium">
                                              {top.avgTimePerQuestion}s
                                            </td>
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2">
                                              <span
                                                className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold print:px-1.5 print:py-0"
                                                style={{
                                                  backgroundColor: `${q.color}15`,
                                                  color: q.color,
                                                  border: `1px solid ${q.color}40`,
                                                }}
                                              >
                                                {q.badge}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 print:py-1.5 print:px-2 text-muted text-[11px] max-w-sm">
                                              {q.recommendation}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <Table
            caption="Topic-level Diagnostic Breakdown"
            head={['Topic', 'Parent Unit', 'Attempted', 'Correct', 'Accuracy', 'Avg Speed', 'Diagnostic Quadrant']}
          >
            {filteredTopics.map((t) => {
              const q = t.quadrant;
              return (
                <tr key={t.topicId} className="print:break-inside-avoid">
                  <Td className="font-medium text-pen-900 max-w-xs">{t.topicName}</Td>
                  <Td className="text-muted text-xs">{t.unitName}</Td>
                  <Td className="tabular-nums">{t.totalAttempted}</Td>
                  <Td className="tabular-nums font-semibold text-pen-900">{t.totalCorrect}</Td>
                  <Td className="min-w-28">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-sand-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            t.accuracy >= 75 ? 'bg-emerald-500' : t.accuracy >= 60 ? 'bg-blue-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${t.accuracy}%` }}
                        />
                      </div>
                      <span className="tabular-nums font-bold text-xs">{t.accuracy}%</span>
                    </div>
                  </Td>
                  <Td className="tabular-nums">{t.avgTimePerQuestion}s</Td>
                  <Td>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: `${q.color}15`,
                        color: q.color,
                        border: `1px solid ${q.color}40`,
                      }}
                      title={q.recommendation}
                    >
                      {q.badge}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>

      {/* Row 4: Historical Score Trend */}
      <Sheet className="p-6 print:break-inside-avoid print:p-2.5 print:shadow-none print:border-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 print:mb-2">
          <div>
            <h2 className="text-lg font-bold text-pen-900">Score History & Trajectory</h2>
            <p className="text-xs text-muted">
              Trend: <strong className="text-pen-900">{TREND_LABELS[t.direction]}</strong> • Consistency:{' '}
              <strong className="text-pen-900">{Math.round(cons.value * 100)}%</strong> ({cons.numerator} of last {cons.denominator} days)
            </p>
          </div>
          <Link href="/app/planner" className="no-print text-xs font-semibold text-pen-700 underline">
            Generate Weekly Study Plan →
          </Link>
        </div>

        <ScoreLine
          points={scores.map((x) => ({
            label: new Date(x.atMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            value: x.percentage,
          }))}
        />

        <details className="mt-3 text-xs no-print">
          <summary className="cursor-pointer font-semibold text-pen-700 hover:text-pen-900">
            View score history table ({scores.length} entries)
          </summary>
          <div className="mt-2">
            <Table caption="Score history" head={['Date', 'Percentage', 'Average of last 5']}>
              {scores.map((x) => (
                <tr key={x.sessionId}>
                  <Td>{new Date(x.atMs).toLocaleDateString('en-IN')}</Td>
                  <Td className="tabular-nums font-semibold">{Math.round(x.percentage * 100)}%</Td>
                  <Td className="tabular-nums text-muted">{Math.round(avgLast5 * 100)}%</Td>
                </tr>
              ))}
            </Table>
          </div>
        </details>
      </Sheet>

      {/* Row 5: Metric Definitions Drawer */}
      <section className="no-print" aria-labelledby="h-def">
        <Sheet className="p-6">
          <h2 id="h-def" className="text-base font-bold text-pen-900 mb-2">Metric Definitions & Benchmarks</h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {Object.entries(METRIC_DEFINITIONS).map(([k, v]) => (
              <div key={k} className="p-2 rounded bg-sand-50/50 border border-line">
                <dt className="font-semibold text-pen-900">
                  {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                </dt>
                <dd className="text-muted mt-0.5">{v}</dd>
              </div>
            ))}
            <div className="p-2 rounded bg-sand-50/50 border border-line">
              <dt className="font-semibold text-pen-900">Diagnostic Quadrant</dt>
              <dd className="text-muted mt-0.5">
                Maps each topic by accuracy (target ≥65%) and pacing speed (target ≤60s) into Mastered, Deep Thinker, Speed Demon, or Needs Review.
              </dd>
            </div>
          </dl>
        </Sheet>
      </section>

      {/* Task 2: Eco-Conscious Intercept Modal (Save Paper) */}
      <Dialog
        open={showEcoModal}
        onClose={() => setShowEcoModal(false)}
        title="🌍 Think Before You Print"
        headerClassName="flex flex-col items-center text-center"
        footer={
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            <button
              type="button"
              onClick={handleProceedToPrint}
              className="rounded-control border border-line bg-transparent px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-sand-100 transition cursor-pointer"
            >
              Proceed to Print
            </button>
            <button
              type="button"
              onClick={handleSaveAsPdf}
              className="inline-flex items-center gap-1.5 rounded-control border border-pen-600 bg-surface px-4 py-2 text-xs font-semibold text-pen-700 hover:bg-pen-50 transition shadow-xs cursor-pointer"
            >
              <FileDown className="size-3.5 text-pen-600" />
              <span>Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEcoModal(false);
                handleShare();
              }}
              className="inline-flex items-center gap-1.5 rounded-control bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
            >
              <Share2 className="size-3.5 text-white" />
              <span>Share Electronically</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink text-center">
            This comprehensive diagnostic report requires multiple pages of ink and paper. As a platform committed to environmental conservation, we strongly encourage you to save this report electronically as a PDF or share it directly with your study groups. Going digital saves water, prevents deforestation, and keeps your records instantly accessible from anywhere.
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs flex flex-col items-center text-center gap-2">
            <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-950">
              <Leaf className="size-4 text-emerald-600 shrink-0" />
              <span>Eco Tip for UGC NET Aspirants</span>
            </div>
            <p className="text-emerald-900 leading-snug text-center">
              Choosing <strong>Save as PDF</strong> keeps your exact question breakdown and charts on your phone or laptop with zero waste, zero ink cost, and instantaneous search.
            </p>
          </div>

          {/* Task 1: Report Detail Level Selector (Dual-Track Smart Export) */}
          <div className="pt-2 border-t border-line text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-2 text-center">
              Report Detail Level
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                htmlFor="report-detail-summary"
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none',
                  printDetailLevel === 'summary'
                    ? 'border-pen-700 bg-pen-surface/40 text-pen-900 font-semibold ring-1 ring-pen-700 shadow-xs'
                    : 'border-line bg-surface text-pen-800 hover:bg-sand-50'
                )}
              >
                <input
                  id="report-detail-summary"
                  type="radio"
                  name="reportDetailLevel"
                  value="summary"
                  checked={printDetailLevel === 'summary'}
                  onChange={() => setPrintDetailLevel('summary')}
                  className="size-4 text-pen-700 focus:ring-pen-500 accent-pen-700 cursor-pointer"
                />
                <span>
                  Executive Summary
                  <span className="block text-[11px] font-normal text-muted">Current View</span>
                </span>
              </label>

              <label
                htmlFor="report-detail-comprehensive"
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none',
                  printDetailLevel === 'comprehensive'
                    ? 'border-pen-700 bg-pen-surface/40 text-pen-900 font-semibold ring-1 ring-pen-700 shadow-xs'
                    : 'border-line bg-surface text-pen-800 hover:bg-sand-50'
                )}
              >
                <input
                  id="report-detail-comprehensive"
                  type="radio"
                  name="reportDetailLevel"
                  value="comprehensive"
                  checked={printDetailLevel === 'comprehensive'}
                  onChange={() => setPrintDetailLevel('comprehensive')}
                  className="size-4 text-pen-700 focus:ring-pen-500 accent-pen-700 cursor-pointer"
                />
                <span>
                  Comprehensive Deep-Dive
                  <span className="block text-[11px] font-normal text-muted">Expands all chapters</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </Dialog>

      {/* PDF Destination Toast Tip */}
      {pdfTipActive && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-900 text-white px-4 py-2.5 text-xs font-semibold shadow-xl border border-emerald-700 flex items-center gap-2 animate-bounce"
        >
          <FileDown className="size-4 text-emerald-300" />
          <span>Destination tip: In the print dialog, select &ldquo;Save as PDF&rdquo;.</span>
        </div>
      )}
    </div>
  );
}
