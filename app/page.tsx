"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toPng } from "html-to-image";
import { parseXlsx, type ParsedWorkbook } from "./xlsx-lite";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Code2,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MailCheck,
  MailOpen,
  MailSearch,
  MousePointerClick,
  MoveUpRight,
  Percent,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  Trophy,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SUPABASE_URL = "https://fidfdgnnoqamhftczcer.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_kxXpLfa6qCedVjuZQP5Xug_xL9co33j";
const SUPABASE_PAGE_SIZE = 1000;
const EXCLUDED_DISPATCH_IDS = new Set<string>();
const DISPATCH_SEGMENT_OVERRIDES: Record<string, { operationalSegment: string; dashboardGroup: string; note: string }> = {
  "a44a35d2-e6d0-4adb-8e18-b90063b2f181": {
    operationalSegment: "ANIVERSARIO",
    dashboardGroup: "OUTROS",
    note: "BR Trade - Aniversário Maiorca (60 anos) classificado como Aniversário, não Pontual.",
  },
};

type RawRow = {
  month_ref: string;
  month_key: string;
  dashboard_group: string;
  operational_segment: string;
  communications: number;
  emails_sent: number | string;
  emails_delivered: number | string;
  unique_opens: number | string;
  total_clicks: number | string;
  unique_clicks: number | string;
  unsubscribes: number | string;
  bounces: number | string;
  cta_communications: number | string;
  cta_emails_sent: number | string;
  cta_unique_clicks: number | string;
  qualified_ctr: number | string;
};

type CampaignHighlight = {
  month_key: string;
  campaign_name: string;
  subject: string;
  dashboard_groups: string;
  operational_segments: string;
  audience_rows: number;
  emails_sent: number | string;
  emails_delivered: number | string;
  unique_opens: number | string;
  unique_clicks: number | string;
  unsubscribes: number | string;
  bounces: number | string;
  open_rate: number | string;
  ctr: number | string;
  ctor: number | string;
  bounce_rate: number | string;
  optout_rate: number | string;
  has_cta: boolean;
  cta_communications?: number | string;
  cta_emails_sent?: number | string;
  cta_unique_clicks?: number | string;
  qualified_ctr: number | string;
};

type CampaignDetail = CampaignHighlight & {
  dispatch_id: string;
  campaign_link: string | null;
  send_at: string | null;
  source_category: string | null;
  cta: string | null;
};

type CreativeRecord = {
  dispatch_id: string;
  month_key: string;
  campaign_name: string;
  subject: string | null;
  campaign_link: string | null;
  html_source: string;
  updated_at: string | null;
};

type Metrics = {
  communications: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  ctaCommunications: number;
  ctaSent: number;
  ctaClicks: number;
};

type RateKey =
  | "delivery"
  | "openRate"
  | "ctr"
  | "qualifiedCtr"
  | "ctor"
  | "optout"
  | "bounce";

type Rates = Record<RateKey, number>;
type Enriched = Metrics & Rates;
type Tab =
  | "overview"
  | "summary"
  | "highlights"
  | "campaigns"
  | "frequency"
  | "classifications"
  | "creative"
  | "comparison"
  | "semester"
  | "load"
  | "insights"
  | "guide";
type HighlightMetric = "open_rate" | "ctr" | "qualified_ctr" | "ctor" | "bounce_rate";
type CampaignSort =
  | "emails_sent"
  | "open_rate"
  | "ctr"
  | "qualified_ctr"
  | "ctor"
  | "bounce_rate"
  | "optout_rate";
type SessionRole = "client" | "team" | "admin";
type AuthState =
  | { status: "checking"; role: null }
  | { status: "anonymous"; role: null }
  | { status: "authenticated"; role: SessionRole };
type LoadStatus = "idle" | "parsing" | "validating" | "validated" | "committing" | "committed" | "error";
type LoadMetricSummary = {
  communications: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  totalClicks: number;
  unsubscribes: number;
  bounces: number;
  ctaSent: number;
  ctaClicks: number;
  delivery: number;
  openRate: number;
  ctr: number;
  qualifiedCtr: number;
  ctor: number;
  optout: number;
  bounce: number;
};
type LoadValidation = {
  ok: boolean;
  monthKey: string;
  monthRef: string;
  fileName: string;
  sheetName: string;
  sourceRows: number;
  normalizedRows: number;
  duplicateMonth: boolean;
  errors: string[];
  warnings: string[];
  alerts: string[];
  quality: Record<string, number>;
  totals: LoadMetricSummary;
  byGroup: Array<{ label: string; metrics: LoadMetricSummary }>;
  bySegment: Array<{ label: string; group: string; metrics: LoadMetricSummary }>;
  comparison: Array<{
    label: string;
    current: number;
    average: number;
    deltaPct: number | null;
    severity: "ok" | "warning" | "alert";
  }>;
};

const EMPTY: Metrics = {
  communications: 0,
  sent: 0,
  delivered: 0,
  opens: 0,
  clicks: 0,
  unsubscribes: 0,
  bounces: 0,
  ctaCommunications: 0,
  ctaSent: 0,
  ctaClicks: 0,
};

const GROUP_COLORS: Record<string, string> = {
  TRADE: "#4257E8",
  CORP: "#1B0088",
  OUTROS: "#FF2080",
};

const SEGMENT_COLORS: Record<string, string> = {
  "Consolidadores": "#4257E8",
  "Corporativas": "#1B0088",
  Otas: "#ED1650",
  Operators: "#9452FF",
  Lc: "#FF2080",
  Ge: "#0F004F",
  Portal: "#2D3BB3",
  Rir: "#6BF2FF",
  Club: "#D53BC0",
  "Aniversário": "#20BDD5",
  Pontual: "#6B35D8",
  Vendas: "#C31257",
};

const GROUP_LABELS: Record<string, string> = {
  TRADE: "Agências",
  CORP: "Empresas",
  OUTROS: "Outros",
};

const GROUP_ORDER = ["TRADE", "CORP", "OUTROS"] as const;

const SEGMENT_GROUPS: Record<string, (typeof GROUP_ORDER)[number]> = {
  CONS: "TRADE",
  CONSOLIDADORES: "TRADE",
  CORPRTV: "TRADE",
  CORPORATIVAS: "TRADE",
  OPERATORS: "TRADE",
  OTAS: "TRADE",
  GE: "CORP",
  LC: "CORP",
  RIR: "OUTROS",
  PORTAL: "OUTROS",
  ANIVERSARIO: "OUTROS",
  ANIVERSARIOS: "OUTROS",
  ANIVERSARIOAGENCIAS: "OUTROS",
  ANIVERSARIOSAGENCIAS: "OUTROS",
  ANIVERSARIODEAGENCIAS: "OUTROS",
  ANIVERSARIOSDEAGENCIAS: "OUTROS",
  CLUB: "OUTROS",
  PONTUAL: "OUTROS",
  VENDAS: "OUTROS",
};

const SEGMENT_ALIASES: Record<string, string> = {
  CONS: "Consolidadores",
  CONSOLIDADORES: "Consolidadores",
  CORPRTV: "Corporativas",
  CORPORATIVAS: "Corporativas",
  OPERATORS: "Operators",
  OTAS: "Otas",
  LC: "Lc",
  GE: "Ge",
  CLUB: "Club",
  ANIVERSARIO: "Aniversário",
  ANIVERSARIOS: "Aniversário",
  ANIVERSARIOAGENCIAS: "Aniversário",
  ANIVERSARIOSAGENCIAS: "Aniversário",
  ANIVERSARIODEAGENCIAS: "Aniversário",
  ANIVERSARIOSDEAGENCIAS: "Aniversário",
  PONTUAL: "Pontual",
  PORTAL: "Portal",
  RIR: "Rir",
  VENDAS: "Vendas",
};

const NON_CHANNEL_SEGMENTS = new Set(["MALHASETEMBROCORP"]);

const HIGHLIGHT_METRICS: Record<
  HighlightMetric,
  { label: string; description: string; inverse?: boolean }
> = {
  open_rate: {
    label: "Taxa de abertura",
    description: "Aberturas únicas ÷ emails recebidos",
  },
  ctr: {
    label: "CTR",
    description: "Cliques únicos ÷ emails enviados",
  },
  qualified_ctr: {
    label: "CTR qualificado",
    description: "Cliques únicos ÷ enviados apenas nos disparos com CTA",
  },
  ctor: {
    label: "CTOR",
    description: "Cliques únicos ÷ aberturas únicas",
  },
  bounce_rate: {
    label: "Bounce",
    description: "Bounces ÷ emails enviados",
    inverse: true,
  },
};

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_BUCKETS = [
  { day: 1, label: "Segunda-feira", short: "Seg" },
  { day: 2, label: "Terça-feira", short: "Ter" },
  { day: 3, label: "Quarta-feira", short: "Qua" },
  { day: 4, label: "Quinta-feira", short: "Qui" },
  { day: 5, label: "Sexta-feira", short: "Sex" },
  { day: 6, label: "Sábado", short: "Sáb" },
  { day: 0, label: "Domingo", short: "Dom" },
] as const;

const TIME_BUCKETS = [
  { label: "00h–05h", start: 0, end: 5 },
  { label: "06h–08h", start: 6, end: 8 },
  { label: "09h–11h", start: 9, end: 11 },
  { label: "12h–14h", start: 12, end: 14 },
  { label: "15h–17h", start: 15, end: 17 },
  { label: "18h–20h", start: 18, end: 20 },
  { label: "21h–23h", start: 21, end: 23 },
] as const;

function num(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

async function fetchAllSupabaseRows<T>(endpoint: string, label: string): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Range: `${from}-${from + SUPABASE_PAGE_SIZE - 1}`,
        "Range-Unit": "items",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${label} indisponível (${response.status})`);
    }

    const page = (await response.json()) as T[];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) return rows;
    if (rows.length >= 100000) {
      throw new Error(`${label} excedeu o limite de segurança da paginação`);
    }
  }
}

function add(target: Metrics, source: Partial<Metrics>): Metrics {
  return {
    communications: target.communications + (source.communications || 0),
    sent: target.sent + (source.sent || 0),
    delivered: target.delivered + (source.delivered || 0),
    opens: target.opens + (source.opens || 0),
    clicks: target.clicks + (source.clicks || 0),
    unsubscribes: target.unsubscribes + (source.unsubscribes || 0),
    bounces: target.bounces + (source.bounces || 0),
    ctaCommunications: target.ctaCommunications + (source.ctaCommunications || 0),
    ctaSent: target.ctaSent + (source.ctaSent || 0),
    ctaClicks: target.ctaClicks + (source.ctaClicks || 0),
  };
}

function enrich(metrics: Metrics): Enriched {
  return {
    ...metrics,
    delivery: rate(metrics.delivered, metrics.sent),
    openRate: rate(metrics.opens, metrics.delivered),
    ctr: rate(metrics.clicks, metrics.sent),
    qualifiedCtr: rate(metrics.ctaClicks, metrics.ctaSent),
    ctor: rate(metrics.clicks, metrics.opens),
    optout: rate(metrics.unsubscribes, metrics.sent),
    bounce: rate(metrics.bounces, metrics.sent),
  };
}

function toMetrics(row: RawRow): Metrics {
  return {
    communications: num(row.communications),
    sent: num(row.emails_sent),
    delivered: num(row.emails_delivered),
    opens: num(row.unique_opens),
    clicks: num(row.unique_clicks),
    unsubscribes: num(row.unsubscribes),
    bounces: num(row.bounces),
    ctaCommunications: num(row.cta_communications),
    ctaSent: num(row.cta_emails_sent),
    ctaClicks: num(row.cta_unique_clicks),
  };
}

function metricsFromCampaign(item: CampaignHighlight): Metrics {
  const hasAggregatedCtaVolumes = item.cta_emails_sent !== undefined;
  return {
    communications: 1,
    sent: num(item.emails_sent),
    delivered: num(item.emails_delivered),
    opens: num(item.unique_opens),
    clicks: num(item.unique_clicks),
    unsubscribes: num(item.unsubscribes),
    bounces: num(item.bounces),
    ctaCommunications: hasAggregatedCtaVolumes
      ? num(item.cta_communications)
      : item.has_cta ? 1 : 0,
    ctaSent: hasAggregatedCtaVolumes
      ? num(item.cta_emails_sent)
      : item.has_cta ? num(item.emails_sent) : 0,
    ctaClicks: hasAggregatedCtaVolumes
      ? num(item.cta_unique_clicks)
      : item.has_cta ? num(item.unique_clicks) : 0,
  };
}

function subtractMetrics(target: Metrics, source: Metrics): Metrics {
  return {
    communications: Math.max(0, target.communications - source.communications),
    sent: Math.max(0, target.sent - source.sent),
    delivered: Math.max(0, target.delivered - source.delivered),
    opens: Math.max(0, target.opens - source.opens),
    clicks: Math.max(0, target.clicks - source.clicks),
    unsubscribes: Math.max(0, target.unsubscribes - source.unsubscribes),
    bounces: Math.max(0, target.bounces - source.bounces),
    ctaCommunications: Math.max(0, target.ctaCommunications - source.ctaCommunications),
    ctaSent: Math.max(0, target.ctaSent - source.ctaSent),
    ctaClicks: Math.max(0, target.ctaClicks - source.ctaClicks),
  };
}

function applyMetrics(row: RawRow, metrics: Metrics): RawRow {
  return {
    ...row,
    communications: metrics.communications,
    emails_sent: metrics.sent,
    emails_delivered: metrics.delivered,
    unique_opens: metrics.opens,
    total_clicks: metrics.clicks,
    unique_clicks: metrics.clicks,
    unsubscribes: metrics.unsubscribes,
    bounces: metrics.bounces,
    cta_communications: metrics.ctaCommunications,
    cta_emails_sent: metrics.ctaSent,
    cta_unique_clicks: metrics.ctaClicks,
    qualified_ctr: rate(metrics.ctaClicks, metrics.ctaSent),
  };
}

function recalculateCampaign(item: CampaignHighlight, metrics: Metrics): CampaignHighlight | null {
  if (metrics.sent <= 0 && metrics.delivered <= 0 && metrics.opens <= 0) return null;
  return {
    ...item,
    audience_rows: Math.max(0, num(item.audience_rows) - 1),
    emails_sent: metrics.sent,
    emails_delivered: metrics.delivered,
    unique_opens: metrics.opens,
    unique_clicks: metrics.clicks,
    unsubscribes: metrics.unsubscribes,
    bounces: metrics.bounces,
    cta_communications: metrics.ctaCommunications,
    cta_emails_sent: metrics.ctaSent,
    cta_unique_clicks: metrics.ctaClicks,
    has_cta: metrics.ctaSent > 0,
    open_rate: rate(metrics.opens, metrics.delivered),
    ctr: rate(metrics.clicks, metrics.sent),
    qualified_ctr: rate(metrics.ctaClicks, metrics.ctaSent),
    ctor: rate(metrics.clicks, metrics.opens),
    bounce_rate: rate(metrics.bounces, metrics.sent),
    optout_rate: rate(metrics.unsubscribes, metrics.sent),
  };
}

function formatInt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");
  downloadText(filename, `\uFEFF${content}`, "text/csv;charset=utf-8");
}

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Resposta vazia do servidor (${response.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida do servidor (${response.status}): ${text.slice(0, 240)}`);
  }
}

async function exportElementPng(elementId: string, filename: string) {
  const node = document.getElementById(elementId);
  if (!node) {
    window.alert("Não encontrei o elemento para exportar.");
    return;
  }
  try {
    if (document.fonts?.ready) await document.fonts.ready;

    node.classList.add("export-capture-active");
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });

    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      throw new Error("O elemento está sem tamanho visível.");
    }

    const dataUrl = await toPng(node, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
      preferredFontFormat: "woff2",
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      filter: (element) => {
        if (!(element instanceof HTMLElement)) return true;
        return !element.matches(".export-actions, button, select, input");
      },
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha desconhecida.";
    window.alert(`Não foi possível gerar o PNG. ${detail}`);
  } finally {
    node.classList.remove("export-capture-active");
  }
}

function formatMonth(key: string, short = false) {
  const [year, month] = key.split("-").map(Number);
  return short
    ? `${MONTHS_PT[month - 1].slice(0, 3)}/${String(year).slice(2)}`
    : `${MONTHS_PT[month - 1]}/${year}`;
}

function formatSendDate(value: string | null) {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function parsedSendDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlMatches(html: string, pattern: RegExp) {
  return html.match(pattern)?.length || 0;
}

function extractCtaTexts(html: string) {
  const anchors = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => stripHtml(match[1] || ""))
    .filter(Boolean);
  const likely = anchors.filter((text) =>
    /(clique|confira|acesse|saiba|conheça|reserve|comprar|ver mais|veja|particip|cadastre|atualize|aproveite)/i.test(text),
  );
  return (likely.length ? likely : anchors).slice(0, 5);
}

function analyzeCreativeHtml(html: string, campaign?: CampaignDetail | null) {
  const text = stripHtml(html);
  const wordCount = text ? text.split(/\s+/).length : 0;
  const links = htmlMatches(html, /<a\b/gi);
  const images = htmlMatches(html, /<img\b/gi);
  const buttons = htmlMatches(html, /<button\b|role=["']button["']/gi);
  const imageAltCount = [...html.matchAll(/<img\b[^>]*\balt=["'][^"']+["']/gi)].length;
  const hasUnsubscribe = /(descadastro|unsubscribe|opt[-\s]?out|cancelar inscrição|remover)/i.test(text);
  const hasAlt = /<img\b[^>]*\balt=["'][^"']+["']/i.test(html);
  const ctas = extractCtaTexts(html);
  const hasExternalLink = /href=["']https?:\/\//i.test(html);
  const hasViewOnline = /(visualizar|página da web|acesse aqui|view online|browser)/i.test(text);
  const genericCtas = ctas.filter((item) => /^(clique aqui|acesse aqui|saiba mais|ver mais)$/i.test(item.trim()));
  const imageHeavy = images >= 8 && wordCount > 0 && wordCount < 260;
  const ctaFocus =
    ctas.length === 0 ? "sem CTA textual claro" :
    ctas.length === 1 ? "CTA concentrado" :
    ctas.length <= 3 ? "poucos CTAs" :
    "muitos caminhos de clique";
  const openRate = campaign ? num(campaign.open_rate) : 0;
  const ctr = campaign ? num(campaign.ctr) : 0;
  const qualifiedCtr = campaign ? num(campaign.qualified_ctr) : 0;
  const ctor = campaign ? num(campaign.ctor) : 0;
  const bounce = campaign ? num(campaign.bounce_rate) : 0;
  const optout = campaign ? num(campaign.optout_rate) : 0;
  const sent = campaign ? num(campaign.emails_sent) : 0;
  const clicks = campaign ? num(campaign.unique_clicks) : 0;

  const executiveSummary = campaign
    ? {
        title: "Parecer rápido",
        text:
          bounce > 0.02 || optout > 0.005
            ? `A peça pode estar correta visualmente, mas os sinais de rejeição exigem atenção: Bounce ${formatPercent(bounce)} e Opt-out ${formatPercent(optout)} indicam que o próximo passo é revisar público, frequência e aderência da mensagem antes de mexer só no layout.`
            : `A peça não mostra alerta crítico de rejeição. O próximo ganho deve vir de clareza de promessa, CTA mais específico e teste controlado de assunto/preheader.`
      }
    : {
        title: "Aguardando KPI oficial",
        text: "Selecione um disparo para transformar a leitura do HTML em orientação prática de melhoria."
      };

  const directActions = [
    {
      label: "O que está bom",
      title: ctas.length === 1 ? "A peça tem um caminho principal de clique" : "A peça tem base técnica para análise",
      text: ctas.length === 1
        ? `Foi identificado um CTA principal (${ctas[0]}), o que reduz dispersão e facilita medir intenção real pelo CTR/CTOR.`
        : `${formatInt(links)} links, ${formatInt(images)} imagens e ${formatInt(wordCount)} palavras foram detectados; já dá para avaliar hierarquia, CTA e leitura mobile.`
    },
    {
      label: "O que preocupa",
      title: bounce > 0.02 || optout > 0.005 ? "Rejeição acima do confortável" : imageHeavy ? "Dependência alta de imagem" : "Risco concentrado na clareza da oferta",
      text: bounce > 0.02 || optout > 0.005
        ? `Bounce ${formatPercent(bounce)} e Opt-out ${formatPercent(optout)} pedem revisão de lista, segmentação e pressão de envio.`
        : imageHeavy
          ? `São ${formatInt(images)} imagens para ${formatInt(wordCount)} palavras. Se imagens bloquearem, parte da mensagem pode perder força.`
          : `Para melhorar CTR (${formatPercent(ctr)}), a primeira dobra precisa explicar rapidamente por que clicar agora.`
    },
    {
      label: "O que fazer agora",
      title: "Próximo ajuste recomendado",
      text: ctas.length
        ? `Testar um CTA mais específico que antecipe o benefício do clique, mantendo o mesmo público para comparar CTR e CTOR com segurança.`
        : "Adicionar CTA textual claro acima da dobra e repetir no fechamento da peça."
    },
  ];

  const insights = [
    {
      title: "Primeira dobra e promessa",
      tone: wordCount > 450 || imageHeavy ? "warning" : "good",
      text:
        wordCount > 450
          ? `Com ${formatInt(wordCount)} palavras, a peça pode exigir esforço no mobile. Garanta título, benefício principal e CTA visíveis antes da primeira rolagem.`
          : imageHeavy
            ? `A peça é mais visual: ${formatInt(images)} imagens para ${formatInt(wordCount)} palavras. Isso pode funcionar bem, mas precisa de texto vivo suficiente caso imagens sejam bloqueadas.`
            : `Boa objetividade: ${formatInt(wordCount)} palavras. A validação agora é conferir se a promessa principal aparece antes da dobra e conversa com o assunto do disparo.`
    },
    {
      title: "CTA e intenção de clique",
      tone: !ctas.length || genericCtas.length ? "warning" : "good",
      text: ctas.length
        ? `${sentenceCase(ctaFocus)}: ${ctas.join(" · ")}. Para evoluir CTR (${formatPercent(ctr)}) e CTOR (${formatPercent(ctor)}), prefira CTA específico sobre o valor entregue, não só ação genérica.`
        : `Não identifiquei CTA textual claro. Se o clique depende de imagem, o risco é perder performance em clientes que bloqueiam imagem ou em leitura mobile.`
    },
    {
      title: "Acessibilidade e renderização",
      tone: hasAlt && hasUnsubscribe ? "good" : "warning",
      text: `${hasAlt ? `${formatInt(imageAltCount)} imagem(ns) com alt detectado` : "Não encontrei alt text claro em imagens"}. ${hasUnsubscribe ? "Opt-out aparece no conteúdo" : "Opt-out não foi detectado no HTML"}. ${hasViewOnline ? "Link de visualização online identificado." : "Considere manter link de visualização online quando a peça for muito visual."}`
    },
    {
      title: "Sinal de mercado pelo KPI",
      tone: bounce > 0.02 || optout > 0.005 ? "alert" : "good",
      text: campaign
        ? `Resultado oficial: ${formatInt(sent)} enviados, ${formatInt(clicks)} cliques únicos, OR ${formatPercent(openRate)}, CTR ${formatPercent(ctr)}, CTR qual. ${formatPercent(qualifiedCtr)}, CTOR ${formatPercent(ctor)}, Bounce ${formatPercent(bounce)} e Opt-out ${formatPercent(optout)}. Use clique e rejeição como sinais mais fortes de ação real.`
        : "Selecione um disparo para cruzar a análise da peça com os KPIs oficiais."
    },
  ];

  const recommendations = [
    {
      title: "CTA: deixar a ação mais óbvia",
      priority: ctas.length ? "Ação recomendada" : "Prioridade alta",
      tone: ctas.length ? "good" : "alert",
      text: ctas.length
        ? `Hoje o CTA encontrado foi “${ctas[0]}”. Recomendo testar uma versão mais orientada a benefício, deixando claro o que a pessoa ganha depois do clique.`
        : "Inserir um CTA textual visível. Sem CTA claro, o usuário pode entender a mensagem, mas não saber qual ação tomar."
    },
    {
      title: "Primeira dobra: vender a ideia antes da rolagem",
      priority: imageHeavy ? "Prioridade alta" : "Boas práticas",
      tone: imageHeavy ? "warning" : "good",
      text: imageHeavy
        ? "Como a peça é muito visual, valide se título, benefício e CTA continuam claros no mobile e com imagens bloqueadas."
        : "Manter no topo: benefício principal, motivo para clicar e CTA. Essa é a área que mais influencia entendimento rápido."
    },
    {
      title: "Rejeição: separar problema de peça vs. base",
      priority: bounce > 0.02 || optout > 0.005 ? "Prioridade alta" : "Monitorar",
      tone: bounce > 0.02 || optout > 0.005 ? "alert" : "good",
      text:
        bounce > 0.02 || optout > 0.005
          ? "Antes de culpar a criação, valide lista, público, frequência e aderência do assunto. Bounce/opt-out altos geralmente indicam problema de base ou relevância."
          : "Manter higiene de base e controle de frequência para preservar entrega e evitar desgaste do público."
    },
    {
      title: "Teste profissional para o próximo envio",
      priority: "Próximo teste",
      tone: "good",
      text: "Rodar A/B com uma variável por vez: assunto/preheader ou CTA. Medir por CTR, CTR qualificado, CTOR, opt-out e bounce — não só abertura."
    },
  ];

  const tests = [
    "Teste 1: assunto + preheader com promessa mais direta.",
    "Teste 2: CTA atual versus CTA com benefício explícito.",
    "Teste 3: versão com CTA acima da primeira dobra no mobile.",
    "Teste 4: repetir a análise por canal para separar problema criativo de problema de público."
  ];

  return {
    text,
    wordCount,
    links,
    images,
    buttons,
    ctas,
    hasUnsubscribe,
    hasAlt,
    hasExternalLink,
    executiveSummary,
    directActions,
    insights,
    recommendations,
    tests
  };
}

function monthName(key: string) {
  const month = Number(key.split("-")[1]);
  return MONTHS_PT[month - 1]?.toLocaleLowerCase("pt-BR") || key;
}

function sentenceCase(value: string) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const lower = clean.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function canonicalToken(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

function groupKey(group: string) {
  const normalized = canonicalToken(group);
  if (normalized === "TRADE") return "TRADE";
  if (normalized === "CORP" || normalized === "CORPORATIVO" || normalized === "CORPORATIVA") return "CORP";
  if (normalized === "OUTRO" || normalized === "OUTROS") return "OUTROS";
  return normalized;
}

function groupLabel(group: string) {
  const key = groupKey(group);
  return GROUP_LABELS[key] || sentenceCase(group);
}

function resolvedGroupKey(segment: string, fallbackGroup = "") {
  const segmentToken = canonicalToken(segment);
  if (segmentToken === "MALHASETEMBROCORP") return "CORP";
  if (SEGMENT_GROUPS[segmentToken]) return SEGMENT_GROUPS[segmentToken];
  if (segmentToken && segmentToken !== "LATAMERS") return "OUTROS";
  return groupKey(fallbackGroup);
}

function segmentLabel(segment: string) {
  const normalized = canonicalToken(segment);
  if (NON_CHANNEL_SEGMENTS.has(normalized)) return "Canal não classificado";
  return SEGMENT_ALIASES[normalized] || sentenceCase(segment);
}

function isChannelSegment(segment: string) {
  return !NON_CHANNEL_SEGMENTS.has(canonicalToken(segment));
}

function loadSegmentLabel(segment: string) {
  const normalized = canonicalToken(segment);
  if (normalized === "ANIVERSARIOAGENCIAS") return "Aniversário Agências";
  return segmentLabel(segment);
}

function uniqueFormattedList(value: string, formatter: (item: string) => string) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/\s*[,;|]\s*/)
        .filter(Boolean)
        .map(formatter)
        .filter(Boolean),
    ),
  );
}

function segmentListLabel(value: string) {
  return uniqueFormattedList(value, segmentLabel).join(", ");
}

function groupListLabel(value: string) {
  return uniqueFormattedList(value, groupLabel).join(", ");
}

function groupListKeys(value: string) {
  return uniqueFormattedList(value, groupKey);
}

function campaignGroupKeys(item: CampaignHighlight) {
  const segments = String(item.operational_segments || "")
    .split(/\s*[,;|]\s*/)
    .filter(Boolean);
  const keys = segments
    .map((segment) => resolvedGroupKey(segment))
    .filter(Boolean);
  const fallback = groupListKeys(item.dashboard_groups);
  return Array.from(new Set(keys.length ? keys : fallback)).sort(
    (a, b) => groupOrder(a) - groupOrder(b),
  );
}

function campaignGroupListLabel(item: CampaignHighlight) {
  return campaignGroupKeys(item).map((group) => GROUP_LABELS[group] || group).join(", ");
}

function sameCampaignSlice(item: CampaignHighlight, detail: CampaignDetail) {
  return (
    item.month_key === detail.month_key &&
    item.campaign_name === detail.campaign_name &&
    item.subject === detail.subject &&
    campaignGroupKeys(item).join("|") === campaignGroupKeys(detail).join("|") &&
    segmentListLabel(item.operational_segments) === segmentListLabel(detail.operational_segments)
  );
}

function applyDispatchOverride(detail: CampaignDetail): CampaignDetail {
  const override = DISPATCH_SEGMENT_OVERRIDES[detail.dispatch_id];
  if (!override) return detail;
  return {
    ...detail,
    dashboard_groups: override.dashboardGroup,
    operational_segments: override.operationalSegment,
  };
}

function applyDashboardExclusions(
  monthlyRows: RawRow[],
  highlightRows: CampaignHighlight[],
  detailRows: CampaignDetail[],
) {
  const segmentOverrides = detailRows
    .map((original) => ({ original, corrected: applyDispatchOverride(original) }))
    .filter(({ original, corrected }) =>
      original.dashboard_groups !== corrected.dashboard_groups ||
      original.operational_segments !== corrected.operational_segments,
    );
  const correctedDetailRows = detailRows.map(applyDispatchOverride);
  const excludedDetails = correctedDetailRows.filter((item) => EXCLUDED_DISPATCH_IDS.has(item.dispatch_id));

  const adjustedMonthlyRows = monthlyRows
    .map((row) => {
      const correctionsOut = segmentOverrides.filter(
        ({ original }) =>
          original.month_key === row.month_key &&
          segmentListLabel(original.operational_segments) === segmentLabel(row.operational_segment) &&
          campaignGroupKeys(original).includes(resolvedGroupKey(row.operational_segment, row.dashboard_group)),
      );
      const correctionsIn = segmentOverrides.filter(
        ({ corrected }) =>
          corrected.month_key === row.month_key &&
          segmentListLabel(corrected.operational_segments) === segmentLabel(row.operational_segment) &&
          campaignGroupKeys(corrected).includes(resolvedGroupKey(row.operational_segment, row.dashboard_group)),
      );
      const exclusions = excludedDetails.filter(
        (detail) =>
          detail.month_key === row.month_key &&
          segmentListLabel(detail.operational_segments) === segmentLabel(row.operational_segment) &&
          campaignGroupKeys(detail).includes(resolvedGroupKey(row.operational_segment, row.dashboard_group)),
      );
      if (!correctionsOut.length && !correctionsIn.length && !exclusions.length) return row;
      const withoutCorrectionsAndExclusions = [...correctionsOut.map(({ original }) => original), ...exclusions].reduce(
        (total, detail) => subtractMetrics(total, metricsFromCampaign(detail)),
        toMetrics(row),
      );
      const adjusted = correctionsIn.reduce(
        (total, { corrected }) => add(total, metricsFromCampaign(corrected)),
        withoutCorrectionsAndExclusions,
      );
      return applyMetrics(row, adjusted);
    })
    .filter((row) => {
      const metrics = toMetrics(row);
      return metrics.communications > 0 || metrics.sent > 0;
    });

  const adjustedHighlightRows = highlightRows
    .map((item) => {
      const correctionsOut = segmentOverrides.filter(({ original }) => sameCampaignSlice(item, original));
      const correctionsIn = segmentOverrides.filter(({ corrected }) => sameCampaignSlice(item, corrected));
      const exclusions = excludedDetails.filter((detail) => sameCampaignSlice(item, detail));
      if (!correctionsOut.length && !correctionsIn.length && !exclusions.length) return item;
      const withoutCorrectionsAndExclusions = [...correctionsOut.map(({ original }) => original), ...exclusions].reduce(
        (total, detail) => subtractMetrics(total, metricsFromCampaign(detail)),
        metricsFromCampaign(item),
      );
      const adjusted = correctionsIn.reduce(
        (total, { corrected }) => add(total, metricsFromCampaign(corrected)),
        withoutCorrectionsAndExclusions,
      );
      const firstIncoming = correctionsIn[0]?.corrected;
      if (firstIncoming) {
        item = {
          ...item,
          dashboard_groups: firstIncoming.dashboard_groups,
          operational_segments: firstIncoming.operational_segments,
        };
      }
      return recalculateCampaign(item, adjusted);
    })
    .filter((item): item is CampaignHighlight => Boolean(item));
  const movedHighlightRows = segmentOverrides.flatMap(({ original, corrected }) => {
    const alreadyHasCorrectedHighlight = highlightRows.some((item) => sameCampaignSlice(item, corrected));
    if (alreadyHasCorrectedHighlight) return [];
    const originalHighlight = highlightRows.find((item) => sameCampaignSlice(item, original));
    if (!originalHighlight) return [];
    const moved = recalculateCampaign(
      {
        ...originalHighlight,
        dashboard_groups: corrected.dashboard_groups,
        operational_segments: corrected.operational_segments,
      },
      metricsFromCampaign(corrected),
    );
    return moved ? [moved] : [];
  });

  return {
    monthlyRows: adjustedMonthlyRows,
    highlightRows: [...adjustedHighlightRows, ...movedHighlightRows],
    detailRows: correctedDetailRows.filter((item) => !EXCLUDED_DISPATCH_IDS.has(item.dispatch_id)),
  };
}

function groupOrder(group: string) {
  const index = GROUP_ORDER.indexOf(groupKey(group) as (typeof GROUP_ORDER)[number]);
  return index === -1 ? GROUP_ORDER.length : index;
}

function segmentColor(label: string) {
  return SEGMENT_COLORS[label] || "#64748B";
}

function diff(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function pp(current: number, previous: number) {
  return (current - previous) * 100;
}

function variationLabel(
  current: number,
  previous: number,
  _type: "percent" | "pp" = "percent",
) {
  const value = diff(current, previous);
  if (value === null) return "sem base anterior";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, 1)}`;
}

function trendClass(current: number, previous: number, inverse = false) {
  if (current === previous) return "neutral";
  const positive = inverse ? current < previous : current > previous;
  return positive ? "positive" : "negative";
}

function groupRows(rows: RawRow[], month: string) {
  const grouped = new Map<string, Metrics>();
  rows
    .filter((row) => row.month_key === month)
    .forEach((row) => {
      const key = resolvedGroupKey(row.operational_segment, row.dashboard_group);
      grouped.set(key, add(grouped.get(key) || EMPTY, toMetrics(row)));
    });
  return [...grouped.entries()]
    .map(([label, metrics]) => ({ label, ...enrich(metrics) }))
    .sort((a, b) => b.sent - a.sent);
}

function segmentRows(rows: RawRow[], month: string) {
  const grouped = new Map<string, { metrics: Metrics; group: string }>();
  rows
    .filter((row) => row.month_key === month)
    .forEach((row) => {
      const label = segmentLabel(row.operational_segment);
      const current = grouped.get(label);
      grouped.set(label, {
        metrics: add(current?.metrics || EMPTY, toMetrics(row)),
        group: current?.group || resolvedGroupKey(row.operational_segment, row.dashboard_group),
      });
    });
  return [...grouped.entries()]
    .map(([label, value]) => ({
      label,
      group: value.group,
      ...enrich(value.metrics),
    }))
    .sort((a, b) => b.sent - a.sent);
}

function totalForMonth(rows: RawRow[], month: string) {
  return enrich(
    rows
      .filter((row) => row.month_key === month)
      .reduce((total, row) => add(total, toMetrics(row)), EMPTY),
  );
}

function totalForRows(rows: RawRow[]) {
  return enrich(rows.reduce((total, row) => add(total, toMetrics(row)), EMPTY));
}

function totalForComparableMonth(rows: RawRow[], month: string) {
  return enrich(
    rows
      .filter(
        (row) =>
          row.month_key === month &&
          String(row.operational_segment || "").trim().toUpperCase() !== "LATAMERS",
      )
      .reduce((total, row) => add(total, toMetrics(row)), EMPTY),
  );
}

function buildLoadComparisonFromDashboardRows(
  dashboardRows: RawRow[],
  monthKey: string,
  total: LoadMetricSummary,
): LoadValidation["comparison"] | null {
  const historyMonths = Array.from(
    new Set(
      dashboardRows
        .map((row) => row.month_key)
        .filter((month) => month && month < monthKey),
    ),
  )
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 6);

  if (historyMonths.length === 0) return null;

  const history = historyMonths.map((month) => totalForComparableMonth(dashboardRows, month));
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return [
    { label: "Emails enviados", current: total.sent, average: average(history.map((item) => item.sent)) },
    { label: "Emails recebidos", current: total.delivered, average: average(history.map((item) => item.delivered)) },
    { label: "Open Rate", current: total.openRate, average: average(history.map((item) => item.openRate)) },
    { label: "CTR", current: total.ctr, average: average(history.map((item) => item.ctr)) },
    { label: "CTR qualificado", current: total.qualifiedCtr, average: average(history.map((item) => item.qualifiedCtr)) },
    { label: "CTOR", current: total.ctor, average: average(history.map((item) => item.ctor)) },
    { label: "Bounce", current: total.bounce, average: average(history.map((item) => item.bounce)) },
    { label: "Opt-out", current: total.optout, average: average(history.map((item) => item.optout)) },
  ].map((item) => {
    const deltaPct = item.average ? (item.current - item.average) / item.average : null;
    const severity = deltaPct === null || Math.abs(deltaPct) < 0.25 ? "ok" : Math.abs(deltaPct) < 0.5 ? "warning" : "alert";
    return { ...item, deltaPct, severity };
  });
}

function campaignMetrics(items: CampaignHighlight[]) {
  return enrich(
    items.reduce(
      (total, item) => {
        const hasAggregatedCtaVolumes = item.cta_emails_sent !== undefined;
        return add(total, {
          communications: 1,
          sent: num(item.emails_sent),
          delivered: num(item.emails_delivered),
          opens: num(item.unique_opens),
          clicks: num(item.unique_clicks),
          unsubscribes: num(item.unsubscribes),
          bounces: num(item.bounces),
          ctaCommunications: hasAggregatedCtaVolumes
            ? num(item.cta_communications)
            : item.has_cta ? 1 : 0,
          ctaSent: hasAggregatedCtaVolumes
            ? num(item.cta_emails_sent)
            : item.has_cta ? num(item.emails_sent) : 0,
          ctaClicks: hasAggregatedCtaVolumes
            ? num(item.cta_unique_clicks)
            : item.has_cta ? num(item.unique_clicks) : 0,
        });
      },
      EMPTY,
    ),
  );
}

function campaignHasClassification(item: CampaignHighlight, classification: string) {
  return uniqueFormattedList(item.operational_segments, segmentLabel).includes(classification);
}

type SubcategoryOption = { label: string; group: string };

function sortSubcategoryOptions(options: SubcategoryOption[]) {
  return [...options].sort(
    (a, b) =>
      groupOrder(a.group) - groupOrder(b.group) ||
      a.label.localeCompare(b.label, "pt-BR"),
  );
}

function classificationCatalogForRows(rows: RawRow[]): SubcategoryOption[] {
  const catalog = new Map<string, SubcategoryOption>();
  rows.forEach((row) => {
    if (!isChannelSegment(row.operational_segment)) return;
    const label = segmentLabel(row.operational_segment);
    const group = resolvedGroupKey(row.operational_segment, row.dashboard_group);
    const current = catalog.get(label);
    if (!current || groupOrder(group) < groupOrder(current.group)) {
      catalog.set(label, { label, group });
    }
  });
  return sortSubcategoryOptions([...catalog.values()]);
}

function SubcategoryMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: SubcategoryOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  const toggle = (label: string) => {
    onChange(
      selectedSet.has(label)
        ? selected.filter((item) => item !== label)
        : [...selected, label],
    );
  };

  return (
    <div className="multi-select-label filter-field">
      <span>Canal</span>
      <details className="subcategory-multiselect">
        <summary>
          <span>{selected.length ? `${selected.length} selecionada${selected.length > 1 ? "s" : ""}` : "Todas as canais"}</span>
          <small>Escolher</small>
        </summary>
        <div className="subcategory-option-list">
          <div className="subcategory-option-actions">
            <strong>Filtrar canais</strong>
            {selected.length > 0 && <button type="button" onClick={() => onChange([])}>Limpar seleção</button>}
          </div>
          {options.map((option) => {
            const active = selectedSet.has(option.label);
            return (
              <button
                type="button"
                className={active ? "selected" : ""}
                aria-pressed={active}
                onClick={() => toggle(option.label)}
                key={`${option.group}-${option.label}`}
              >
                <CheckCircle2 aria-hidden="true" />
                <span><strong>{option.label}</strong><small>{groupLabel(option.group)}</small></span>
              </button>
            );
          })}
        </div>
      </details>
      <small>{selected.length ? "Somente as opções marcadas entram no ranking" : "Sem seleção: todas entram no ranking"}</small>
    </div>
  );
}

function NavIcon({ name }: { name: Tab }) {
  const Icon =
    name === "summary"
      ? Table2
      : name === "comparison"
        ? CalendarRange
        : name === "semester"
          ? BarChart3
          : name === "highlights"
            ? Trophy
          : name === "campaigns"
            ? MailSearch
          : name === "creative"
            ? Code2
          : name === "frequency"
            ? Clock3
          : name === "classifications"
            ? Layers3
          : name === "load"
            ? UploadCloud
          : name === "insights"
            ? Sparkles
            : name === "guide"
              ? ClipboardCheck
            : LayoutDashboard;
  return <Icon aria-hidden="true" />;
}

function KpiCard({
  label,
  value,
  variation,
  status,
  icon,
  tone,
  compareLabel = "vs. mês anterior",
}: {
  label: string;
  value: string;
  variation: string;
  status: string;
  icon: LucideIcon;
  tone: string;
  compareLabel?: string;
}) {
  const Icon = icon;
  return (
    <article className="kpi-card">
      <div className={`kpi-icon icon-${tone}`}>
        <Icon aria-hidden="true" />
      </div>
      <div className="kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={status}>{variation} <em>{compareLabel}</em></small>
      </div>
    </article>
  );
}

function buildMonthlyKpis(current: Enriched, previous: Enriched) {
  return [
    {
      label: "Comunicações",
      value: formatInt(current.communications),
      variation: variationLabel(current.communications, previous.communications),
      status: trendClass(current.communications, previous.communications),
      icon: Layers3,
      tone: "com",
    },
    {
      label: "Emails enviados",
      value: formatInt(current.sent),
      variation: variationLabel(current.sent, previous.sent),
      status: trendClass(current.sent, previous.sent),
      icon: Send,
      tone: "env",
    },
    {
      label: "Emails recebidos",
      value: formatInt(current.delivered),
      variation: variationLabel(current.delivered, previous.delivered),
      status: trendClass(current.delivered, previous.delivered),
      icon: MailCheck,
      tone: "rec",
    },
    {
      label: "Taxa de abertura",
      value: formatPercent(current.openRate),
      variation: variationLabel(current.openRate, previous.openRate, "pp"),
      status: trendClass(current.openRate, previous.openRate),
      icon: Eye,
      tone: "or",
    },
    {
      label: "Cliques únicos",
      value: formatInt(current.clicks),
      variation: variationLabel(current.clicks, previous.clicks),
      status: trendClass(current.clicks, previous.clicks),
      icon: MousePointerClick,
      tone: "clk",
    },
    {
      label: "CTR",
      value: formatPercent(current.ctr),
      variation: variationLabel(current.ctr, previous.ctr, "pp"),
      status: trendClass(current.ctr, previous.ctr),
      icon: MoveUpRight,
      tone: "ctr",
    },
    {
      label: "CTR qualificado",
      value: formatPercent(current.qualifiedCtr),
      variation: variationLabel(current.qualifiedCtr, previous.qualifiedCtr, "pp"),
      status: trendClass(current.qualifiedCtr, previous.qualifiedCtr),
      icon: MousePointerClick,
      tone: "qctr",
    },
    {
      label: "CTOR",
      value: formatPercent(current.ctor),
      variation: variationLabel(current.ctor, previous.ctor, "pp"),
      status: trendClass(current.ctor, previous.ctor),
      icon: Target,
      tone: "ctor",
    },
    {
      label: "Bounce rate",
      value: formatPercent(current.bounce),
      variation: variationLabel(current.bounce, previous.bounce, "pp"),
      status: trendClass(current.bounce, previous.bounce, true),
      icon: ShieldCheck,
      tone: "bnc",
    },
    {
      label: "Opt-out rate",
      value: formatPercent(current.optout),
      variation: variationLabel(current.optout, previous.optout, "pp"),
      status: trendClass(current.optout, previous.optout, true),
      icon: Percent,
      tone: "opt",
    },
  ];
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function ExportActions({
  imageTargetId,
  imageName,
}: {
  onCsv?: () => void;
  imageTargetId?: string;
  imageName?: string;
}) {
  return (
    <div className="export-actions">
      {imageTargetId && imageName && (
        <button
          type="button"
          onClick={() => exportElementPng(imageTargetId, imageName)}
          title="Exportar gráfico em PNG"
        >
          <Download aria-hidden="true" />
          PNG
        </button>
      )}
    </div>
  );
}

function TrendChart({
  rows,
  months,
}: {
  rows: RawRow[];
  months: string[];
}) {
  const efficiencySeries = [
    { key: "ctr" as RateKey, label: "CTR", color: "#4257E8" },
    { key: "qualifiedCtr" as RateKey, label: "CTR qualificado", color: "#1B0088" },
    { key: "ctor" as RateKey, label: "CTOR", color: "#FF2080" },
    { key: "bounce" as RateKey, label: "Bounce", color: "#ED1650" },
  ];
  const values = months.map((month) => totalForMonth(rows, month));
  const width = 840;
  const height = 180;
  const pad = { left: 52, right: 28, top: 26, bottom: 32 };
  const innerW = width - pad.left - pad.right;
  const x = (index: number) =>
    pad.left + (months.length === 1 ? innerW / 2 : (index / (months.length - 1)) * innerW);
  const openRates = values.map((item) => item.openRate);
  const rawOpeningMin = Math.min(...openRates);
  const rawOpeningMax = Math.max(...openRates, 0.01);
  const openingSpread = rawOpeningMax - rawOpeningMin;
  const openingPadding = Math.max(0.015, openingSpread * 0.35);
  const openingMin = Math.max(0, rawOpeningMin - openingPadding);
  const openingMax = rawOpeningMax + openingPadding;
  const openingY = (value: number) =>
    pad.top + (height - pad.top - pad.bottom) * (1 - (value - openingMin) / (openingMax - openingMin));
  const openingPoints = values.map((item, index) => `${x(index)},${openingY(item.openRate)}`).join(" ");
  const currentOpening = values.at(-1)?.openRate || 0;
  const previousOpening = values.at(-2)?.openRate || 0;

  const renderEfficiencySpark = (serie: (typeof efficiencySeries)[number]) => {
    const metricValues = values.map((item) => item[serie.key]);
    const metricMin = Math.min(...metricValues, 0);
    const metricMax = Math.max(...metricValues, 0.001);
    const metricSpread = metricMax - metricMin;
    const metricPadding = Math.max(0.0015, metricSpread * 0.2);
    const min = Math.max(0, metricMin - metricPadding);
    const max = metricMax + metricPadding;
    const sparkX = (index: number) => 24 + (metricValues.length === 1 ? 156 : (index / (metricValues.length - 1)) * 312);
    const sparkY = (value: number) => 78 - ((value - min) / (max - min)) * 48;
    const points = metricValues.map((value, index) => `${sparkX(index)},${sparkY(value)}`).join(" ");
    const current = metricValues.at(-1) || 0;
    const previous = metricValues.at(-2) || 0;
    return (
      <article className="trend-mini-card" key={serie.key}>
        <div className="trend-mini-heading">
          <span><i style={{ background: serie.color }} />{serie.label}</span>
          <div>
            <strong>{formatPercent(current)}</strong>
            <small className={trendClass(current, previous, serie.key === "bounce")}>
              {variationLabel(current, previous)} vs. mês anterior
            </small>
          </div>
        </div>
        <svg viewBox="0 0 360 120" role="img" aria-label={`Evolução de ${serie.label}`}>
          <line x1="24" y1="78" x2="336" y2="78" className="spark-baseline" />
          <polyline points={points} fill="none" stroke={serie.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {metricValues.map((value, index) => (
            <g key={months[index]}>
              <circle cx={sparkX(index)} cy={sparkY(value)} r="3.5" fill="#fff" stroke={serie.color} strokeWidth="2">
                <title>{formatMonth(months[index])}: {formatPercent(value)}</title>
              </circle>
              {(months.length <= 6 || index === metricValues.length - 1) && (
                <text x={sparkX(index)} y={Math.max(12, sparkY(value) - 9)} textAnchor="middle" className="trend-spark-value" fill={serie.color}>
                  {formatPercent(value)}
                </text>
              )}
              <text x={sparkX(index)} y="110" textAnchor="middle" className="trend-spark-month">
                {formatMonth(months[index], true)}
              </text>
            </g>
          ))}
        </svg>
      </article>
    );
  };

  return (
    <div className="chart-shell trend-dashboard">
      <section className="trend-opening-card">
        <div className="trend-opening-heading">
          <div><span><i />Taxa de abertura</span><small>Aberturas únicas sobre emails recebidos</small></div>
          <div><strong>{formatPercent(currentOpening)}</strong><small className={trendClass(currentOpening, previousOpening)}>{variationLabel(currentOpening, previousOpening)} vs. mês anterior</small></div>
        </div>
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img">
          <title>Evolução mensal da taxa de abertura</title>
          {[0, 0.5, 1].map((ratio) => {
            const value = openingMin + (openingMax - openingMin) * ratio;
            const yy = openingY(value);
            return <g key={ratio}><line x1={pad.left} y1={yy} x2={width - pad.right} y2={yy} className="grid-line" /><text x={pad.left - 9} y={yy + 4} textAnchor="end" className="axis-label">{formatPercent(value, 1)}</text></g>;
          })}
          <polyline points={openingPoints} fill="none" stroke="#9452FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {values.map((item, index) => (
            <g key={months[index]}>
              <circle cx={x(index)} cy={openingY(item.openRate)} r="5" fill="#fff" stroke="#9452FF" strokeWidth="3"><title>{formatMonth(months[index])}: {formatPercent(item.openRate)}</title></circle>
              {(months.length <= 6 || index === values.length - 1) && <text x={x(index)} y={openingY(item.openRate) - 12} textAnchor="middle" className="opening-point-label">{formatPercent(item.openRate)}</text>}
            </g>
          ))}
        {months.map((month, index) => (
            <text key={month} x={x(index)} y={height - 10} textAnchor="middle" className="axis-label">{formatMonth(month, true)}</text>
        ))}
        </svg>
      </section>
      <section className="trend-efficiency-grid" aria-label="Evolução das métricas de eficiência">
        {efficiencySeries.map(renderEfficiencySpark)}
      </section>
    </div>
  );
}

function CompositionChart({
  data,
  total,
}: {
  data: ReturnType<typeof groupRows>;
  total: number;
}) {
  return (
    <div className="composition">
      {data.map((item) => {
        const share = total > 0 ? item.sent / total : 0;
        return (
          <div className="composition-row" key={item.label}>
            <div className="composition-meta">
              <span><i style={{ background: GROUP_COLORS[item.label] }} />{GROUP_LABELS[item.label] || item.label}</span>
              <strong>{formatPercent(share, 1)} <em>{formatInt(item.sent)}</em></strong>
            </div>
            <div className="composition-track">
              <span
                style={{
                  width: `${share * 100}%`,
                  background: GROUP_COLORS[item.label] || "#9452FF",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalCompare({
  title,
  subtitle,
  current,
  previous,
  metric,
  exportId,
  imageName,
}: {
  title: string;
  subtitle: string;
  current: ReturnType<typeof groupRows>;
  previous: ReturnType<typeof groupRows>;
  metric: "openRate" | "ctor";
  exportId?: string;
  imageName?: string;
}) {
  const labels = Array.from(
    new Set([...current.map((item) => item.label), ...previous.map((item) => item.label)]),
  );
  const max = Math.max(
    0.01,
    ...labels.flatMap((label) => [
      current.find((item) => item.label === label)?.[metric] || 0,
      previous.find((item) => item.label === label)?.[metric] || 0,
    ]),
  );
  return (
    <article className="panel compare-panel" id={exportId}>
      <div className="panel-head">
        <SectionTitle title={title} subtitle={subtitle} />
        {exportId && imageName && <ExportActions imageTargetId={exportId} imageName={imageName} />}
      </div>
      <div className="compare-legend">
        <span><i className="dot-current" />Atual</span>
        <span><i className="dot-previous" />Anterior</span>
      </div>
      <div className="horizontal-chart">
        {labels.map((label) => {
          const a = current.find((item) => item.label === label)?.[metric] || 0;
          const b = previous.find((item) => item.label === label)?.[metric] || 0;
          return (
            <div className="horizontal-set" key={label}>
              <span className="bar-label">{GROUP_LABELS[label] || label}</span>
              <div className="bar-pair">
                <div className="h-bar current" style={{ width: `${(a / max) * 100}%` }}>
                  <b>{formatPercent(a)}</b>
                </div>
                <div className="h-bar previous" style={{ width: `${(b / max) * 100}%` }}>
                  <b>{formatPercent(b)}</b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SummaryBarChart({
  data,
}: {
  data: ReturnType<typeof segmentRows>;
}) {
  const maximum = Math.max(1, ...data.map((item) => item.sent));
  return (
    <div
      className="summary-bar-chart"
      role="img"
      aria-label="Emails enviados por canal no mês selecionado"
    >
      {data.map((item) => (
        <div className="summary-bar-row" key={`${item.group}-${item.label}`}>
          <div className="summary-bar-label">
            <i style={{ background: segmentColor(item.label) }} />
            <span>{item.label}</span>
          </div>
          <div className="summary-bar-track">
            <i
              style={{
                width: `${Math.max(1.5, (item.sent / maximum) * 100)}%`,
                background: segmentColor(item.label),
              }}
            />
          </div>
          <strong>{formatInt(item.sent)}</strong>
        </div>
      ))}
    </div>
  );
}

function VerticalCompare({
  title,
  subtitle,
  current,
  previous,
  metric,
  currentMonth,
  previousMonth,
  exportId,
  imageName,
}: {
  title: string;
  subtitle: string;
  current: ReturnType<typeof segmentRows>;
  previous: ReturnType<typeof segmentRows>;
  metric: "openRate" | "ctr";
  currentMonth: string;
  previousMonth: string;
  exportId?: string;
  imageName?: string;
}) {
  const categories = sortSubcategoryOptions(
    Array.from(
      new Map(
        [...previous, ...current].map((item) => [
          item.label,
          { label: item.label, group: groupKey(item.group) },
        ]),
      ).values(),
    ),
  );
  const labels = categories.map((item) => item.label);
  const max = Math.max(
    0.01,
    ...labels.flatMap((label) => [
      current.find((item) => item.label === label)?.[metric] || 0,
      previous.find((item) => item.label === label)?.[metric] || 0,
    ]),
  );
  return (
    <article className="panel vertical-panel" id={exportId}>
      <div className="panel-head">
        <SectionTitle title={title} subtitle={subtitle} />
        {exportId && imageName && <ExportActions imageTargetId={exportId} imageName={imageName} />}
      </div>
      <div className="compare-legend">
        <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
        <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
      </div>
      <div className="vertical-scroll">
        <div
          className="vertical-chart"
          style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
        >
          {categories.map((category, index) => {
            const { label, group } = category;
            const a = current.find((item) => item.label === label)?.[metric] || 0;
            const b = previous.find((item) => item.label === label)?.[metric] || 0;
            const startsGroup = index === 0 || categories[index - 1].group !== group;
            return (
              <div className={`vertical-category${startsGroup ? " group-start" : ""}`} key={`${group}-${label}`}>
                <div className="vertical-bars">
                  <div
                    className="v-bar previous"
                    style={{ height: `${Math.max(2, (b / max) * 100)}%` }}
                  >
                    <b>{formatPercent(b)}</b>
                  </div>
                  <div
                    className="v-bar current"
                    style={{ height: `${Math.max(2, (a / max) * 100)}%` }}
                  >
                    <b>{formatPercent(a)}</b>
                  </div>
                </div>
                <span>
                  <span><i style={{ background: segmentColor(label) }} />{label}</span>
                  <small>{groupLabel(group)}</small>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (role: SessionRole) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as {
        authenticated?: boolean;
        role?: SessionRole;
        error?: string;
      };
      if (!response.ok || !payload.authenticated || !payload.role) {
        setError(payload.error || "Não foi possível validar o acesso.");
        return;
      }
      onAuthenticated(payload.role);
    } catch {
      setError("Não foi possível conectar ao serviço de login.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 44 38" aria-hidden="true">
              <path d="M3 18 40 3 28 35l-7-10-9 5 3-10-12-2Z" />
              <path d="m15 20 25-17" />
            </svg>
          </div>
          <div>
            <strong>COMUNICAÇÃO LATAM</strong>
            <span>Email Marketing Performance</span>
          </div>
        </div>
        <div className="login-lock">
          <LockKeyhole aria-hidden="true" />
        </div>
        <h1>Acesso ao dashboard</h1>
        <p>Informe seu usuário e senha para consultar os indicadores oficiais de Email Marketing.</p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>Usuário</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuário"
            />
          </label>
          <label>
            <span>Senha de acesso</span>
            <input
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              type="password"
            />
          </label>
          {error && <small className="login-error">{error}</small>}
          <button type="submit" disabled={submitting || !username.trim() || !password.trim()}>
            {submitting ? "Validando..." : "Entrar"}
          </button>
        </form>
        <small className="login-note">
          As permissões são liberadas conforme o nível de acesso: admin, equipe ou cliente.
        </small>
      </section>
    </main>
  );
}

function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking", role: null });
  const [tab, setTab] = useState<Tab>("overview");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [executivePeriod, setExecutivePeriod] = useState<"month" | "quarter" | "semester" | "custom">("semester");
  const [executiveQuarter, setExecutiveQuarter] = useState("");
  const [executiveSemester, setExecutiveSemester] = useState("");
  const [executiveStartDate, setExecutiveStartDate] = useState("");
  const [executiveEndDate, setExecutiveEndDate] = useState("");
  const [summaryMonth, setSummaryMonth] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [previousMonth, setPreviousMonth] = useState("");
  const [comparisonSegment, setComparisonSegment] = useState("ALL");
  const [trendCount, setTrendCount] = useState(6);
  const [highlights, setHighlights] = useState<CampaignHighlight[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetail[]>([]);
  const [highlightMonth, setHighlightMonth] = useState("");
  const [highlightMetric, setHighlightMetric] = useState<HighlightMetric>("open_rate");
  const [highlightMinSent, setHighlightMinSent] = useState(100);
  const [highlightSubcategories, setHighlightSubcategories] = useState<string[]>([]);
  const [campaignMonth, setCampaignMonth] = useState("");
  const [campaignGroup, setCampaignGroup] = useState("");
  const [campaignClassification, setCampaignClassification] = useState("");
  const [campaignMinSent, setCampaignMinSent] = useState(0);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignSort, setCampaignSort] = useState<CampaignSort>("emails_sent");
  const [campaignSortDirection, setCampaignSortDirection] = useState<"desc" | "asc">("desc");
  const [creativeMonth, setCreativeMonth] = useState("");
  const [creativeDispatchId, setCreativeDispatchId] = useState("");
  const [creativeHtml, setCreativeHtml] = useState("");
  const [creativeSavedAt, setCreativeSavedAt] = useState<string | null>(null);
  const [creativeStatus, setCreativeStatus] = useState("");
  const [creativeError, setCreativeError] = useState("");
  const [classificationMonth, setClassificationMonth] = useState("");
  const [classificationSelected, setClassificationSelected] = useState("");
  const [classificationCompareA, setClassificationCompareA] = useState("");
  const [classificationCompareB, setClassificationCompareB] = useState("");
  const [frequencyMonth, setFrequencyMonth] = useState("");
  const [timingGroup, setTimingGroup] = useState("ALL");
  const [timingSubcategory, setTimingSubcategory] = useState("ALL");
  const [loadMonth, setLoadMonth] = useState("2026-07");
  const [loadWorkbook, setLoadWorkbook] = useState<ParsedWorkbook | null>(null);
  const [loadFileName, setLoadFileName] = useState("");
  const [loadSheetName, setLoadSheetName] = useState("");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadError, setLoadError] = useState("");
  const [loadValidation, setLoadValidation] = useState<LoadValidation | null>(null);
  const [loadReplaceMonth, setLoadReplaceMonth] = useState(false);
  const [loadResult, setLoadResult] = useState("");
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as {
          authenticated?: boolean;
          role?: SessionRole | null;
        };
        if (payload.authenticated && payload.role) {
          setAuth({ status: "authenticated", role: payload.role });
        } else {
          setAuth({ status: "anonymous", role: null });
          setLoading(false);
        }
      } catch {
        setAuth({ status: "anonymous", role: null });
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    async function loadData() {
      try {
        const endpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_monthly_by_segment` +
          "?select=month_ref,month_key,dashboard_group,operational_segment,communications,emails_sent,emails_delivered,unique_opens,total_clicks,unique_clicks,unsubscribes,bounces,cta_communications,cta_emails_sent,cta_unique_clicks,qualified_ctr" +
          "&order=month_ref.asc,dashboard_group.asc,operational_segment.asc";
        const highlightsEndpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_campaign_highlights` +
          "?select=month_key,campaign_name,subject,dashboard_groups,operational_segments,audience_rows,emails_sent,emails_delivered,unique_opens,unique_clicks,unsubscribes,bounces,open_rate,ctr,ctor,bounce_rate,optout_rate,has_cta,cta_communications,cta_emails_sent,cta_unique_clicks,qualified_ctr" +
          "&order=month_key.asc,campaign_name.asc,dashboard_groups.asc,operational_segments.asc";
        const detailsEndpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_dispatch_detail` +
          "?select=dispatch_id,month_key,campaign_name,subject,campaign_link,send_at,dashboard_groups,operational_segments,source_category,cta,has_cta,audience_rows,emails_sent,emails_delivered,unique_opens,unique_clicks,unsubscribes,bounces,open_rate,ctr,qualified_ctr,ctor,bounce_rate,optout_rate" +
          "&order=month_key.asc,send_at.asc,campaign_name.asc,dispatch_id.asc";
        const [payload, highlightsPayload, detailsPayload] = await Promise.all([
          fetchAllSupabaseRows<RawRow>(endpoint, "Consulta mensal"),
          fetchAllSupabaseRows<CampaignHighlight>(highlightsEndpoint, "Consulta de destaques"),
          fetchAllSupabaseRows<CampaignDetail>(detailsEndpoint, "Consulta granular"),
        ]);
        const visibleData = applyDashboardExclusions(payload, highlightsPayload, detailsPayload);
        const operational = visibleData.monthlyRows.filter(
          (row) => row.operational_segment.trim().toUpperCase() !== "LATAMERS",
        );

        const monthlyCommunications = new Map<string, number>();
        operational.forEach((row) => {
          monthlyCommunications.set(
            row.month_key,
            (monthlyCommunications.get(row.month_key) || 0) + num(row.communications),
          );
        });
        const granularCommunications = new Map<string, number>();
        visibleData.detailRows.forEach((row) => {
          granularCommunications.set(
            row.month_key,
            (granularCommunications.get(row.month_key) || 0) + 1,
          );
        });
        const reconciliationMonths = new Set([
          ...monthlyCommunications.keys(),
          ...granularCommunications.keys(),
        ]);
        const reconciliationErrors = Array.from(reconciliationMonths).filter(
          (month) =>
            (monthlyCommunications.get(month) || 0) !==
            (granularCommunications.get(month) || 0),
        );
        if (reconciliationErrors.length) {
          throw new Error(
            `A conferência entre resumo e disparos falhou em: ${reconciliationErrors.join(", ")}`,
          );
        }

        setRows(operational);
        setHighlights(visibleData.highlightRows);
        setCampaignDetails(visibleData.detailRows);
        const months = Array.from(new Set(operational.map((row) => row.month_key))).sort();
        const latest = months.at(-1) || "";
        const prior = months.at(-2) || latest;
        setSelectedMonth(latest);
        if (latest) {
          const [year, monthNumber] = latest.split("-").map(Number);
          setExecutiveQuarter(`${year}-Q${Math.ceil(monthNumber / 3)}`);
          const semesterKeys = Array.from(new Set(months.map((monthKey) => {
            const [monthYear, number] = monthKey.split("-").map(Number);
            return `${monthYear}-S${Math.ceil(number / 6)}`;
          }))).sort();
          const completeSemester = semesterKeys.filter((key) => {
            const [semesterYear, half] = key.split("-S").map(Number);
            const firstMonth = half === 1 ? 1 : 7;
            return Array.from({ length: 6 }, (_, index) => `${semesterYear}-${String(firstMonth + index).padStart(2, "0")}`)
              .every((monthKey) => months.includes(monthKey));
          }).at(-1);
          setExecutiveSemester(completeSemester || `${year}-S${Math.ceil(monthNumber / 6)}`);
          setExecutiveStartDate(`${latest}-01`);
          setExecutiveEndDate(`${latest}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`);
        }
        setSummaryMonth(latest);
        setCurrentMonth(latest);
        setPreviousMonth(prior);
        setHighlightMonth(latest);
        setCampaignMonth(latest);
        setCreativeMonth(latest);
        setClassificationMonth(latest);
        setClassificationCompareA(prior);
        setClassificationCompareB(latest);
        setFrequencyMonth(latest);
        const latestSegments = operational
          .filter((row) => row.month_key === latest)
          .sort((a, b) => num(b.emails_sent) - num(a.emails_sent));
        setClassificationSelected(
          latestSegments.length ? segmentLabel(latestSegments[0].operational_segment) : "",
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Falha ao carregar os dados.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetch("/api/load/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { updatedAt?: string | null }) => setDataUpdatedAt(payload.updatedAt || null))
      .catch(() => setDataUpdatedAt(null));
  }, [auth.status]);

  useEffect(() => {
    const canManageCreative = auth.status === "authenticated" && (auth.role === "admin" || auth.role === "team");
    if (auth.status === "authenticated" && (tab === "load" ? auth.role !== "admin" : tab === "creative" && !canManageCreative)) {
      setTab("overview");
    }
  }, [auth, tab]);

  const months = useMemo(
    () => Array.from(new Set(rows.map((row) => row.month_key))).sort(),
    [rows],
  );
  useEffect(() => {
    if (months.length === 0) return;
    const lastMonth = months[months.length - 1];
    const [year, month] = lastMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!loadValidation && !loadFileName) setLoadMonth(nextKey);
  }, [loadFileName, loadValidation, months]);

  useEffect(() => {
    const options = campaignDetails
      .filter((item) => item.month_key === creativeMonth)
      .sort((a, b) => num(b.emails_sent) - num(a.emails_sent));
    if (!options.length) {
      if (creativeDispatchId) setCreativeDispatchId("");
      return;
    }
    if (!creativeDispatchId || !options.some((item) => item.dispatch_id === creativeDispatchId)) {
      setCreativeDispatchId(options[0].dispatch_id);
    }
  }, [campaignDetails, creativeDispatchId, creativeMonth]);

  useEffect(() => {
    if (auth.status !== "authenticated" || !creativeDispatchId) return;
    let cancelled = false;
    setCreativeError("");
    setCreativeStatus("Buscando peça salva...");
    fetch(`/api/creative?dispatchId=${encodeURIComponent(creativeDispatchId)}`, { cache: "no-store" })
      .then((response) => readApiJson<{ record?: CreativeRecord | null; error?: string }>(response).then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok) {
          setCreativeHtml("");
          setCreativeSavedAt(null);
          setCreativeError(payload.error || "Não foi possível consultar peça salva.");
          setCreativeStatus("");
          return;
        }
        setCreativeHtml(payload.record?.html_source || "");
        setCreativeSavedAt(payload.record?.updated_at || null);
        setCreativeStatus(payload.record ? "Peça salva carregada." : "Nenhuma peça salva para este disparo.");
      })
      .catch((error) => {
        if (cancelled) return;
        setCreativeHtml("");
        setCreativeSavedAt(null);
        setCreativeStatus("");
        setCreativeError(error instanceof Error ? error.message : "Falha ao consultar peça salva.");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, creativeDispatchId]);

  const classificationCatalog = useMemo(
    () => classificationCatalogForRows(rows.filter((row) => row.month_key === classificationMonth)),
    [rows, classificationMonth],
  );
  const classificationOptions = useMemo(
    () => classificationCatalog.map((item) => item.label),
    [classificationCatalog],
  );
  const campaignClassificationOptions = useMemo(
    () => classificationCatalogForRows(rows.filter((row) => row.month_key === campaignMonth)).map((item) => item.label),
    [rows, campaignMonth],
  );
  const highlightClassificationCatalog = useMemo(
    () => classificationCatalogForRows(rows.filter((row) => row.month_key === highlightMonth)),
    [rows, highlightMonth],
  );
  const comparisonClassificationOptions = useMemo(() => {
    const previousLabels = new Set(
      rows.filter((row) => row.month_key === previousMonth && isChannelSegment(row.operational_segment))
        .map((row) => segmentLabel(row.operational_segment)),
    );
    return classificationCatalogForRows(rows.filter((row) => row.month_key === currentMonth))
      .map((item) => item.label)
      .filter((label) => previousLabels.has(label));
  }, [rows, currentMonth, previousMonth]);
  useEffect(() => {
    if (campaignClassification && campaignClassification !== "ALL" && !campaignClassificationOptions.includes(campaignClassification)) {
      setCampaignClassification("ALL");
    }
  }, [campaignClassification, campaignClassificationOptions]);
  useEffect(() => {
    if (classificationOptions.length && !classificationOptions.includes(classificationSelected)) {
      setClassificationSelected(classificationOptions[0]);
    }
  }, [classificationOptions, classificationSelected]);
  useEffect(() => {
    if (comparisonSegment !== "ALL" && !comparisonClassificationOptions.includes(comparisonSegment)) {
      setComparisonSegment("ALL");
    }
  }, [comparisonClassificationOptions, comparisonSegment]);
  useEffect(() => {
    const valid = new Set(highlightClassificationCatalog.map((item) => item.label));
    setHighlightSubcategories((selected) => selected.every((item) => valid.has(item)) ? selected : selected.filter((item) => valid.has(item)));
  }, [highlightClassificationCatalog]);
  useEffect(() => {
    if (!months.length) return;
    const latest = months.at(-1) || "";
    const prior = months.at(-2) || latest;
    setClassificationCompareA((current) => months.includes(current) ? current : prior);
    setClassificationCompareB((current) => months.includes(current) ? current : latest);
  }, [months]);
  const comparisonRows = useMemo(
    () =>
      comparisonSegment === "ALL"
        ? rows
        : rows.filter(
            (row) => segmentLabel(row.operational_segment) === comparisonSegment,
          ),
    [comparisonSegment, rows],
  );
  const selectedIndex = months.indexOf(selectedMonth);
  const executiveQuarterOptions = Array.from(new Set(months.map((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${year}-Q${Math.ceil(monthNumber / 3)}`;
  }))).sort().reverse();
  const executiveSemesterOptions = Array.from(new Set(months.map((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${year}-S${Math.ceil(monthNumber / 6)}`;
  }))).sort().reverse();
  const executiveLatestMonth = months.at(-1) || "";
  const executiveLatestDate = executiveLatestMonth
    ? `${executiveLatestMonth}-${String(new Date(Number(executiveLatestMonth.slice(0, 4)), Number(executiveLatestMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`
    : undefined;
  const executivePeriodBounds = (() => {
    if (executivePeriod === "month") {
      if (!selectedMonth) return null;
      const [year, monthNumber] = selectedMonth.split("-").map(Number);
      return { start: `${selectedMonth}-01`, end: `${selectedMonth}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}` };
    }
    if (executivePeriod === "custom") {
      return executiveStartDate && executiveEndDate && executiveStartDate <= executiveEndDate
        ? { start: executiveStartDate, end: executiveEndDate } : null;
    }
    const key = executivePeriod === "quarter" ? executiveQuarter : executiveSemester;
    const match = key.match(/^(\d{4})-[QS]([1-4])$/);
    if (!match) return null;
    const year = Number(match[1]);
    const index = Number(match[2]);
    const startMonth = executivePeriod === "quarter" ? (index - 1) * 3 + 1 : (index - 1) * 6 + 1;
    const endMonth = executivePeriod === "quarter" ? startMonth + 2 : startMonth + 5;
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(new Date(year, endMonth, 0).getDate()).padStart(2, "0")}`;
    return { start, end };
  })();
  const executiveDispatches = executivePeriodBounds
    ? campaignDetails.filter((item) => {
        const day = item.send_at?.slice(0, 10) || "";
        return day >= executivePeriodBounds.start && day <= executivePeriodBounds.end;
      })
    : [];
  const executiveMonthsWithData = Array.from(new Set(
    executiveDispatches.map((item) => item.send_at?.slice(0, 7)).filter((month): month is string => Boolean(month)),
  )).sort();
  const executiveMonthLabels = executiveMonthsWithData.map((month) => formatMonth(month));
  const executiveExpectedMonths = executivePeriod === "quarter" ? 3 : executivePeriod === "semester" ? 6 : 0;
  const executivePeriodLabel = executivePeriod === "month"
    ? (selectedMonth ? formatMonth(selectedMonth) : "Mês")
    : executivePeriod === "quarter"
      ? `${executiveQuarter.slice(6)}º trimestre de ${executiveQuarter.slice(0, 4)}`
      : executivePeriod === "semester"
        ? `${executiveSemester.slice(6)}º semestre de ${executiveSemester.slice(0, 4)}`
        : executivePeriodBounds
          ? `${executivePeriodBounds.start.slice(8, 10)}/${executivePeriodBounds.start.slice(5, 7)}/${executivePeriodBounds.start.slice(0, 4)} a ${executivePeriodBounds.end.slice(8, 10)}/${executivePeriodBounds.end.slice(5, 7)}/${executivePeriodBounds.end.slice(0, 4)}`
          : "Intervalo personalizado";
  const executiveAgencies = campaignMetrics(executiveDispatches.filter((item) => campaignGroupKeys(item).includes("TRADE")));
  const executiveCompanies = campaignMetrics(executiveDispatches.filter((item) => campaignGroupKeys(item).includes("CORP")));
  const executiveCombined = campaignMetrics(executiveDispatches.filter((item) => campaignGroupKeys(item).some((key) => key === "TRADE" || key === "CORP")));
  const executiveMetrics = [
    { label: "Aberturas únicas", key: "opens" as const, format: formatInt },
    { label: "Open Rate", key: "openRate" as const, format: (value: number) => formatPercent(value) },
    { label: "CTR", key: "ctr" as const, format: (value: number) => formatPercent(value) },
    { label: "CTOR", key: "ctor" as const, format: (value: number) => formatPercent(value) },
    { label: "Taxa de bounce", key: "bounce" as const, format: (value: number) => formatPercent(value) },
    { label: "Opt-out", key: "optout" as const, format: (value: number) => formatPercent(value) },
  ];
  const executiveChartMetrics = [
    { label: "Open Rate", key: "openRate" as const },
    { label: "CTR", key: "ctr" as const },
    { label: "CTOR", key: "ctor" as const },
    { label: "Bounce", key: "bounce" as const, lowerIsBetter: true },
  ];
  const selectedPrevious =
    selectedIndex > 0 ? months[selectedIndex - 1] : selectedMonth;
  const current = totalForMonth(rows, selectedMonth);
  const previous = totalForMonth(rows, selectedPrevious);
  const groups = groupRows(rows, selectedMonth);
  const segments = segmentRows(rows, selectedMonth);
  const segmentsByOpenRate = [...segments].sort((a, b) => b.openRate - a.openRate);
  const segmentsByCtr = [...segments].sort((a, b) => b.ctr - a.ctr);
  const maximumSegmentCtr = Math.max(...segmentsByCtr.map((item) => item.ctr), 0.0001);
  const segmentsByCommunications = [...segments].sort((a, b) => b.communications - a.communications);
  const trendMonths = months.slice(-trendCount);
  const summaryIndex = months.indexOf(summaryMonth);
  const summaryPreviousMonth =
    summaryIndex > 0 ? months[summaryIndex - 1] : summaryMonth;
  const summaryTotal = totalForMonth(rows, summaryMonth);
  const summaryPrevious = totalForMonth(rows, summaryPreviousMonth);
  const summaryGroups = groupRows(rows, summaryMonth);
  const summarySegments = segmentRows(rows, summaryMonth);
  const compareCurrent = totalForMonth(comparisonRows, currentMonth);
  const comparePrevious = totalForMonth(comparisonRows, previousMonth);
  const compareGroupsCurrent = groupRows(comparisonRows, currentMonth);
  const compareGroupsPrevious = groupRows(comparisonRows, previousMonth);
  const compareSegmentsCurrent = segmentRows(comparisonRows, currentMonth)
    .filter((item) => item.label !== "Canal não classificado");
  const compareSegmentsPrevious = segmentRows(comparisonRows, previousMonth)
    .filter((item) => item.label !== "Canal não classificado");
  const semesterTotal = campaignMetrics(executiveDispatches);
  const semesterAgencies = executiveAgencies;
  const semesterCompanies = executiveCompanies;
  const semesterOthers = campaignMetrics(executiveDispatches.filter((item) => campaignGroupKeys(item).includes("OUTROS")));
  const semesterRowsByAudience = [
    { label: "Agências", note: "Categoria", data: semesterAgencies },
    { label: "Empresas", note: "Categoria", data: semesterCompanies },
  ];
  const semesterMainKpis = [
    { label: "Enviados", value: formatInt(semesterTotal.sent), icon: Send, tone: "env" },
    { label: "Recebidos", value: formatInt(semesterTotal.delivered), icon: MailCheck, tone: "rec" },
    { label: "Open Rate", value: formatPercent(semesterTotal.openRate), icon: Eye, tone: "or" },
    { label: "Clicks", value: formatInt(semesterTotal.clicks), icon: MousePointerClick, tone: "clk" },
    { label: "CTR", value: formatPercent(semesterTotal.ctr), icon: MoveUpRight, tone: "ctr" },
    { label: "CTR qualificado", value: formatPercent(semesterTotal.qualifiedCtr), icon: MousePointerClick, tone: "qctr" },
    { label: "CTOR", value: formatPercent(semesterTotal.ctor), icon: Target, tone: "ctor" },
    { label: "Bounce", value: formatPercent(semesterTotal.bounce), icon: ShieldCheck, tone: "bnc" },
    { label: "Opt-out", value: formatPercent(semesterTotal.optout), icon: Percent, tone: "opt" },
  ];
  const semesterTableMetrics: Array<{ label: string; key: keyof Enriched; type: "number" | "rate"; inverse?: boolean }> = [
    { label: "Comunicados", key: "communications" as const, type: "number" },
    { label: "Enviados", key: "sent" as const, type: "number" },
    { label: "Recebidos", key: "delivered" as const, type: "number" },
    { label: "Open Rate", key: "openRate" as const, type: "rate" },
    { label: "Clicks", key: "clicks" as const, type: "number" },
    { label: "CTR", key: "ctr" as const, type: "rate" },
    { label: "CTR qualificado", key: "qualifiedCtr" as const, type: "rate" },
    { label: "CTOR", key: "ctor" as const, type: "rate" },
    { label: "Bounce", key: "bounce" as const, type: "rate", inverse: true },
    { label: "Opt-out", key: "optout" as const, type: "rate", inverse: true },
  ];
  const rateSignal = (value: number, benchmark: number, inverse = false) => {
    if (value === benchmark) return "neutral";
    const above = value > benchmark;
    return inverse ? (above ? "negative" : "positive") : above ? "positive" : "negative";
  };

  if (auth.status === "checking") {
    return (
      <main className="state-screen">
        <div className="loader" />
        <h1>Validando acesso</h1>
        <p>Conferindo sua sessão antes de carregar o dashboard.</p>
      </main>
    );
  }

  if (auth.status === "anonymous") {
    return (
      <LoginScreen
        onAuthenticated={(role) => {
          setAuth({ status: "authenticated", role });
          setLoading(true);
        }}
      />
    );
  }

  if (loading) {
    return (
      <main className="state-screen">
        <div className="loader" />
        <h1>Carregando dados oficiais</h1>
        <p>Consultando a base consolidada de Email Marketing.</p>
      </main>
    );
  }

  if (error || rows.length === 0) {
    return (
      <main className="state-screen">
        <div className="state-mark">!</div>
        <h1>Não foi possível carregar os dados</h1>
        <p>{error || "A consulta não retornou registros."}</p>
        <button onClick={() => window.location.reload()}>Tentar novamente</button>
      </main>
    );
  }

  const isAdmin = auth.role === "admin";
  const canManageCreative = auth.role === "admin" || auth.role === "team";
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuth({ status: "anonymous", role: null });
    setRows([]);
    setHighlights([]);
    setCampaignDetails([]);
    setTab("overview");
  };
  const selectedLoadSheet = loadWorkbook?.sheets.find((sheet) => sheet.name === loadSheetName);
  const resetLoadValidation = () => {
    setLoadValidation(null);
    setLoadError("");
    setLoadResult("");
  };
  const handleLoadFile = async (file: File | null) => {
    if (!file) return;
    resetLoadValidation();
    setLoadWorkbook(null);
    setLoadFileName(file.name);
    setLoadSheetName("");
    setLoadStatus("parsing");
    try {
      const workbook = await parseXlsx(await file.arrayBuffer());
      if (workbook.sheets.length === 0) throw new Error("Arquivo sem abas legíveis.");
      const preferred =
        workbook.sheets.find((sheet) => sheet.name.toUpperCase().includes(loadMonth.replace("-", ""))) ||
        workbook.sheets.find((sheet) => sheet.name.toUpperCase().includes("BASE_GERAL")) ||
        workbook.sheets[0];
      setLoadWorkbook(workbook);
      setLoadSheetName(preferred.name);
      setLoadStatus("idle");
    } catch (error) {
      setLoadStatus("error");
      setLoadError(error instanceof Error ? error.message : "Não foi possível ler o arquivo XLSX.");
    }
  };
  const validateLoad = async () => {
    if (!selectedLoadSheet || !loadFileName) {
      setLoadError("Selecione um arquivo e uma aba antes de validar.");
      return;
    }
    resetLoadValidation();
    setLoadStatus("validating");
    try {
      const response = await fetch("/api/load/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: loadMonth,
          fileName: loadFileName,
          sheetName: selectedLoadSheet.name,
          rows: selectedLoadSheet.rows,
        }),
      });
      const payload = await readApiJson<{ validation?: LoadValidation; error?: string }>(response);
      if (!response.ok || !payload.validation) throw new Error(payload.error || "Falha na validação.");
      const dashboardComparison = buildLoadComparisonFromDashboardRows(
        rows,
        payload.validation.monthKey,
        payload.validation.totals,
      );
      const validation = dashboardComparison
        ? {
            ...payload.validation,
            comparison: dashboardComparison,
            warnings: payload.validation.warnings.filter(
              (item) => !item.includes("Comparação histórica indisponível"),
            ),
          }
        : payload.validation;
      setLoadValidation(validation);
      setLoadReplaceMonth(false);
      setLoadStatus("validated");
    } catch (error) {
      setLoadStatus("error");
      setLoadError(error instanceof Error ? error.message : "Não foi possível validar a carga.");
    }
  };
  const commitLoad = async () => {
    if (!selectedLoadSheet || !loadValidation) return;
    setLoadError("");
    setLoadResult("");
    setLoadStatus("committing");
    try {
      const response = await fetch("/api/load/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: loadMonth,
          fileName: loadFileName,
          sheetName: selectedLoadSheet.name,
          rows: selectedLoadSheet.rows,
          replaceMonth: loadReplaceMonth,
        }),
      });
      const payload = await readApiJson<{ ok?: boolean; loadId?: string | null; validation?: LoadValidation; error?: string }>(response);
      if (!response.ok || !payload.ok) {
        if (payload.validation) setLoadValidation(payload.validation);
        throw new Error(payload.error || "Não foi possível gravar a carga.");
      }
      setLoadStatus("committed");
      setLoadResult(
        payload.loadId
          ? `Carga aprovada e publicada. Load ID: ${payload.loadId}`
          : "Carga aprovada e publicada. Registro de auditoria não retornou ID, mas os dados oficiais foram gravados.",
      );
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setLoadStatus("error");
      setLoadError(error instanceof Error ? error.message : "Não foi possível aprovar a carga.");
    }
  };

  const saveCreative = async () => {
    if (!creativeSelectedCampaign) {
      setCreativeError("Selecione um disparo antes de salvar a peça.");
      return;
    }
    if (!creativeHtml.trim()) {
      setCreativeError("Cole o HTML da peça antes de salvar.");
      return;
    }
    setCreativeError("");
    setCreativeStatus("Salvando peça...");
    try {
      const response = await fetch("/api/creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatchId: creativeSelectedCampaign.dispatch_id,
          monthKey: creativeSelectedCampaign.month_key,
          campaignName: creativeSelectedCampaign.campaign_name,
          subject: creativeSelectedCampaign.subject,
          campaignLink: creativeSelectedCampaign.campaign_link,
          html: creativeHtml,
        }),
      });
      const payload = await readApiJson<{ ok?: boolean; record?: CreativeRecord | null; error?: string }>(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível salvar a peça.");
      }
      setCreativeSavedAt(payload.record?.updated_at || new Date().toISOString());
      setCreativeStatus("Peça salva e vinculada ao disparo.");
    } catch (error) {
      setCreativeStatus("");
      setCreativeError(error instanceof Error ? error.message : "Falha ao salvar a peça.");
    }
  };

  const kpis = buildMonthlyKpis(current, previous);
  const summaryKpis = buildMonthlyKpis(summaryTotal, summaryPrevious);
  const loadHistoryUnavailable = Boolean(
    loadValidation?.warnings.some((item) => item.includes("Comparação histórica indisponível")),
  );
  const highlightConfig = HIGHLIGHT_METRICS[highlightMetric];
  const highlightSubcategorySet = new Set(highlightSubcategories);
  const highlightMonthRows = highlights.filter(
    (item) =>
      item.month_key === highlightMonth &&
      num(item.emails_sent) >= highlightMinSent &&
      (highlightSubcategories.length === 0 ||
        Array.from(highlightSubcategorySet).some((label) => campaignHasClassification(item, label))) &&
      (highlightMetric !== "qualified_ctr" || num(item.cta_emails_sent) > 0),
  );
  const highlightSorter =
    (direction: "best" | "worst") => (a: CampaignHighlight, b: CampaignHighlight) => {
      const av = num(a[highlightMetric]);
      const bv = num(b[highlightMetric]);
      if (highlightConfig.inverse) {
        return direction === "best" ? av - bv : bv - av;
      }
      return direction === "best" ? bv - av : av - bv;
    };
  const bestHighlights = [...highlightMonthRows]
    .sort(highlightSorter("best"))
    .slice(0, 3);
  const worstHighlights = [...highlightMonthRows]
    .sort(highlightSorter("worst"))
    .slice(0, 3);
  const displayedHighlights = Array.from(
    new Map(
      [...bestHighlights, ...worstHighlights].map((item) => [
        `${item.month_key}|${item.campaign_name}|${item.subject}`,
        item,
      ]),
    ).values(),
  );
  const highlightCsvRows = displayedHighlights
    .map((item) => [
      formatMonth(item.month_key),
      item.campaign_name,
      item.subject,
      campaignGroupListLabel(item),
      segmentListLabel(item.operational_segments),
      num(item.emails_sent),
      num(item.emails_delivered),
      num(item.unique_opens),
      num(item.unique_clicks),
      formatPercent(num(item.open_rate)),
      formatPercent(num(item.ctr)),
      item.has_cta ? "Sim" : "Não",
      num(item.cta_emails_sent),
      num(item.cta_unique_clicks),
      formatPercent(num(item.qualified_ctr)),
      formatPercent(num(item.ctor)),
      formatPercent(num(item.bounce_rate)),
      formatPercent(num(item.optout_rate)),
    ]);
  const highlightBenchmark = campaignMetrics(highlightMonthRows);
  const highlightBenchmarkValue =
    highlightMetric === "open_rate"
      ? highlightBenchmark.openRate
      : highlightMetric === "qualified_ctr"
        ? highlightBenchmark.qualifiedCtr
      : highlightMetric === "bounce_rate"
        ? highlightBenchmark.bounce
        : highlightBenchmark[highlightMetric];

  const campaignGroups = Array.from(
    new Set(campaignDetails.filter((item) => item.month_key === campaignMonth).flatMap((item) => campaignGroupKeys(item))),
  ).sort((a, b) => groupOrder(a) - groupOrder(b));
  const timingGroups = Array.from(
    new Set(campaignDetails.filter((item) => item.month_key === frequencyMonth).flatMap((item) => campaignGroupKeys(item))),
  ).sort((a, b) => groupOrder(a) - groupOrder(b));
  const normalizedCampaignSearch = campaignSearch.trim().toLocaleLowerCase("pt-BR");
  const campaignRows = campaignDetails
    .filter((item) => item.month_key === campaignMonth)
    .filter(() => Boolean(campaignGroup || campaignClassification))
    .filter((item) => !campaignGroup || campaignGroup === "ALL" || campaignGroupKeys(item).includes(campaignGroup))
    .filter((item) => !campaignClassification || campaignClassification === "ALL" || campaignHasClassification(item, campaignClassification))
    .filter((item) => num(item.emails_sent) >= campaignMinSent)
    .filter(
      (item) =>
        !normalizedCampaignSearch ||
        `${item.campaign_name} ${item.subject}`.toLocaleLowerCase("pt-BR").includes(normalizedCampaignSearch),
    )
    .sort((a, b) => {
      const delta = num(a[campaignSort]) - num(b[campaignSort]);
      return campaignSortDirection === "asc" ? delta : -delta;
    });
  const campaignTotals = campaignMetrics(campaignRows);
  const campaignNeedsFilter = !campaignGroup && !campaignClassification;
  const campaignCsvRows = campaignRows.map((item) => [
    formatMonth(item.month_key),
    item.campaign_name,
    item.subject,
    formatSendDate(item.send_at),
    campaignGroupListLabel(item),
    segmentListLabel(item.operational_segments),
    item.source_category || "",
    item.cta || "",
    item.campaign_link || "",
    num(item.emails_sent),
    num(item.emails_delivered),
    num(item.unique_opens),
    num(item.unique_clicks),
    num(item.bounces),
    num(item.unsubscribes),
    formatPercent(num(item.open_rate)),
    formatPercent(num(item.ctr)),
    item.has_cta ? "Sim" : "Não",
    formatPercent(num(item.qualified_ctr)),
    formatPercent(num(item.ctor)),
    formatPercent(num(item.bounce_rate)),
    formatPercent(num(item.optout_rate)),
  ]);

  const creativeCampaignOptions = campaignDetails
    .filter((item) => item.month_key === creativeMonth)
    .sort((a, b) => num(b.emails_sent) - num(a.emails_sent));
  const creativeSelectedCampaign =
    creativeCampaignOptions.find((item) => item.dispatch_id === creativeDispatchId) ||
    creativeCampaignOptions[0] ||
    null;
  const creativeAnalysis = analyzeCreativeHtml(creativeHtml, creativeSelectedCampaign);

  const timingMonthRows = campaignDetails.filter((item) => item.month_key === frequencyMonth);
  const timingRowsWithDate = timingMonthRows.filter((item) => parsedSendDate(item.send_at));
  const timingSubcategoryOptions = Array.from(
    new Set(
      timingRowsWithDate
        .filter((item) => timingGroup === "ALL" || campaignGroupKeys(item).includes(timingGroup))
        .flatMap((item) => String(item.operational_segments || "").split(/\s*[,;|]\s*/)
          .filter(isChannelSegment).map(segmentLabel)),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const timingRows = timingRowsWithDate
    .filter((item) => timingGroup === "ALL" || campaignGroupKeys(item).includes(timingGroup))
    .filter((item) => timingSubcategory === "ALL" || campaignHasClassification(item, timingSubcategory));
  const timingTotals = campaignMetrics(timingRows);
  const timingCoverage = timingMonthRows.length
    ? timingRowsWithDate.length / timingMonthRows.length
    : 0;
  const weekdayTiming = WEEKDAY_BUCKETS.map((bucket) => {
    const items = timingRows.filter((item) => parsedSendDate(item.send_at)?.getDay() === bucket.day);
    return { ...bucket, items, metrics: campaignMetrics(items) };
  });
  const hourTiming = TIME_BUCKETS.map((bucket) => {
    const items = timingRows.filter((item) => {
      const hour = parsedSendDate(item.send_at)?.getHours();
      return hour !== undefined && hour >= bucket.start && hour <= bucket.end;
    });
    return { ...bucket, items, metrics: campaignMetrics(items) };
  });
  const maxWeekdayDispatches = Math.max(1, ...weekdayTiming.map((item) => item.items.length));
  const maxHeatmapDispatches = Math.max(
    1,
    ...WEEKDAY_BUCKETS.flatMap((day) =>
      TIME_BUCKETS.map((time) =>
        timingRows.filter((item) => {
          const date = parsedSendDate(item.send_at);
          return date && date.getDay() === day.day && date.getHours() >= time.start && date.getHours() <= time.end;
        }).length,
      ),
    ),
  );
  const busiestDay = [...weekdayTiming].sort((a, b) => b.items.length - a.items.length)[0];
  const busiestTime = [...hourTiming].sort((a, b) => b.items.length - a.items.length)[0];
  const reliableTimeBuckets = hourTiming.filter((item) => item.items.length >= 3);
  const bestOpenTime = [...reliableTimeBuckets].sort((a, b) => b.metrics.openRate - a.metrics.openRate)[0];
  const bestCtrTime = [...reliableTimeBuckets].sort((a, b) => b.metrics.ctr - a.metrics.ctr)[0];

  const classificationIndex = months.indexOf(classificationMonth);
  const classificationPreviousMonth =
    classificationIndex > 0 ? months[classificationIndex - 1] : classificationMonth;
  const classificationCurrentRows = rows.filter(
    (row) =>
      row.month_key === classificationMonth &&
      segmentLabel(row.operational_segment) === classificationSelected,
  );
  const classificationPreviousRows = rows.filter(
    (row) =>
      row.month_key === classificationPreviousMonth &&
      segmentLabel(row.operational_segment) === classificationSelected,
  );
  const classificationCurrent = totalForRows(classificationCurrentRows);
  const classificationPrevious = totalForRows(classificationPreviousRows);
  const classificationCompareRowsA = rows.filter(
    (row) =>
      row.month_key === classificationCompareA &&
      segmentLabel(row.operational_segment) === classificationSelected,
  );
  const classificationCompareRowsB = rows.filter(
    (row) =>
      row.month_key === classificationCompareB &&
      segmentLabel(row.operational_segment) === classificationSelected,
  );
  const classificationCompareMetricsA = totalForRows(classificationCompareRowsA);
  const classificationCompareMetricsB = totalForRows(classificationCompareRowsB);
  const classificationCompareItems = [
    { label: "Comunicados", key: "communications", valueType: "volume" },
    { label: "Emails enviados", key: "sent", valueType: "volume" },
    { label: "Emails recebidos", key: "delivered", valueType: "volume" },
    { label: "Aberturas únicas", key: "opens", valueType: "volume" },
    { label: "Cliques únicos", key: "clicks", valueType: "volume" },
    { label: "Open Rate", key: "openRate", valueType: "rate" },
    { label: "CTR", key: "ctr", valueType: "rate" },
    { label: "CTR qualificado", key: "qualifiedCtr", valueType: "rate" },
    { label: "CTOR", key: "ctor", valueType: "rate" },
    { label: "Bounce", key: "bounce", valueType: "rate", inverse: true },
    { label: "Opt-out", key: "optout", valueType: "rate", inverse: true },
  ] as const;
  const classificationReference = classificationCurrentRows[0] || classificationPreviousRows[0];
  const classificationGroup = resolvedGroupKey(
    classificationReference?.operational_segment || classificationSelected,
    classificationReference?.dashboard_group || "",
  );
  const classificationCampaigns = campaignDetails
    .filter(
      (item) =>
        item.month_key === classificationMonth &&
        campaignHasClassification(item, classificationSelected),
    )
    .sort((a, b) => num(b.emails_sent) - num(a.emails_sent));
  const classificationTrend = months.map((month) => {
    const data = totalForRows(
      rows.filter(
        (row) =>
          row.month_key === month &&
          segmentLabel(row.operational_segment) === classificationSelected,
      ),
    );
    return { month, ...data };
  });
  const classificationTrendMax = Math.max(
    0.01,
    ...classificationTrend.map((item) => item.openRate),
  );
  const classificationCsvRows = classificationCampaigns.map((item) => [
    formatMonth(item.month_key),
    classificationSelected,
    item.campaign_name,
    item.subject,
    num(item.emails_sent),
    num(item.emails_delivered),
    num(item.unique_opens),
    num(item.unique_clicks),
    formatPercent(num(item.open_rate)),
    formatPercent(num(item.ctr)),
    item.has_cta ? "Sim" : "Não",
    formatPercent(num(item.qualified_ctr)),
    formatPercent(num(item.ctor)),
    formatPercent(num(item.bounce_rate)),
    formatPercent(num(item.optout_rate)),
  ]);
  const overviewSegmentCsvRows = segmentsByOpenRate.map((item) => [
    item.label,
    GROUP_LABELS[item.group] || item.group,
    item.communications,
    item.sent,
    item.delivered,
    item.opens,
    item.clicks,
    formatPercent(item.openRate),
    formatPercent(item.ctr),
    formatPercent(item.qualifiedCtr),
    formatPercent(item.ctor),
    formatPercent(item.optout),
    formatPercent(item.bounce),
  ]);
  const comparisonKpiCsvRows = [
    ["Comunicações", compareCurrent.communications, comparePrevious.communications, variationLabel(compareCurrent.communications, comparePrevious.communications)],
    ["Emails enviados", compareCurrent.sent, comparePrevious.sent, variationLabel(compareCurrent.sent, comparePrevious.sent)],
    ["Emails recebidos", compareCurrent.delivered, comparePrevious.delivered, variationLabel(compareCurrent.delivered, comparePrevious.delivered)],
    ["Taxa de abertura", formatPercent(compareCurrent.openRate), formatPercent(comparePrevious.openRate), variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")],
    ["Cliques únicos", compareCurrent.clicks, comparePrevious.clicks, variationLabel(compareCurrent.clicks, comparePrevious.clicks)],
    ["CTR", formatPercent(compareCurrent.ctr), formatPercent(comparePrevious.ctr), variationLabel(compareCurrent.ctr, comparePrevious.ctr, "pp")],
    ["CTR qualificado", formatPercent(compareCurrent.qualifiedCtr), formatPercent(comparePrevious.qualifiedCtr), variationLabel(compareCurrent.qualifiedCtr, comparePrevious.qualifiedCtr, "pp")],
    ["CTOR", formatPercent(compareCurrent.ctor), formatPercent(comparePrevious.ctor), variationLabel(compareCurrent.ctor, comparePrevious.ctor, "pp")],
    ["Bounce", formatPercent(compareCurrent.bounce), formatPercent(comparePrevious.bounce), variationLabel(compareCurrent.bounce, comparePrevious.bounce, "pp")],
  ];
  const semesterCsvRows = semesterTableMetrics.map((metric) => [
    metric.label,
    metric.type === "rate" ? formatPercent(Number(semesterAgencies[metric.key])) : formatInt(Number(semesterAgencies[metric.key])),
    metric.type === "rate" ? formatPercent(Number(semesterCompanies[metric.key])) : formatInt(Number(semesterCompanies[metric.key])),
    metric.type === "rate" ? formatPercent(Number(semesterTotal[metric.key])) : formatInt(Number(semesterTotal[metric.key])),
  ]);
  const summarySegmentCsvRows = summarySegments.map((item) => [
    formatMonth(summaryMonth),
    GROUP_LABELS[item.group] || item.group,
    item.label,
    item.communications,
    item.sent,
    item.delivered,
    item.opens,
    item.clicks,
    formatPercent(item.openRate),
    formatPercent(item.ctr),
    formatPercent(item.qualifiedCtr),
    formatPercent(item.ctor),
    formatPercent(item.optout),
    formatPercent(item.bounce),
  ]);
  const summaryUnifiedCsvRows = ["TRADE", "CORP", "OUTROS"].flatMap((group) => {
    const groupTotal = summaryGroups.find((item) => item.label === group);
    const groupSegments = summarySegments.filter((item) => item.group === group);
    if (!groupTotal || groupSegments.length === 0) return [];
    return [
      ...groupSegments.map((item) => [
        formatMonth(summaryMonth),
        GROUP_LABELS[item.group] || item.group,
        item.label,
        item.communications,
        item.sent,
        item.delivered,
        item.opens,
        item.clicks,
        formatPercent(item.openRate),
        formatPercent(item.ctr),
        formatPercent(item.qualifiedCtr),
        formatPercent(item.ctor),
        formatPercent(item.optout),
        formatPercent(item.bounce),
      ]),
      [
        formatMonth(summaryMonth),
        GROUP_LABELS[group] || group,
        `Subtotal ${GROUP_LABELS[group] || group}`,
        groupTotal.communications,
        groupTotal.sent,
        groupTotal.delivered,
        groupTotal.opens,
        groupTotal.clicks,
        formatPercent(groupTotal.openRate),
        formatPercent(groupTotal.ctr),
        formatPercent(groupTotal.qualifiedCtr),
        formatPercent(groupTotal.ctor),
        formatPercent(groupTotal.optout),
        formatPercent(groupTotal.bounce),
      ],
    ];
  });

  const deliveryChange = pp(compareCurrent.delivery, comparePrevious.delivery);
  const openChange = pp(compareCurrent.openRate, comparePrevious.openRate);
  const comparisonSegmentLabels = Array.from(
    new Set([
      ...compareSegmentsCurrent.map((item) => item.label),
      ...compareSegmentsPrevious.map((item) => item.label),
    ]),
  );
  const comparableSegmentPairs = comparisonSegmentLabels
    .map((label) => ({
      label,
      current: compareSegmentsCurrent.find((item) => item.label === label),
      previous: compareSegmentsPrevious.find((item) => item.label === label),
    }))
    .filter(
      (item) =>
        item.current &&
        item.previous &&
        item.current.communications >= 3 &&
        item.previous.communications >= 3 &&
        item.current.sent >= 100 &&
        item.previous.sent >= 100,
    );
  const segmentMovements = comparableSegmentPairs
    .flatMap((label) => {
      const currentSegment = label.current;
      const previousSegment = label.previous;
      if (!currentSegment || !previousSegment || !currentSegment.sent || !previousSegment.sent) {
        return [];
      }
      return [
        {
          label: label.label,
          metric: "Taxa de abertura",
          current: currentSegment.openRate,
          previous: previousSegment.openRate,
          change: diff(currentSegment.openRate, previousSegment.openRate) || 0,
        },
        {
          label: label.label,
          metric: "CTR",
          current: currentSegment.ctr,
          previous: previousSegment.ctr,
          change: diff(currentSegment.ctr, previousSegment.ctr) || 0,
        },
      ];
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  const clickDeclines = comparableSegmentPairs
    .map((item) => {
      const currentSegment = item.current;
      const previousSegment = item.previous;
      return {
        label: item.label,
        change:
          currentSegment && previousSegment
            ? diff(currentSegment.ctr, previousSegment.ctr) || 0
            : 0,
      };
    })
    .filter((item) => item.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 3)
    .map((item) => item.label);
  const journeyStages = [
    ["Emails enviados", "volume disparado", compareCurrent.sent, comparePrevious.sent],
    ["Emails recebidos", "chegaram ao destino", compareCurrent.delivered, comparePrevious.delivered],
    ["Aberturas únicas", "pessoas que abriram", compareCurrent.opens, comparePrevious.opens],
    ["Cliques únicos", "pessoas que clicaram", compareCurrent.clicks, comparePrevious.clicks],
  ] as const;
  const journeyMaximum = Math.max(compareCurrent.sent, comparePrevious.sent, 1);
  const volumeDelta = compareCurrent.sent - comparePrevious.sent;
  const deliveredDelta = compareCurrent.delivered - comparePrevious.delivered;
  const opensDelta = compareCurrent.opens - comparePrevious.opens;
  const clicksDelta = compareCurrent.clicks - comparePrevious.clicks;
  const optoutChange = diff(compareCurrent.optout, comparePrevious.optout);
  const volumeHeadline = volumeDelta === 0
    ? `${formatInt(compareCurrent.sent)} emails enviados`
    : `${formatInt(Math.abs(volumeDelta))} envios ${volumeDelta > 0 ? "a mais" : "a menos"}`;
  const deliveryPreserved =
    deliveryChange >= 0 && compareCurrent.bounce <= comparePrevious.bounce;
  const deliveryHeadline = `${formatPercent(compareCurrent.delivery)} chegaram ao destino`;
  const openingHeadline = `${formatPercent(compareCurrent.openRate)} abriram o email`;
  const clickHeadline = `${formatInt(compareCurrent.clicks)} pessoas clicaram`;
  const volumeCopy = `${formatInt(compareCurrent.sent)} enviados em ${monthName(currentMonth)} contra ${formatInt(comparePrevious.sent)} em ${monthName(previousMonth)}.`;
  const deliveryCopy = deliveryPreserved
    ? `${formatInt(compareCurrent.delivered)} emails foram recebidos. A entrega melhorou e o bounce diminuiu.`
    : `Entrega de ${formatPercent(compareCurrent.delivery)} em ${monthName(currentMonth)} versus ${formatPercent(comparePrevious.delivery)} em ${monthName(previousMonth)}.`;
  const openingCopy = `${formatInt(compareCurrent.opens)} aberturas únicas. No mês anterior, eram ${formatInt(comparePrevious.opens)} e a taxa era ${formatPercent(comparePrevious.openRate)}.`;
  const clickCopy = `${formatInt(Math.abs(clicksDelta))} cliques ${clicksDelta >= 0 ? "a mais" : "a menos"} que no mês anterior. O CTR ficou em ${formatPercent(compareCurrent.ctr)}.`;
  const bounceAlerts = [...compareSegmentsCurrent]
    .filter((item) => item.sent >= 100)
    .sort((a, b) => b.bounce - a.bounce)
    .slice(0, 3)
    .map((item) => item.label);
  const optoutAlerts = [...compareSegmentsCurrent]
    .filter((item) => item.sent >= 100)
    .sort((a, b) => b.optout - a.optout)
    .slice(0, 3)
    .map((item) => item.label);
  const setInsightMonth = (month: string) => {
    setCurrentMonth(month);
    const index = months.indexOf(month);
    setPreviousMonth(index > 0 ? months[index - 1] : month);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand brand-partnership" aria-label="JazzSide e LATAM">
          <img className="brand-partnership-logo" src="/jazz-latam.png" alt="JazzSide e LATAM" />
        </div>
        <nav>
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            <NavIcon name="overview" /> Visão geral
          </button>
          <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
            <NavIcon name="summary" /> Resumo mensal
          </button>
          <button className={tab === "insights" ? "active" : ""} onClick={() => {
            setComparisonSegment("ALL");
            setTab("insights");
          }}>
            <NavIcon name="insights" /> Insights
          </button>
          <button className={tab === "guide" ? "active" : ""} onClick={() => setTab("guide")}>
            <NavIcon name="guide" /> Guia de leitura
          </button>
          <button className={tab === "comparison" ? "active" : ""} onClick={() => setTab("comparison")}>
            <NavIcon name="comparison" /> Mês a mês
          </button>
          <button className={tab === "classifications" ? "active" : ""} onClick={() => setTab("classifications")}>
            <NavIcon name="classifications" /> Análise por canal
          </button>
          <button className={tab === "highlights" ? "active" : ""} onClick={() => setTab("highlights")}>
            <NavIcon name="highlights" /> Disparos Top 3
          </button>
          <button className={tab === "campaigns" ? "active" : ""} onClick={() => setTab("campaigns")}>
            <NavIcon name="campaigns" /> Disparos
          </button>
          {canManageCreative && (
            <button className={tab === "creative" ? "active" : ""} onClick={() => setTab("creative")}>
              <NavIcon name="creative" /> Peças
            </button>
          )}
          <button className={tab === "frequency" ? "active" : ""} onClick={() => setTab("frequency")}>
            <NavIcon name="frequency" /> Dias e horários
          </button>
          <button className={tab === "semester" ? "active" : ""} onClick={() => setTab("semester")}>
            <NavIcon name="semester" /> Análise por período
          </button>
          {isAdmin && (
            <button className={tab === "load" ? "active" : ""} onClick={() => setTab("load")}>
              <NavIcon name="load" /> Carga
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          <div>
            <strong>{isAdmin ? "Acesso admin" : auth.role === "team" ? "Acesso equipe" : "Acesso cliente"}</strong>
            <small>{isAdmin ? "Carga e peças liberadas" : canManageCreative ? "Peças, dashboard e exportações liberados" : "Dashboard e exportações liberados"}</small>
            <button type="button" className="logout-button" onClick={handleLogout}>
              <LogOut aria-hidden="true" /> Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <span className="eyebrow">EMAIL MARKETING · PERFORMANCE</span>
            <h1>
              {tab === "overview" && "Visão geral"}
              {tab === "summary" && "Resumo mensal"}
              {tab === "comparison" && "Comparativo mensal"}
              {tab === "semester" && "Análise por período"}
              {tab === "highlights" && "Disparos em destaque"}
              {tab === "campaigns" && "Análise de disparos"}
              {tab === "creative" && "Análise da peça"}
              {tab === "frequency" && "Padrões de envio"}
              {tab === "classifications" && "Análise por canal"}
              {tab === "load" && "Carga e validação"}
              {tab === "insights" && "Insights gerenciais"}
              {tab === "guide" && "Como ler o dashboard"}
            </h1>
            <p>
              {tab === "overview" && "Leitura consolidada da operação e seus principais indicadores."}
              {tab === "summary" && "Visão oficial validada, organizada por Agências, Empresas e Outros."}
              {tab === "comparison" && "Evolução dos KPIs oficiais entre os períodos selecionados."}
              {tab === "semester" && "Compare categorias e acompanhe os resultados por mês, trimestre, semestre ou datas escolhidas."}
              {tab === "highlights" && "Top 3: maiores e menores disparos por performance"}
              {tab === "campaigns" && "Explore cada disparo, aplique filtros e investigue os indicadores oficiais."}
              {tab === "creative" && "Renderize o HTML da campanha e cruze a leitura criativa com os KPIs oficiais."}
              {tab === "frequency" && "Volume e performance por dia da semana e faixa de horário."}
              {tab === "classifications" && "Resultado, evolução e destaques de cada canal em uma única leitura gerencial."}
              {tab === "load" && "Ambiente operacional para preparar cargas mensais com pré-validação antes de publicar no painel."}
              {tab === "insights" && "O que mudou, por que merece atenção e quais ações priorizar com base nos dados oficiais."}
              {tab === "guide" && "Um caminho simples para transformar os números do mês em perguntas e decisões melhores."}
            </p>
          </div>
          {tab === "overview" ? (
            <label className="select-control">
              <span>Período de referência</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
              </select>
            </label>
          ) : tab === "summary" ? (
            <label className="select-control">
              <span>Mês de referência</span>
              <select value={summaryMonth} onChange={(event) => setSummaryMonth(event.target.value)}>
                {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
              </select>
            </label>
          ) : tab === "comparison" || tab === "semester" || tab === "highlights" || tab === "campaigns" || tab === "creative" || tab === "frequency" || tab === "classifications" || tab === "load" || tab === "guide" ? (
            <span className="validated-badge"><i />Dados atualizados{dataUpdatedAt ? ` em ${formatDateTime(dataUpdatedAt)}` : ""}</span>
          ) : (
            <div className="insight-period">
              <label className="select-control">
                <span>Mês analisado</span>
                <select value={currentMonth} onChange={(event) => setInsightMonth(event.target.value)}>
                  {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                </select>
              </label>
              <span className="scope-pill"><i />Comparação com o mês anterior</span>
            </div>
          )}
        </header>

        {tab === "overview" && (
          <>
            <section className="kpi-grid">
              {kpis.map((item) => <KpiCard key={item.label} {...item} />)}
            </section>

            <section className="overview-main-grid">
              <article className="panel trend-panel" id="overview-trend-export">
                <div className="panel-head">
                  <SectionTitle title="Evolução das principais métricas" subtitle="Taxas recalculadas a partir dos volumes oficiais" />
                  <div className="panel-actions">
                    <select value={trendCount} onChange={(event) => setTrendCount(Number(event.target.value))}>
                      <option value={6}>Últimos 6 meses</option>
                      <option value={12}>Últimos 12 meses</option>
                    </select>
                    <ExportActions imageTargetId="overview-trend-export" imageName={`evolucao-metricas-${selectedMonth}.png`} />
                  </div>
                </div>
                <TrendChart rows={rows} months={trendMonths} />
              </article>
              <article className="panel composition-panel" id="overview-composition-export">
                <div className="panel-head">
                  <SectionTitle title="Composição dos envios" subtitle={`Distribuição por categoria · ${formatMonth(selectedMonth)}`} />
                  <ExportActions imageTargetId="overview-composition-export" imageName={`composicao-envios-${selectedMonth}.png`} />
                </div>
                <div className="composition-total">
                  <span>Total apresentado</span>
                  <strong>{formatInt(current.sent)}</strong>
                  <small>emails enviados</small>
                </div>
                <CompositionChart data={groups} total={current.sent} />
              </article>
            </section>

            <section className="detail-grid">
              <article className="panel table-panel" id="overview-table-export">
                <div className="panel-head">
                  <SectionTitle title="Performance por canal" subtitle="Ordenado pela taxa de abertura" />
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `performance-canal-${selectedMonth}.csv`,
                        ["Canal", "Categoria", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTR qualificado", "CTOR", "Opt-out", "Bounce"],
                        overviewSegmentCsvRows,
                      )
                    }
                    imageTargetId="overview-table-export"
                    imageName={`performance-canal-${selectedMonth}.png`}
                  />
                </div>
                <div className="table-scroll">
                  <table className="overview-performance-table">
                    <colgroup>
                      <col className="col-subcategory" />
                      <col className="col-category" />
                      <col className="col-volume" />
                      <col className="col-volume" />
                      <col className="col-rate" />
                      <col className="col-clicks" />
                      <col className="col-rate" />
                      <col className="col-qualified" />
                      <col className="col-rate" />
                      <col className="col-rate" />
                    </colgroup>
                    <thead><tr><th>Canal</th><th>Categoria</th><th>Enviados</th><th>Recebidos</th><th>OR</th><th>Cliques</th><th>CTR</th><th>CTR qual.</th><th>CTOR</th><th>Bounce</th></tr></thead>
                    <tbody>
                      {segmentsByOpenRate.map((item) => (
                        <tr key={`${item.group}-${item.label}`}>
                          <td title={item.label}><i style={{ background: segmentColor(item.label) }} />{item.label}</td>
                          <td>{GROUP_LABELS[item.group] || item.group}</td>
                          <td>{formatInt(item.sent)}</td>
                          <td>{formatInt(item.delivered)}</td>
                          <td>{formatPercent(item.openRate)}</td>
                          <td>{formatInt(item.clicks)}</td>
                          <td>{formatPercent(item.ctr)}</td>
                          <td>{formatPercent(item.qualifiedCtr)}</td>
                          <td>{formatPercent(item.ctor)}</td>
                          <td>{formatPercent(item.bounce)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td>Total geral</td><td>—</td><td>{formatInt(current.sent)}</td><td>{formatInt(current.delivered)}</td><td>{formatPercent(current.openRate)}</td><td>{formatInt(current.clicks)}</td><td>{formatPercent(current.ctr)}</td><td>{formatPercent(current.qualifiedCtr)}</td><td>{formatPercent(current.ctor)}</td><td>{formatPercent(current.bounce)}</td></tr></tfoot>
                  </table>
                </div>
              </article>
              <article className="panel ranking-panel" id="overview-ctr-ranking-export">
                <div className="panel-head">
                  <SectionTitle title="CTR por canal" subtitle="Ordenado pela taxa de cliques" />
                  <ExportActions imageTargetId="overview-ctr-ranking-export" imageName={`ranking-ctr-${selectedMonth}.png`} />
                </div>
                <div className="ranking">
                  {segmentsByCtr.map((item) => (
                    <div key={`${item.group}-${item.label}`}>
                      <span>{item.label}</span>
                      <div><i style={{ width: `${(item.ctr / maximumSegmentCtr) * 100}%`, background: segmentColor(item.label) }} /></div>
                      <strong>{formatPercent(item.ctr)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}

        {tab === "summary" && (
          <div className="summary-view">
            <section className="kpi-grid compact-kpi-grid">
              {summaryKpis.map((item) => <KpiCard key={item.label} {...item} />)}
            </section>

            <section className="summary-groups">
              <article className="summary-group-card unified-summary-card" id="summary-monthly-table-export">
                <div className="summary-group-title">
                  <div className="summary-group-label">
                    <span style={{ background: GROUP_COLORS.TRADE }} />
                    <div>
                      <h3>Resumo mensal unificado</h3>
                      <p>Agências, Empresas e Outros em uma única tabela, com subtotais por categoria.</p>
                    </div>
                  </div>
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `resumo-mensal-unificado-${summaryMonth}.csv`,
                        ["Mês", "Categoria", "Canal", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTR qualificado", "CTOR", "Opt-out", "Bounce"],
                        summaryUnifiedCsvRows,
                      )
                    }
                    imageTargetId="summary-monthly-table-export"
                    imageName={`resumo-mensal-unificado-${summaryMonth}.png`}
                  />
                </div>
                <div className="summary-table-scroll">
                  <table className="summary-table unified-summary-table">
                    <colgroup>
                      <col className="summary-col-label" />
                      <col className="summary-col-count" />
                      <col className="summary-col-volume" />
                      <col className="summary-col-volume" />
                      <col className="summary-col-volume" />
                      <col className="summary-col-rate" />
                      <col className="summary-col-rate" />
                      <col className="summary-col-rate" />
                      <col className="summary-col-rate" />
                      <col className="summary-col-rate" />
                      <col className="summary-col-rate" />
                    </colgroup>
                    <tbody>
                      {["TRADE", "CORP", "OUTROS"].map((group) => {
                        const groupTotal = summaryGroups.find((item) => item.label === group);
                        const groupSegments = summarySegments.filter((item) => item.group === group);
                        if (!groupTotal || groupSegments.length === 0) return null;
                        return (
                          <Fragment key={`${group}-section`}>
                            <tr className="summary-group-row" key={`${group}-header`}>
                              <td>
                                <span style={{ background: GROUP_COLORS[group] }} />
                                {GROUP_LABELS[group] || group}
                                <small>{groupSegments.length} canais</small>
                              </td>
                              <td>Comunicados</td>
                              <td>Emails enviados</td>
                              <td>Emails recebidos</td>
                              <td>Aberturas únicas</td>
                              <td>Taxa de abertura</td>
                              <td>CTR</td>
                              <td>CTR qual.</td>
                              <td>CTOR</td>
                              <td>OPT-OUT</td>
                              <td>Bounce</td>
                            </tr>
                            {groupSegments.map((item) => (
                              <tr key={`${group}-${item.label}`}>
                                <td><i style={{ background: segmentColor(item.label) }} />{item.label}</td>
                                <td>{formatInt(item.communications)}</td>
                                <td>{formatInt(item.sent)}</td>
                                <td>{formatInt(item.delivered)}</td>
                                <td>{formatInt(item.opens)}</td>
                                <td>{formatPercent(item.openRate)}</td>
                                <td>{formatPercent(item.ctr)}</td>
                                <td>{formatPercent(item.qualifiedCtr)}</td>
                                <td>{formatPercent(item.ctor)}</td>
                                <td>{formatPercent(item.optout)}</td>
                                <td>{formatPercent(item.bounce)}</td>
                              </tr>
                            ))}
                            <tr className="summary-subtotal-row" key={`${group}-subtotal`}>
                              <td>Total {GROUP_LABELS[group] || group}</td>
                              <td>{formatInt(groupTotal.communications)}</td>
                              <td>{formatInt(groupTotal.sent)}</td>
                              <td>{formatInt(groupTotal.delivered)}</td>
                              <td>{formatInt(groupTotal.opens)}</td>
                              <td>{formatPercent(groupTotal.openRate)}</td>
                              <td>{formatPercent(groupTotal.ctr)}</td>
                              <td>{formatPercent(groupTotal.qualifiedCtr)}</td>
                              <td>{formatPercent(groupTotal.ctor)}</td>
                              <td>{formatPercent(groupTotal.optout)}</td>
                              <td>{formatPercent(groupTotal.bounce)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            <article className="panel summary-chart-panel" id="summary-chart-export">
              <div className="panel-head">
                <SectionTitle
                  title="Emails enviados por canal"
                  subtitle={`Volume oficial apresentado em ${formatMonth(summaryMonth)}`}
                />
                <div className="panel-actions">
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `resumo-canais-${summaryMonth}.csv`,
                        ["Mês", "Categoria", "Canal", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTR qualificado", "CTOR", "Opt-out", "Bounce"],
                        summarySegmentCsvRows,
                      )
                    }
                    imageTargetId="summary-chart-export"
                    imageName={`envios-canal-${summaryMonth}.png`}
                  />
                  <BarChart3 aria-hidden="true" />
                </div>
              </div>
              <SummaryBarChart data={summarySegments} />
            </article>
          </div>
        )}

        {tab === "semester" && (
          <div className="semester-view">
            <section className="panel period-filter-panel" aria-label="Filtros da análise por período">
              <div className="panel-head"><SectionTitle title="Escolha o período" subtitle="Os cards, a comparação e o resumo respondem ao mesmo filtro" /></div>
              <div className="executive-filters">
                <label className="select-control"><span>Tipo de período</span><select value={executivePeriod} onChange={(event) => setExecutivePeriod(event.target.value as typeof executivePeriod)}><option value="month">Mês</option><option value="quarter">Trimestre</option><option value="semester">Semestre</option><option value="custom">Data personalizada</option></select></label>
                {executivePeriod === "month" && <label className="select-control"><span>Mês</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}</select></label>}
                {executivePeriod === "quarter" && <label className="select-control"><span>Trimestre</span><select value={executiveQuarter} onChange={(event) => setExecutiveQuarter(event.target.value)}>{executiveQuarterOptions.map((key) => <option key={key} value={key}>{key.slice(6)}º trimestre/{key.slice(0, 4)}</option>)}</select></label>}
                {executivePeriod === "semester" && <label className="select-control"><span>Semestre</span><select value={executiveSemester} onChange={(event) => setExecutiveSemester(event.target.value)}>{executiveSemesterOptions.map((key) => <option key={key} value={key}>{key.slice(6)}º semestre/{key.slice(0, 4)}</option>)}</select></label>}
                {executivePeriod === "custom" && <><label className="select-control"><span>De</span><input type="date" value={executiveStartDate} min={months[0] ? `${months[0]}-01` : undefined} max={executiveLatestDate} onChange={(event) => setExecutiveStartDate(event.target.value)} /></label><label className="select-control"><span>Até</span><input type="date" value={executiveEndDate} min={months[0] ? `${months[0]}-01` : undefined} max={executiveLatestDate} onChange={(event) => setExecutiveEndDate(event.target.value)} /></label></>}
              </div>
              {executiveExpectedMonths > 0 && executiveMonthsWithData.length < executiveExpectedMonths && <p className="executive-note">Período parcial: {executiveMonthsWithData.length} de {executiveExpectedMonths} meses com dados.</p>}
            </section>
            {!executivePeriodBounds || executiveDispatches.length === 0 ? (
              <p className="executive-empty">{!executivePeriodBounds ? "Selecione um intervalo válido: a data inicial não pode ser posterior à final." : "Não há disparos no período selecionado."}</p>
            ) : (
            <section className="semester-slide" id="semester-slide-export">
              <div className="semester-hero">
                <div>
                  <span className="summary-kicker">BIG NUMBERS · {executivePeriodLabel.toLocaleUpperCase("pt-BR")}</span>
                  <h2>Consolidado oficial de Email Marketing</h2>
                  <p>Período considerado: {executivePeriodLabel}. Leitura consolidada sem LATAMERS.</p>
                </div>
                <div className="semester-hero-actions">
                  <ExportActions imageTargetId="semester-slide-export" imageName={`consolidado-${executivePeriod}-${executivePeriodBounds.start}.png`} />
                  <div className="semester-total">
                    <span>Total de envios</span>
                    <strong>{formatInt(semesterTotal.sent)}</strong>
                    <small>{formatInt(semesterTotal.communications)} comunicados no período</small>
                  </div>
                </div>
              </div>

              <div className="period-month-legend" aria-label="Meses considerados no cálculo">
                <strong>Meses considerados</strong>
                <div>{executiveMonthsWithData.map((month) => <span key={month}>{formatMonth(month)}</span>)}</div>
                {executivePeriod === "custom" && <small>Somente os disparos dentro das datas selecionadas entram no cálculo.</small>}
              </div>

              <section className="semester-kpi-grid">
                {semesterMainKpis.map(({ label, value, icon: Icon, tone }) => (
                  <article className="semester-kpi" key={label}>
                    <span className={`kpi-icon icon-${tone}`}><Icon aria-hidden="true" /></span>
                    <div>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  </article>
                ))}
              </section>

              <section className="semester-main-grid">
                <article className="semester-table-card" id="semester-table-export">
                  <div className="panel-head">
                    <SectionTitle title="Agências e Empresas" subtitle="Setas comparadas ao total geral do período, não a uma meta externa" />
                    <ExportActions
                      onCsv={() => exportCsv(
                        `consolidado-${executivePeriod}-${executivePeriodBounds.start}.csv`,
                        ["KPI", "Agências", "Empresas", "Total geral"],
                        semesterCsvRows,
                      )}
                      imageTargetId="semester-table-export"
                      imageName={`tabela-consolidado-${executivePeriod}-${executivePeriodBounds.start}.png`}
                    />
                  </div>
                  <p className="period-export-months">Meses considerados: {executiveMonthLabels.join(", ")}{executivePeriod === "custom" ? ` · ${executivePeriodLabel}` : ""}</p>
                  <table className="semester-table">
                    <thead>
                      <tr>
                        <th>KPI</th>
                        <th>Agências <span>Categoria</span></th>
                        <th>Empresas <span>Categoria</span></th>
                        <th>Total geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semesterTableMetrics.map((metric) => (
                        <tr key={metric.label}>
                          <td>{metric.label}</td>
                          {semesterRowsByAudience.map((audience) => {
                            const value = audience.data[metric.key];
                            const benchmark = semesterTotal[metric.key];
                            const signal = metric.type === "rate"
                              ? rateSignal(Number(value), Number(benchmark), metric.inverse)
                              : "neutral";
                            return (
                              <td key={audience.label}>
                                <span className={`semester-value ${signal}`}>
                                  {metric.type === "rate" ? formatPercent(Number(value)) : formatInt(Number(value))}
                                  {metric.type === "rate" && <i>{signal === "positive" ? "↑" : signal === "negative" ? "↓" : "→"}</i>}
                                </span>
                              </td>
                            );
                          })}
                          <td>{metric.type === "rate" ? formatPercent(Number(semesterTotal[metric.key])) : formatInt(Number(semesterTotal[metric.key]))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>

                <aside className="semester-side">
                  <article id="semester-share-export">
                    <div className="side-title-row">
                      <span>Participação em envios</span>
                      <ExportActions imageTargetId="semester-share-export" imageName={`participacao-envios-${executivePeriod}-${executivePeriodBounds.start}.png`} />
                    </div>
                    {semesterRowsByAudience.map((audience) => (
                      <div className="semester-share" key={audience.label}>
                        <div>
                          <strong>{audience.label}</strong>
                          <small>{formatPercent(audience.data.sent / Math.max(semesterTotal.sent, 1), 1)}</small>
                        </div>
                        <i><b style={{ width: `${(audience.data.sent / Math.max(semesterTotal.sent, 1)) * 100}%` }} /></i>
                      </div>
                    ))}
                    {semesterOthers.sent > 0 && (
                      <div className="semester-share muted-share">
                        <div>
                          <strong>Outros</strong>
                          <small>{formatPercent(semesterOthers.sent / Math.max(semesterTotal.sent, 1), 1)}</small>
                        </div>
                        <i><b style={{ width: `${(semesterOthers.sent / Math.max(semesterTotal.sent, 1)) * 100}%` }} /></i>
                      </div>
                    )}
                  </article>
                  <article>
                    <span>Resumo executivo</span>
                    <p>O período selecionado concentra {formatInt(semesterTotal.sent)} envios, {formatInt(semesterTotal.delivered)} recebidos e {formatInt(semesterTotal.clicks)} cliques únicos.</p>
                    <p>Open Rate de {formatPercent(semesterTotal.openRate)}, CTR total de {formatPercent(semesterTotal.ctr)}, CTR qualificado de {formatPercent(semesterTotal.qualifiedCtr)} e CTOR de {formatPercent(semesterTotal.ctor)}, calculados diretamente sobre os volumes oficiais.</p>
                  </article>
                </aside>
              </section>

              <article className="semester-comparison-card" id="semester-comparison-export">
                <div className="panel-head executive-head">
                  <SectionTitle title="Agências x Empresas · visão direta" subtitle="Abertura, cliques e rejeição no período selecionado" />
                  <ExportActions imageTargetId="semester-comparison-export" imageName={`agencias-empresas-${executivePeriod}-${executivePeriodBounds.start}.png`} />
                </div>
                <p className="period-export-months">Meses considerados: {executiveMonthLabels.join(", ")}{executivePeriod === "custom" ? ` · ${executivePeriodLabel}` : ""}</p>
                <div className="semester-comparison-grid">
                  <div className="executive-table-wrap">
                    <table className="executive-table">
                      <thead><tr>
                        <th scope="col">Indicador</th>
                        <th scope="col"><span>Agências</span><small>{formatInt(executiveAgencies.communications)} disparos</small></th>
                        <th scope="col"><span>Empresas</span><small>{formatInt(executiveCompanies.communications)} disparos</small></th>
                        <th scope="col"><span>Agências + Empresas</span><small>{formatInt(executiveCombined.communications)} disparos</small></th>
                      </tr></thead>
                      <tbody>{executiveMetrics.map((metric) => <tr key={metric.key}>
                        <th scope="row">{metric.label}</th>
                        <td>{metric.format(executiveAgencies[metric.key])}</td>
                        <td>{metric.format(executiveCompanies[metric.key])}</td>
                        <td>{metric.format(executiveCombined[metric.key])}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <div className="executive-compare-chart" aria-label="Comparativo gráfico das taxas entre Agências e Empresas">
                    <div className="executive-chart-heading">
                      <strong>Comparação das taxas</strong>
                      <div><span><i className="executive-dot-agencies" />Agências</span><span><i className="executive-dot-companies" />Empresas</span></div>
                    </div>
                    {executiveChartMetrics.map((metric) => {
                      const maxValue = Math.max(executiveAgencies[metric.key], executiveCompanies[metric.key]);
                      return <div className="executive-chart-metric" key={metric.key}>
                        <div className="executive-chart-metric-title"><strong>{metric.label}</strong>{"lowerIsBetter" in metric && <small>menor é melhor</small>}</div>
                        {[
                          { label: "Agências", value: executiveAgencies[metric.key], tone: "agencies" },
                          { label: "Empresas", value: executiveCompanies[metric.key], tone: "companies" },
                        ].map((item) => <div className="executive-chart-row" key={item.label}>
                          <span>{item.label}</span>
                          <div className="executive-chart-track"><i className={`executive-chart-bar ${item.tone}`} style={{ width: `${maxValue ? item.value / maxValue * 100 : 0}%` }} /></div>
                          <strong>{formatPercent(item.value)}</strong>
                        </div>)}
                      </div>;
                    })}
                    <small className="executive-chart-note">Escala independente para cada indicador; compare as categorias dentro da mesma taxa.</small>
                  </div>
                </div>
                <p className="executive-note">Nesta visão, o total soma Agências e Empresas. Na tabela detalhada acima, “Total geral” também inclui Outros. As taxas são calculadas pelos volumes do período.</p>
              </article>
            </section>
            )}
          </div>
        )}

        {tab === "comparison" && (
          <div className="comparison-view">
            <section className="comparison-filterbar" aria-label="Seleção dos períodos">
              <div className="comparison-filter-fields">
                <label>
                  <span>Mês anterior</span>
                  <select value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Dois meses atrás</span>
                  <select value={previousMonth} onChange={(event) => setPreviousMonth(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <select value={comparisonSegment} onChange={(event) => setComparisonSegment(event.target.value)}>
                    <option value="ALL">Todas as canais</option>
                    {comparisonClassificationOptions.map((label) => <option value={label} key={label}>{label}</option>)}
                  </select>
                </label>
              </div>
              <div className="compare-legend">
                <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
                <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
              </div>
              <ExportActions
                onCsv={() =>
                  exportCsv(
                    `comparativo-kpis-${previousMonth}-${currentMonth}.csv`,
                    ["KPI", formatMonth(currentMonth), formatMonth(previousMonth), "Variação"],
                    comparisonKpiCsvRows,
                  )
                }
              />
            </section>

            <section className="comparison-kpis">
              {[
                { label: "Comunicações", a: compareCurrent.communications, b: comparePrevious.communications, isRate: false, icon: Layers3 },
                { label: "Emails enviados", a: compareCurrent.sent, b: comparePrevious.sent, isRate: false, icon: Send },
                { label: "Emails recebidos", a: compareCurrent.delivered, b: comparePrevious.delivered, isRate: false, icon: MailCheck },
                { label: "Taxa de abertura", a: compareCurrent.openRate, b: comparePrevious.openRate, isRate: true, icon: Eye },
                { label: "Cliques únicos", a: compareCurrent.clicks, b: comparePrevious.clicks, isRate: false, icon: MousePointerClick },
                { label: "CTR único", a: compareCurrent.ctr, b: comparePrevious.ctr, isRate: true, icon: MoveUpRight },
                { label: "CTR qualificado", a: compareCurrent.qualifiedCtr, b: comparePrevious.qualifiedCtr, isRate: true, icon: MousePointerClick },
                { label: "CTOR", a: compareCurrent.ctor, b: comparePrevious.ctor, isRate: true, icon: Target },
                { label: "Bounce rate", a: compareCurrent.bounce, b: comparePrevious.bounce, isRate: true, icon: ShieldCheck },
              ].map(({ label, a, b, isRate, icon: Icon }) => (
                <article className="comparison-kpi" key={label}>
                  <div className="comparison-kpi-head">
                    <span className="comparison-kpi-icon"><Icon aria-hidden="true" /></span>
                    <span>{label}</span>
                  </div>
                  <div className="compare-values">
                    <div><small><i className="dot-current" />{formatMonth(currentMonth, true)}</small><strong>{isRate ? formatPercent(a) : formatInt(a)}</strong></div>
                    <div><small><i className="dot-previous" />{formatMonth(previousMonth, true)}</small><em>{isRate ? formatPercent(b) : formatInt(b)}</em></div>
                  </div>
                  <small className={`comparison-variation ${trendClass(a, b, label === "Bounce rate")}`}>
                    {variationLabel(a, b, isRate ? "pp" : "percent")}
                  </small>
                </article>
              ))}
            </section>

            <article className="panel volume-panel" id="comparison-volume-export">
              <div className="panel-head">
                <SectionTitle title="Volume mensal comparado" subtitle="Enviados, recebidos, aberturas e cliques únicos" />
                <div className="panel-actions">
                  <div className="compare-legend">
                    <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
                    <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
                  </div>
                  <ExportActions imageTargetId="comparison-volume-export" imageName={`volume-comparado-${previousMonth}-${currentMonth}.png`} />
                </div>
              </div>
              <div className="volume-bars">
                {[
                  ["Enviados", compareCurrent.sent, comparePrevious.sent],
                  ["Recebidos", compareCurrent.delivered, comparePrevious.delivered],
                  ["Aberturas", compareCurrent.opens, comparePrevious.opens],
                  ["Cliques únicos", compareCurrent.clicks, comparePrevious.clicks],
                ].map(([label, a, b]) => {
                  const max = Math.max(Number(a), Number(b), 1);
                  return (
                    <div className="volume-set" key={String(label)}>
                      <span>{label}</span>
                      <div className="volume-track"><i className="current" style={{ width: `${(Number(a) / max) * 100}%` }} /><b>{formatInt(Number(a))}</b></div>
                      <div className="volume-track"><i className="previous" style={{ width: `${(Number(b) / max) * 100}%` }} /><b>{formatInt(Number(b))}</b></div>
                    </div>
                  );
                })}
              </div>
            </article>

            <section className="two-panel-grid">
              <HorizontalCompare title="Taxa de abertura por categoria" subtitle="Aberturas únicas sobre emails recebidos" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="openRate" exportId="comparison-open-group-export" imageName={`abertura-grupo-${previousMonth}-${currentMonth}.png`} />
              <HorizontalCompare title="CTOR por categoria" subtitle="Cliques únicos sobre aberturas únicas" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="ctor" exportId="comparison-ctor-group-export" imageName={`ctor-grupo-${previousMonth}-${currentMonth}.png`} />
            </section>
            <VerticalCompare title="CTR por canal" subtitle="Agrupado por categoria · cliques únicos sobre emails enviados" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="ctr" currentMonth={currentMonth} previousMonth={previousMonth} exportId="comparison-ctr-segment-export" imageName={`ctr-canal-${previousMonth}-${currentMonth}.png`} />
            <VerticalCompare title="Taxa de abertura por canal" subtitle="Agrupado por categoria · aberturas únicas sobre emails recebidos" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="openRate" currentMonth={currentMonth} previousMonth={previousMonth} exportId="comparison-open-segment-export" imageName={`abertura-canal-${previousMonth}-${currentMonth}.png`} />
          </div>
        )}

        {tab === "highlights" && (
          <div className="highlights-view" id="campaign-highlights-export">
            <section className="highlight-filterbar">
              <div className="comparison-filter-fields">
                <label>
                  <span>Mês de referência</span>
                  <select value={highlightMonth} onChange={(event) => setHighlightMonth(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Ordenar por KPI</span>
                  <select value={highlightMetric} onChange={(event) => setHighlightMetric(event.target.value as HighlightMetric)}>
                    {Object.entries(HIGHLIGHT_METRICS).map(([key, value]) => (
                      <option value={key} key={key}>{value.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Volume mínimo</span>
                  <select value={highlightMinSent} onChange={(event) => setHighlightMinSent(Number(event.target.value))}>
                    <option value={0}>Sem mínimo</option>
                    <option value={10}>10 enviados</option>
                    <option value={25}>25 enviados</option>
                    <option value={50}>50 enviados</option>
                    <option value={100}>100 enviados</option>
                    <option value={500}>500 enviados</option>
                    <option value={1000}>1.000 enviados</option>
                  </select>
                </label>
                <SubcategoryMultiSelect
                  options={highlightClassificationCatalog}
                  selected={highlightSubcategories}
                  onChange={setHighlightSubcategories}
                />
              </div>
              <ExportActions
                onCsv={() =>
                  exportCsv(
                    `disparos-destaque-${highlightMetric}-${highlightMonth}.csv`,
                    ["Mês", "Campanha", "Assunto", "Categoria", "Canal", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "Possui CTA", "Enviados com CTA", "Cliques com CTA", "CTR qualificado", "CTOR", "Bounce", "Opt-out"],
                    highlightCsvRows,
                  )
                }
                imageTargetId="campaign-highlights-export"
                imageName={`disparos-destaque-${highlightMetric}-${highlightMonth}.png`}
              />
            </section>

            <section className="highlight-hero panel">
              <div>
                <span className="summary-kicker">RANKING POR DISPARO</span>
                <h2>{highlightConfig.label} · {formatMonth(highlightMonth)}</h2>
                <p>{highlightConfig.description}. Filtro mínimo evita distorções por disparos pequenos; LATAMERS não entra na contagem.</p>
              </div>
              <div className="highlight-volume-note">
                <strong>{formatInt(highlightMonthRows.length)}</strong>
                <span>disparos analisados</span>
                <small>mínimo: {formatInt(highlightMinSent)} enviados</small>
                <small>base do KPI: {formatPercent(highlightBenchmarkValue)}</small>
              </div>
            </section>

            {highlightMonthRows.length === 0 ? (
              <section className="panel empty-highlight">
                <Trophy aria-hidden="true" />
                <h3>Nenhum disparo elegível para o filtro atual</h3>
                <p>Selecione outro mês para visualizar o Top 3.</p>
              </section>
            ) : (
              <>
                <section className="highlight-rank-grid">
                  {[
                    { title: highlightConfig.inverse ? "Melhores · menor taxa" : "Melhores · maior taxa", tone: "best", items: bestHighlights },
                    { title: highlightConfig.inverse ? "Piores · maior taxa" : "Piores · menor taxa", tone: "worst", items: worstHighlights },
                  ].map((board) => (
                    <article className={`highlight-board ${board.tone}`} key={board.title}>
                      <div className="highlight-board-head">
                        <span>{board.tone === "best" ? "TOP 3" : "BOTTOM 3"}</span>
                        <h3>{board.title}</h3>
                      </div>
                      <div className="highlight-list">
                        {board.items.map((item, index) => {
                          return (
                          <div className="highlight-item" key={`${board.tone}-${item.month_key}-${item.campaign_name}-${item.subject}-${index}`}>
                            <div className="rank-badge">{index + 1}</div>
                            <div className="highlight-main">
                              <strong>{item.campaign_name}</strong>
                              <p>{item.subject}</p>
                              <div className="highlight-tags">
                                <span>{campaignGroupListLabel(item)}</span>
                                <span>{segmentListLabel(item.operational_segments)}</span>
                              </div>
                              <div className="highlight-meta">
                                <span>{formatInt(num(item.emails_sent))} enviados</span>
                                <span>{formatInt(num(item.emails_delivered))} recebidos</span>
                                <span>{formatInt(num(item.unique_opens))} aberturas</span>
                                <span>{formatInt(num(item.unique_clicks))} cliques</span>
                                <span className={item.has_cta ? "cta-active" : "cta-inactive"}>
                                  {item.has_cta ? "Com CTA" : "Sem CTA"}
                                </span>
                              </div>
                            </div>
                            <div className="highlight-rate">
                              <small>{highlightConfig.label}</small>
                              <strong>{formatPercent(num(item[highlightMetric]))}</strong>
                              <span className={trendClass(num(item[highlightMetric]), highlightBenchmarkValue, Boolean(highlightConfig.inverse))}>
                                {variationLabel(num(item[highlightMetric]), highlightBenchmarkValue)} vs. base
                              </span>
                            </div>
                            <div className="highlight-metric-strip">
                              <span>OR <strong>{formatPercent(num(item.open_rate))}</strong></span>
                              <span>CTR <strong>{formatPercent(num(item.ctr))}</strong></span>
                              <span>CTR qual. <strong>{item.has_cta ? formatPercent(num(item.qualified_ctr)) : "—"}</strong></span>
                              <span>CTOR <strong>{formatPercent(num(item.ctor))}</strong></span>
                              <span>Bounce <strong>{formatPercent(num(item.bounce_rate))}</strong></span>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </section>

                <article className="panel highlight-table-panel" id="highlight-table-export">
                  <div className="panel-head">
                    <SectionTitle
                      title="Disparos listados no ranking"
                      subtitle="Somente Top 3 melhores e Top 3 piores exibidos acima"
                    />
                    <ExportActions
                      onCsv={() =>
                        exportCsv(
                          `top-bottom-disparos-${highlightMetric}-${highlightMonth}.csv`,
                          ["Mês", "Campanha", "Assunto", "Categoria", "Canal", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "Possui CTA", "Enviados com CTA", "Cliques com CTA", "CTR qualificado", "CTOR", "Bounce", "Opt-out"],
                          highlightCsvRows,
                        )
                      }
                      imageTargetId="highlight-table-export"
                      imageName={`top-bottom-disparos-${highlightMetric}-${highlightMonth}.png`}
                    />
                  </div>
                  <div className="table-scroll">
                    <table className="highlight-ranking-table">
                      <colgroup>
                        <col className="col-campaign" />
                        <col className="col-subcategory" />
                        <col className="col-volume" />
                        <col className="col-rate" />
                        <col className="col-ctr" />
                        <col className="col-rate" />
                        <col className="col-rate" />
                        <col className="col-rate" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Campanha</th>
                          <th>Canal</th>
                          <th>Enviados</th>
                           <th>Open Rate</th>
                           <th>CTR total / qual.</th>
                           <th>CTOR</th>
                          <th>Bounce</th>
                          <th>Opt-out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedHighlights.map((item, index) => (
                          <tr key={`highlight-row-${item.campaign_name}-${item.subject}-${index}`}>
                            <td><strong>{item.campaign_name}</strong><small>{item.subject}</small></td>
                            <td><span className="table-subcategory-pill">{segmentListLabel(item.operational_segments)}</span></td>
                            <td>{formatInt(num(item.emails_sent))}</td>
                            <td>{formatPercent(num(item.open_rate))}</td>
                            <td>
                              <strong>{formatPercent(num(item.ctr))}</strong>
                              <small>{item.has_cta ? `${formatPercent(num(item.qualified_ctr))} qualificado` : "Sem CTA"}</small>
                            </td>
                            <td>{formatPercent(num(item.ctor))}</td>
                            <td>{formatPercent(num(item.bounce_rate))}</td>
                            <td>{formatPercent(num(item.optout_rate))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </>
            )}
          </div>
        )}

        {tab === "campaigns" && (
          <div className="campaigns-view" id="campaign-analysis-export">
            <section className="campaign-filterbar">
              <div className="campaign-filter-heading">
                <Filter aria-hidden="true" />
                <div>
                  <strong>Filtros de exploração</strong>
                  <span>O resumo e a tabela respondem ao recorte selecionado.</span>
                </div>
              </div>
              <div className="campaign-filter-grid">
                <label>
                  <span>Mês</span>
                  <select value={campaignMonth} onChange={(event) => { setCampaignMonth(event.target.value); setCampaignGroup("ALL"); setCampaignClassification("ALL"); }}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Categoria</span>
                  <select value={campaignGroup} onChange={(event) => setCampaignGroup(event.target.value)}>
                    <option value="">Selecione</option>
                    <option value="ALL">Todas as categorias</option>
                    {campaignGroups.map((group) => <option value={group} key={group}>{GROUP_LABELS[group] || group}</option>)}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <select value={campaignClassification} onChange={(event) => setCampaignClassification(event.target.value)}>
                    <option value="">Selecione</option>
                    <option value="ALL">Todas as canais</option>
                    {campaignClassificationOptions.map((classification) => (
                      <option value={classification} key={classification}>{classification}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Volume mínimo</span>
                  <select value={campaignMinSent} onChange={(event) => setCampaignMinSent(Number(event.target.value))}>
                    {[0, 10, 25, 50, 100, 500, 1000].map((value) => (
                      <option value={value} key={value}>{value === 0 ? "Sem mínimo" : `${formatInt(value)} enviados`}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Ordenar por</span>
                  <select value={campaignSort} onChange={(event) => setCampaignSort(event.target.value as CampaignSort)}>
                    <option value="emails_sent">Volume enviado</option>
                     <option value="open_rate">Taxa de abertura</option>
                     <option value="ctr">CTR</option>
                     <option value="qualified_ctr">CTR qualificado</option>
                     <option value="ctor">CTOR</option>
                    <option value="bounce_rate">Bounce</option>
                    <option value="optout_rate">Opt-out</option>
                  </select>
                </label>
                <label>
                  <span>Ordem</span>
                  <select value={campaignSortDirection} onChange={(event) => setCampaignSortDirection(event.target.value as "desc" | "asc")}>
                    <option value="desc">Maior para menor</option>
                    <option value="asc">Menor para maior</option>
                  </select>
                </label>
                <label className="campaign-search">
                  <span>Buscar campanha ou assunto</span>
                  <input
                    value={campaignSearch}
                    onChange={(event) => setCampaignSearch(event.target.value)}
                    placeholder="Digite parte do nome ou assunto"
                  />
                </label>
              </div>
            </section>

            <section className="campaign-summary-grid">
              {[
                ["Disparos", formatInt(campaignRows.length), MailSearch],
                ["Enviados", formatInt(campaignTotals.sent), Send],
                ["Recebidos", formatInt(campaignTotals.delivered), MailCheck],
                ["Aberturas únicas", formatInt(campaignTotals.opens), MailOpen],
                ["Cliques únicos", formatInt(campaignTotals.clicks), MousePointerClick],
                 ["Open Rate", formatPercent(campaignTotals.openRate), Eye],
                 ["CTR", formatPercent(campaignTotals.ctr), MoveUpRight],
                 ["CTR qualificado", formatPercent(campaignTotals.qualifiedCtr), MousePointerClick],
                 ["CTOR", formatPercent(campaignTotals.ctor), Target],
                ["Bounce", formatPercent(campaignTotals.bounce), ShieldCheck],
                ["Opt-out", formatPercent(campaignTotals.optout), Percent],
              ].map(([label, value, Icon], index) => {
                const CampaignIcon = Icon as LucideIcon;
                return (
                  <article className="campaign-summary-card" key={String(label)}>
                    <span className={`campaign-summary-icon tone-${index}`}><CampaignIcon aria-hidden="true" /></span>
                    <div><small>{String(label)}</small><strong>{String(value)}</strong></div>
                  </article>
                );
              })}
            </section>

            <article className="panel campaign-ledger" id="campaign-ledger-export">
              <div className="panel-head">
                <SectionTitle
                  title={`${formatInt(campaignRows.length)} disparos no recorte`}
                  subtitle="Taxas recalculadas sobre os volumes exibidos; LATAMERS permanece excluído."
                />
                <ExportActions
                  onCsv={() =>
                    exportCsv(
                      `disparos-${campaignMonth}.csv`,
                      ["Mês", "Campanha", "Assunto", "Data de envio", "Categoria", "Canal", "Categoria original", "CTA original", "Link", "Enviados", "Recebidos", "Aberturas", "Cliques", "Bounces", "Opt-outs", "Open Rate", "CTR", "Possui CTA", "CTR qualificado", "CTOR", "Bounce", "Opt-out"],
                      campaignCsvRows,
                    )
                  }
                  imageTargetId="campaign-ledger-export"
                  imageName={`disparos-${campaignMonth}.png`}
                />
              </div>
              {campaignRows.length === 0 ? (
                <div className="campaign-empty">
                  <MailSearch aria-hidden="true" />
                  <strong>{campaignNeedsFilter ? "Selecione uma Categoria ou Canal" : "Nenhum disparo encontrado"}</strong>
                  <span>{campaignNeedsFilter ? "A tabela granular fica vazia por padrão para evitar uma visão gigante sem recorte analítico." : "Revise os filtros para ampliar o recorte."}</span>
                </div>
              ) : (
                <table className="campaign-table">
                  <thead>
                    <tr>
                      <th>Disparo</th>
                      <th>Público</th>
                      <th>Volume</th>
                      <th>Engajamento</th>
                      <th>Open Rate</th>
                       <th>CTR total / qual.</th>
                      <th>CTOR</th>
                      <th>Rejeição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignRows.map((item, index) => (
                      <tr key={`${item.month_key}-${item.campaign_name}-${item.subject}-${index}`}>
                        <td>
                          <strong>{item.campaign_name}</strong>
                          <small>{item.subject}</small>
                          <small>{formatSendDate(item.send_at)} · {item.has_cta ? "Com CTA" : "Sem CTA"}</small>
                        </td>
                        <td>
                          <span className="campaign-pill">{segmentListLabel(item.operational_segments)}</span>
                          <small>{campaignGroupListLabel(item)}</small>
                        </td>
                        <td><strong>{formatInt(num(item.emails_sent))}</strong><small>{formatInt(num(item.emails_delivered))} recebidos</small></td>
                        <td><strong>{formatInt(num(item.unique_opens))}</strong><small>{formatInt(num(item.unique_clicks))} cliques</small></td>
                        <td><strong>{formatPercent(num(item.open_rate))}</strong></td>
                        <td>
                          <strong>{formatPercent(num(item.ctr))}</strong>
                          <small>{item.has_cta ? `${formatPercent(num(item.qualified_ctr))} qual.` : "Não aplicável"}</small>
                        </td>
                        <td><strong>{formatPercent(num(item.ctor))}</strong></td>
                        <td>
                          <strong>{formatPercent(num(item.bounce_rate))} bounce</strong>
                          <small>{formatPercent(num(item.optout_rate))} opt-out</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          </div>
        )}

        {canManageCreative && tab === "creative" && (
          <div className="creative-view">
            <section className="panel creative-control-panel">
              <div className="panel-head">
                <SectionTitle
                  title="Peça de email vinculada ao disparo"
                  subtitle="Cole o HTML oficial da campanha, valide o preview e salve a peça no disparo correto."
                />
                <span className="validated-badge"><i />Preview isolado por segurança</span>
              </div>
              <div className="creative-form-grid">
                <label>
                  <span>Mês</span>
                  <select value={creativeMonth} onChange={(event) => setCreativeMonth(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label className="creative-dispatch-select">
                  <span>Disparo</span>
                  <select value={creativeDispatchId} onChange={(event) => setCreativeDispatchId(event.target.value)}>
                    {creativeCampaignOptions.map((item) => (
                      <option value={item.dispatch_id} key={item.dispatch_id}>
                        {item.campaign_name} · {segmentListLabel(item.operational_segments)} · {formatInt(num(item.emails_sent))} enviados
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {creativeSelectedCampaign ? (
                <div className="creative-selected-card">
                  <div>
                    <strong>{creativeSelectedCampaign.campaign_name}</strong>
                    <span>{creativeSelectedCampaign.subject || "Assunto não informado"}</span>
                    <small>{formatSendDate(creativeSelectedCampaign.send_at)} · {campaignGroupListLabel(creativeSelectedCampaign)} · {segmentListLabel(creativeSelectedCampaign.operational_segments)}</small>
                  </div>
                  <div className="creative-kpi-strip">
                    <span><small>Open Rate</small><strong>{formatPercent(num(creativeSelectedCampaign.open_rate))}</strong></span>
                    <span><small>CTR</small><strong>{formatPercent(num(creativeSelectedCampaign.ctr))}</strong></span>
                    <span><small>CTR qual.</small><strong>{creativeSelectedCampaign.has_cta ? formatPercent(num(creativeSelectedCampaign.qualified_ctr)) : "—"}</strong></span>
                    <span><small>CTOR</small><strong>{formatPercent(num(creativeSelectedCampaign.ctor))}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="campaign-empty">
                  <MailSearch aria-hidden="true" />
                  <strong>Nenhum disparo encontrado</strong>
                  <span>Selecione outro mês ou carregue os dados granulares antes de vincular uma peça.</span>
                </div>
              )}
            </section>

            <section className="creative-workspace">
              <article className="panel creative-editor-panel">
                <div className="panel-head">
                  <SectionTitle title="HTML da peça" subtitle="Cole aqui o HTML oficial exportado da ferramenta de envio." />
                  <button type="button" className="load-primary-action compact-action" onClick={saveCreative} disabled={!creativeSelectedCampaign || !creativeHtml.trim()}>
                    <UploadCloud aria-hidden="true" />
                    Salvar peça
                  </button>
                </div>
                <textarea
                  className="creative-html-input"
                  value={creativeHtml}
                  onChange={(event) => {
                    setCreativeHtml(event.target.value);
                    setCreativeError("");
                    setCreativeStatus("");
                  }}
                  placeholder="<html>...cole aqui a peça de email...</html>"
                />
                <div className="creative-status-line">
                  <span>{creativeHtml.trim() ? `${formatInt(creativeHtml.length)} caracteres · ${formatInt(creativeAnalysis.wordCount)} palavras detectadas` : "Nenhum HTML colado ainda."}</span>
                  {creativeSavedAt && <strong>Salvo em {formatDateTime(creativeSavedAt)}</strong>}
                </div>
                {creativeStatus && <div className="load-message success"><CheckCircle2 aria-hidden="true" />{creativeStatus}</div>}
                {creativeError && <div className="load-message error"><AlertTriangle aria-hidden="true" />{creativeError}</div>}
              </article>

              <article className="panel creative-preview-panel">
                <div className="panel-head">
                  <SectionTitle title="Preview renderizado" subtitle="Visualização isolada; scripts da peça não são executados no dashboard." />
                  <ExportActions imageTargetId="creative-preview-export" imageName={`peca-email-${creativeSelectedCampaign?.dispatch_id || creativeMonth}.png`} />
                </div>
                <div className="creative-preview-frame" id="creative-preview-export">
                  {creativeHtml.trim() ? (
                    <iframe title="Preview da peça de email" sandbox="" srcDoc={creativeHtml} />
                  ) : (
                    <div className="creative-preview-empty">
                      <Code2 aria-hidden="true" />
                      <strong>Aguardando HTML</strong>
                      <span>Cole o HTML para montar a peça e liberar a leitura criativa.</span>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="creative-diagnosis-grid">
              <article className="panel creative-diagnosis-summary">
                <SectionTitle title="Extrato técnico da peça" subtitle="Leitura objetiva do HTML, sem inferência de KPI inventada." />
                <div className="creative-metrics-grid">
                  <div><span>Links</span><strong>{formatInt(creativeAnalysis.links)}</strong></div>
                  <div><span>Imagens</span><strong>{formatInt(creativeAnalysis.images)}</strong></div>
                  <div><span>Possíveis CTAs</span><strong>{formatInt(creativeAnalysis.ctas.length)}</strong></div>
                  <div><span>Texto</span><strong>{formatInt(creativeAnalysis.wordCount)}</strong></div>
                </div>
                <div className="creative-flags">
                  <span className={creativeAnalysis.hasAlt ? "good" : "warning"}>{creativeAnalysis.hasAlt ? "Imagem com alt detectado" : "Alt text não identificado"}</span>
                  <span className={creativeAnalysis.hasUnsubscribe ? "good" : "warning"}>{creativeAnalysis.hasUnsubscribe ? "Opt-out mencionado" : "Opt-out não detectado no HTML"}</span>
                  <span className={creativeAnalysis.hasExternalLink ? "good" : "warning"}>{creativeAnalysis.hasExternalLink ? "Links externos detectados" : "Sem link externo detectado"}</span>
                </div>
              </article>

              <article className="panel creative-insight-panel">
                <SectionTitle title="Diagnóstico criativo e recomendações" subtitle="Leitura acionável da peça cruzada com os KPIs oficiais do disparo." />
                <div className="creative-executive-summary">
                  <span>Resumo executivo</span>
                  <strong>{creativeAnalysis.executiveSummary.title}</strong>
                  <p>{creativeAnalysis.executiveSummary.text}</p>
                </div>
                <div className="creative-action-grid">
                  {creativeAnalysis.directActions.map((item) => (
                    <div className="creative-action-card" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
                <div className="creative-insight-list">
                  {creativeAnalysis.insights.map((item, index) => (
                    <div className={`creative-insight ${item.tone}`} key={item.title}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="creative-recommendation-grid">
                  {creativeAnalysis.recommendations.map((item) => (
                    <div className={`creative-recommendation ${item.tone}`} key={item.title}>
                      <small>{item.priority}</small>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
                <div className="creative-test-plan">
                  <strong>Próximos testes recomendados</strong>
                  <ul>
                    {creativeAnalysis.tests.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </article>
            </section>
          </div>
        )}

        {tab === "frequency" && (
          <div className="timing-view" id="timing-analysis-export">
            <section className="timing-toolbar panel">
              <div className="timing-filter-fields">
                <label>
                  <span>Mês</span>
                  <select value={frequencyMonth} onChange={(event) => { setFrequencyMonth(event.target.value); setTimingGroup("ALL"); setTimingSubcategory("ALL"); }}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Categoria</span>
                  <select value={timingGroup} onChange={(event) => { setTimingGroup(event.target.value); setTimingSubcategory("ALL"); }}>
                    <option value="ALL">Todas as categorias</option>
                    {timingGroups.map((group) => <option value={group} key={group}>{GROUP_LABELS[group] || group}</option>)}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <select value={timingSubcategory} onChange={(event) => setTimingSubcategory(event.target.value)}>
                    <option value="ALL">Todas as canais</option>
                    {timingSubcategoryOptions.map((item) => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className="timing-toolbar-actions">
                <span className={`timing-coverage ${timingCoverage === 1 ? "complete" : "warning"}`}>
                  {formatPercent(timingCoverage, 0)} com data e horário
                </span>
                <ExportActions imageTargetId="timing-analysis-export" imageName={`dias-horarios-${frequencyMonth}.png`} />
              </div>
            </section>

            <section className="timing-kpi-grid">
              {[
                ["Disparos analisados", formatInt(timingRows.length), CalendarRange],
                ["Emails enviados", formatInt(timingTotals.sent), Send],
                ["Dia com mais disparos", busiestDay?.items.length ? busiestDay.label : "Sem dados", BarChart3],
                ["Horário mais utilizado", busiestTime?.items.length ? busiestTime.label : "Sem dados", Clock3],
                ["Melhor abertura*", bestOpenTime ? `${bestOpenTime.label} · ${formatPercent(bestOpenTime.metrics.openRate)}` : "Sem amostra", Eye],
                ["Melhor CTR*", bestCtrTime ? `${bestCtrTime.label} · ${formatPercent(bestCtrTime.metrics.ctr)}` : "Sem amostra", MousePointerClick],
              ].map(([label, value, Icon], index) => {
                const TimingIcon = Icon as LucideIcon;
                return (
                  <article className="timing-kpi" key={String(label)}>
                    <span className={`campaign-summary-icon tone-${index}`}><TimingIcon aria-hidden="true" /></span>
                    <small>{String(label)}</small>
                    <strong>{String(value)}</strong>
                  </article>
                );
              })}
            </section>

            {timingRows.length === 0 ? (
              <section className="panel timing-empty">
                <AlertTriangle aria-hidden="true" />
                <div><strong>Não há data e horário disponíveis neste recorte.</strong><span>Altere o mês ou os filtros para continuar a análise.</span></div>
              </section>
            ) : (
              <>
                <section className="timing-main-grid">
                  <article className="panel" id="timing-weekday-export">
                    <div className="panel-head">
                      <SectionTitle title="Disparos por dia da semana" subtitle="Volume de disparos e desempenho recalculado sobre os registros do dia" />
                      <ExportActions imageTargetId="timing-weekday-export" imageName={`disparos-dia-semana-${frequencyMonth}.png`} />
                    </div>
                    <div className="weekday-bars">
                      {weekdayTiming.map((item) => (
                        <div className="weekday-row" key={item.label}>
                          <strong>{item.label}</strong>
                          <div className="weekday-track"><i style={{ width: `${(item.items.length / maxWeekdayDispatches) * 100}%` }} /></div>
                          <b>{formatInt(item.items.length)}</b>
                          <span>{formatPercent(item.metrics.openRate)} OR</span>
                          <span>{formatPercent(item.metrics.ctr)} CTR</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="panel" id="timing-heatmap-export">
                    <div className="panel-head">
                      <SectionTitle title="Mapa de concentração" subtitle="Quantidade de disparos por dia e faixa de horário" />
                      <ExportActions imageTargetId="timing-heatmap-export" imageName={`mapa-dias-horarios-${frequencyMonth}.png`} />
                    </div>
                    <div className="timing-heatmap">
                      <span />
                      {TIME_BUCKETS.map((time) => <strong key={time.label}>{time.label}</strong>)}
                      {WEEKDAY_BUCKETS.map((day) => (
                        <Fragment key={day.label}>
                          <b>{day.short}</b>
                          {TIME_BUCKETS.map((time) => {
                            const count = timingRows.filter((item) => {
                              const date = parsedSendDate(item.send_at);
                              return date && date.getDay() === day.day && date.getHours() >= time.start && date.getHours() <= time.end;
                            }).length;
                            return (
                              <i
                                key={`${day.label}-${time.label}`}
                                className={count ? "filled" : ""}
                                style={count ? { backgroundColor: `rgba(27, 0, 136, ${0.18 + (count / maxHeatmapDispatches) * 0.82})` } : undefined}
                                title={`${day.label}, ${time.label}: ${count} disparo(s)`}
                              >
                                {count || "–"}
                              </i>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </article>
                </section>

                <article className="panel timing-performance" id="timing-performance-export">
                  <div className="panel-head">
                    <SectionTitle title="Performance por faixa de horário" subtitle="KPIs ponderados pelos volumes oficiais; faixas com menos de 3 disparos não geram destaque" />
                    <ExportActions imageTargetId="timing-performance-export" imageName={`performance-horarios-${frequencyMonth}.png`} />
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Faixa</th><th>Disparos</th><th>Enviados</th><th>Recebidos</th><th>Open Rate</th><th>CTR</th><th>CTR qual.</th><th>CTOR</th><th>Bounce</th><th>Opt-out</th></tr></thead>
                      <tbody>
                        {hourTiming.map((item) => (
                          <tr key={item.label}>
                            <td><strong>{item.label}</strong></td>
                            <td>{formatInt(item.items.length)}</td>
                            <td>{formatInt(item.metrics.sent)}</td>
                            <td>{formatInt(item.metrics.delivered)}</td>
                            <td>{formatPercent(item.metrics.openRate)}</td>
                            <td>{formatPercent(item.metrics.ctr)}</td>
                            <td>{formatPercent(item.metrics.qualifiedCtr)}</td>
                            <td>{formatPercent(item.metrics.ctor)}</td>
                            <td>{formatPercent(item.metrics.bounce)}</td>
                            <td>{formatPercent(item.metrics.optout)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <section className="timing-insight-grid">
                  <article className="panel timing-insight">
                    <span>01</span><div><strong>Concentração operacional</strong><p>{busiestDay?.items.length ? `${busiestDay.label} concentrou ${formatInt(busiestDay.items.length)} disparos; a faixa mais utilizada foi ${busiestTime.label}, com ${formatInt(busiestTime.items.length)}.` : "Sem volume suficiente para leitura."}</p></div>
                  </article>
                  <article className="panel timing-insight">
                    <span>02</span><div><strong>Resposta por horário</strong><p>{bestOpenTime && bestCtrTime ? `Entre faixas com pelo menos 3 disparos, ${bestOpenTime.label} teve a maior abertura (${formatPercent(bestOpenTime.metrics.openRate)}) e ${bestCtrTime.label} o maior CTR (${formatPercent(bestCtrTime.metrics.ctr)}).` : "Ainda não há faixas com amostra mínima para comparação."}</p></div>
                  </article>
                  <article className="panel timing-insight">
                    <span>03</span><div><strong>Como interpretar</strong><p>Os dados mostram associação, não causa. Tema, público, categoria, volume e presença de CTA também influenciam os KPIs e devem ser considerados antes de mudar a régua.</p></div>
                  </article>
                </section>
                <p className="timing-footnote">* Destaques calculados somente em faixas com pelo menos 3 disparos no recorte selecionado. LATAMERS permanece excluído.</p>
              </>
            )}
          </div>
        )}

        {tab === "classifications" && (
          <div className="classifications-view" id="classification-analysis-export">
            <section className="classification-toolbar">
              <div className="comparison-filter-fields">
                <label>
                  <span>Mês de referência</span>
                  <select value={classificationMonth} onChange={(event) => setClassificationMonth(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <select value={classificationSelected} onChange={(event) => setClassificationSelected(event.target.value)}>
                    {classificationOptions.map((classification) => (
                      <option value={classification} key={classification}>{classification}</option>
                    ))}
                  </select>
                </label>
              </div>
              <ExportActions
                onCsv={() =>
                  exportCsv(
                    `canal-${classificationSelected}-${classificationMonth}.csv`,
                    ["Mês", "Canal", "Campanha", "Assunto", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "Possui CTA", "CTR qualificado", "CTOR", "Bounce", "Opt-out"],
                    classificationCsvRows,
                  )
                }
                imageTargetId="classification-analysis-export"
                imageName={`canal-${classificationSelected}-${classificationMonth}.png`}
              />
            </section>

            <section className="classification-hero panel">
              <div>
                <span className="summary-kicker">{GROUP_LABELS[classificationGroup] || classificationGroup || "CANAL"}</span>
                <h2>{classificationSelected}</h2>
                <p>Resultado oficial de {formatMonth(classificationMonth)}, comparado ao mês imediatamente anterior disponível.</p>
              </div>
              <div className="classification-hero-signal">
                <small>Taxa de abertura</small>
                <strong>{formatPercent(classificationCurrent.openRate)}</strong>
                <span className={trendClass(classificationCurrent.openRate, classificationPrevious.openRate)}>
                  {variationLabel(classificationCurrent.openRate, classificationPrevious.openRate, "pp")} vs. {formatMonth(classificationPreviousMonth, true)}
                </span>
              </div>
            </section>

            <section className="classification-kpi-grid">
              {[
                ["Comunicados", formatInt(classificationCurrent.communications), Layers3],
                ["Enviados", formatInt(classificationCurrent.sent), Send],
                ["Recebidos", formatInt(classificationCurrent.delivered), MailCheck],
                ["Aberturas", formatInt(classificationCurrent.opens), Eye],
                ["CTR", formatPercent(classificationCurrent.ctr), MoveUpRight],
                ["CTR qualificado", formatPercent(classificationCurrent.qualifiedCtr), MousePointerClick],
                ["CTOR", formatPercent(classificationCurrent.ctor), Target],
                ["Bounce", formatPercent(classificationCurrent.bounce), ShieldCheck],
                ["Opt-out", formatPercent(classificationCurrent.optout), Percent],
              ].map(([label, value, Icon], index) => {
                const ClassificationIcon = Icon as LucideIcon;
                return (
                  <article key={String(label)}>
                    <span className={`classification-kpi-icon tone-${index}`}><ClassificationIcon aria-hidden="true" /></span>
                    <small>{String(label)}</small>
                    <strong>{String(value)}</strong>
                  </article>
                );
              })}
            </section>

            <section className="classification-main-grid">
              <article className="panel classification-comparison">
                <SectionTitle title="Open Rate · evolução mensal" subtitle={`${formatMonth(classificationPreviousMonth)} versus ${formatMonth(classificationMonth)}`} />
                <div className="or-comparison">
                  {[
                    { month: classificationPreviousMonth, value: classificationPrevious.openRate, tone: "previous" },
                    { month: classificationMonth, value: classificationCurrent.openRate, tone: "current" },
                  ].map((item) => (
                    <div className="or-comparison-row" key={item.month}>
                      <span>{formatMonth(item.month, true)}</span>
                      <div><i className={item.tone} style={{ width: `${Math.min(100, item.value * 100)}%` }} /></div>
                      <strong>{formatPercent(item.value)}</strong>
                    </div>
                  ))}
                </div>
                <div className="classification-reading">
                  <span className={trendClass(classificationCurrent.openRate, classificationPrevious.openRate)}>
                    {classificationCurrent.openRate >= classificationPrevious.openRate ? "↑" : "↓"} {variationLabel(classificationCurrent.openRate, classificationPrevious.openRate, "pp")}
                  </span>
                  <p>
                    A taxa de abertura {classificationCurrent.openRate >= classificationPrevious.openRate ? "avançou" : "recuou"} frente ao mês anterior,
                    enquanto o volume de envios variou {variationLabel(classificationCurrent.sent, classificationPrevious.sent)}.
                  </p>
                </div>
              </article>

              <article className="panel classification-trend">
                <SectionTitle title="Histórico de abertura" subtitle="Evolução do Open Rate nos meses disponíveis" />
                <div className="classification-trend-bars">
                  {classificationTrend.map((item) => (
                    <div key={item.month}>
                      <strong>{formatPercent(item.openRate, 1)}</strong>
                      <i><b style={{ height: `${Math.max(3, (item.openRate / classificationTrendMax) * 100)}%` }} /></i>
                      <span>{formatMonth(item.month, true).split("/")[0]}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel classification-insights">
                <SectionTitle title="Leitura gerencial" subtitle="Síntese automática, baseada somente nos volumes oficiais" />
                <div className="classification-insight-list">
                  <div><span>01</span><p><strong>Alcance:</strong> {formatInt(classificationCurrent.sent)} enviados e {formatInt(classificationCurrent.delivered)} recebidos, com entrega de {formatPercent(classificationCurrent.delivery)}.</p></div>
                  <div><span>02</span><p><strong>Engajamento:</strong> {formatInt(classificationCurrent.opens)} aberturas e {formatInt(classificationCurrent.clicks)} cliques; CTR total de {formatPercent(classificationCurrent.ctr)}, CTR qualificado de {formatPercent(classificationCurrent.qualifiedCtr)} e CTOR de {formatPercent(classificationCurrent.ctor)}.</p></div>
                  <div><span>03</span><p><strong>Pressão da base:</strong> bounce em {formatPercent(classificationCurrent.bounce)} e opt-out em {formatPercent(classificationCurrent.optout)} no período.</p></div>
                </div>
              </article>
            </section>

            <article className="panel subcategory-compare-panel" id="subcategory-month-compare-export">
              <div className="panel-head">
                <SectionTitle
                  title="Comparativo mês a mês da canal"
                  subtitle="Selecione dois meses para comparar a mesma canal sem misturar públicos diferentes."
                />
                <ExportActions imageTargetId="subcategory-month-compare-export" imageName={`comparativo-canal-${classificationSelected}-${classificationCompareA}-${classificationCompareB}.png`} />
              </div>
              <div className="subcategory-compare-controls">
                <label>
                  <span>Canal</span>
                  <select value={classificationSelected} onChange={(event) => setClassificationSelected(event.target.value)}>
                    {classificationOptions.map((classification) => (
                      <option value={classification} key={classification}>{classification}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Mês base</span>
                  <select value={classificationCompareA} onChange={(event) => setClassificationCompareA(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Mês comparado</span>
                  <select value={classificationCompareB} onChange={(event) => setClassificationCompareB(event.target.value)}>
                    {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                  </select>
                </label>
              </div>
              <div className="subcategory-compare-summary">
                <div>
                  <strong>{classificationSelected}</strong>
                  <span>{GROUP_LABELS[classificationGroup] || classificationGroup || "Categoria não identificada"}</span>
                </div>
                <p>
                  {formatMonth(classificationCompareA)} registrou {formatInt(classificationCompareMetricsA.sent)} enviados e {formatPercent(classificationCompareMetricsA.openRate)} de abertura.
                  {" "}{formatMonth(classificationCompareB)} registrou {formatInt(classificationCompareMetricsB.sent)} enviados e {formatPercent(classificationCompareMetricsB.openRate)} de abertura.
                </p>
              </div>
              <div className="subcategory-compare-content">
                <div className="subcategory-compare-table">
                  <div className="subcategory-compare-head">
                    <span>KPI</span>
                    <span>{formatMonth(classificationCompareA, true)}</span>
                    <span>{formatMonth(classificationCompareB, true)}</span>
                    <span>Variação</span>
                  </div>
                  {classificationCompareItems.map((metric) => {
                    const currentA = classificationCompareMetricsA[metric.key];
                    const currentB = classificationCompareMetricsB[metric.key];
                    const variation = metric.valueType === "rate"
                      ? variationLabel(currentB, currentA, "pp")
                      : variationLabel(currentB, currentA);
                    return (
                      <div className="subcategory-compare-row" key={metric.key}>
                        <span>{metric.label}</span>
                        <strong>{metric.valueType === "rate" ? formatPercent(currentA) : formatInt(currentA)}</strong>
                        <strong>{metric.valueType === "rate" ? formatPercent(currentB) : formatInt(currentB)}</strong>
                        <em className={trendClass(currentB, currentA, Boolean(metric.inverse))}>{variation}</em>
                      </div>
                    );
                  })}
                </div>
                <div className="subcategory-compare-reading">
                  <strong>Leitura executiva</strong>
                  <p>
                    A comparação isola a mesma canal para evitar leitura enviesada por mix de público. Leia primeiro a variação de volume e depois valide se abertura, CTR, CTOR, Bounce e Opt-out acompanharam esse movimento.
                  </p>
                  <ul>
                    <li>
                      <span>Volume</span>
                      <strong>{variationLabel(classificationCompareMetricsB.sent, classificationCompareMetricsA.sent)}</strong>
                    </li>
                    <li>
                      <span>Abertura</span>
                      <strong className={trendClass(classificationCompareMetricsB.openRate, classificationCompareMetricsA.openRate)}>
                        {variationLabel(classificationCompareMetricsB.openRate, classificationCompareMetricsA.openRate, "pp")}
                      </strong>
                    </li>
                    <li>
                      <span>Cliques</span>
                      <strong className={trendClass(classificationCompareMetricsB.ctr, classificationCompareMetricsA.ctr)}>
                        {variationLabel(classificationCompareMetricsB.ctr, classificationCompareMetricsA.ctr, "pp")}
                      </strong>
                    </li>
                    <li>
                      <span>Rejeição</span>
                      <strong className={trendClass(classificationCompareMetricsB.bounce, classificationCompareMetricsA.bounce, true)}>
                        {variationLabel(classificationCompareMetricsB.bounce, classificationCompareMetricsA.bounce, "pp")}
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            <article className="panel classification-campaigns">
              <div className="panel-head">
                <SectionTitle title="Disparos de maior alcance" subtitle={`Maiores volumes enviados em ${classificationSelected} no mês selecionado`} />
                <span className="data-scope-note">{formatInt(classificationCampaigns.length)} disparos identificados</span>
              </div>
              <div className="classification-campaign-list">
                {classificationCampaigns.slice(0, 3).map((item, index) => (
                  <div key={`${item.campaign_name}-${item.subject}-${index}`}>
                    <span className="rank-badge">{index + 1}</span>
                    <div><strong>{item.campaign_name}</strong><small>{item.subject}</small></div>
                    <p><strong>{formatInt(num(item.emails_sent))}</strong><span>enviados</span></p>
                     <p><strong>{formatPercent(num(item.open_rate))}</strong><span>Open Rate</span></p>
                     <p>
                       <strong>{item.has_cta ? formatPercent(num(item.qualified_ctr)) : "—"}</strong>
                       <span>{item.has_cta ? "CTR qualificado" : "Sem CTA"}</span>
                     </p>
                  </div>
                ))}
              </div>
              {classificationCampaigns.length === 0 && (
                <div className="campaign-empty"><MailSearch aria-hidden="true" /><strong>Sem disparos identificados</strong><span>Não há campanhas vinculadas a esta canal no período.</span></div>
              )}
            </article>
          </div>
        )}

        {isAdmin && tab === "load" && (
          <div className="load-view">
            <section className="load-hero panel">
              <div>
                <span className="summary-kicker">GOVERNANÇA DE DADOS</span>
                <h2>Carga mensal com validação antes de publicar</h2>
                <p>
                  Suba a planilha oficial, confira o extrato e só depois aprove a gravação no Supabase.
                  Nenhum KPI é inventado: todos são recalculados a partir dos contadores da aba selecionada.
                  LATAMERS é excluído automaticamente dos indicadores publicados, por se tratar de envio interno.
                </p>
              </div>
              <div className="load-status-card">
                <CheckCircle2 aria-hidden="true" />
                <strong>Fluxo protegido</strong>
                <span>Visível apenas para admin; chave segura fica somente no servidor.</span>
              </div>
            </section>

            <section className="load-grid">
              {[
                {
                  title: "1. Receber arquivo",
                  text: "Upload da planilha oficial ou conexão com Google Planilha, sempre preservando a aba mensal validada.",
                  icon: FileSpreadsheet,
                },
                {
                  title: "2. Gerar extrato",
                  text: "Resumo por categoria, canal, CTA, volumes e KPIs recalculados a partir da base carregada.",
                  icon: ClipboardCheck,
                },
                {
                  title: "3. Pré-validar",
                  text: "Comparação contra histórico: volume, abertura, CTR, CTR qualificado, CTOR, bounce e opt-out.",
                  icon: AlertTriangle,
                },
                {
                  title: "4. Aprovar carga",
                  text: "Somente após sua aprovação os dados entram na base oficial e aparecem no painel.",
                  icon: UploadCloud,
                },
              ].map(({ title, text, icon: Icon }) => (
                <article className="load-step-card" key={title}>
                  <span><Icon aria-hidden="true" /></span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </section>

            <section className="panel load-control-panel">
              <div className="panel-head">
                <SectionTitle
                  title="Upload e pré-validação"
                  subtitle="Primeiro valide. A gravação só fica liberada após o extrato ser gerado sem erro crítico."
                />
                <span className="validated-badge"><i />Base oficial protegida</span>
              </div>
              <div className="load-form-grid">
                <label>
                  <span>Mês de referência</span>
                  <input value={loadMonth} onChange={(event) => { setLoadMonth(event.target.value); resetLoadValidation(); }} placeholder="2026-07" />
                </label>
                <label>
                  <span>Arquivo oficial (.xlsx)</span>
                  <input type="file" accept=".xlsx" onChange={(event) => handleLoadFile(event.target.files?.[0] || null)} />
                </label>
                <label>
                  <span>Aba da planilha</span>
                  <select value={loadSheetName} onChange={(event) => { setLoadSheetName(event.target.value); resetLoadValidation(); }} disabled={!loadWorkbook}>
                    {!loadWorkbook && <option>Selecione um arquivo</option>}
                    {loadWorkbook?.sheets.map((sheet) => (
                      <option value={sheet.name} key={sheet.name}>{sheet.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="load-primary-action" onClick={validateLoad} disabled={loadStatus === "parsing" || loadStatus === "validating" || !selectedLoadSheet}>
                  <ClipboardCheck aria-hidden="true" />
                  {loadStatus === "validating" ? "Validando..." : "Gerar extrato"}
                </button>
              </div>
              <div className="load-dropzone compact">
                <UploadCloud aria-hidden="true" />
                <strong>{loadFileName || "Nenhum arquivo selecionado"}</strong>
                <p>
                  {selectedLoadSheet
                    ? `${selectedLoadSheet.rows.length} linhas brutas detectadas na aba ${selectedLoadSheet.name}.`
                    : "A leitura aceita arquivos XLSX oficiais e preserva a seleção de aba antes da validação."}
                </p>
              </div>
              {loadError && <div className="load-message error"><AlertTriangle aria-hidden="true" />{loadError}</div>}
              {loadResult && <div className="load-message success"><CheckCircle2 aria-hidden="true" />{loadResult}</div>}
              <div className="load-checklist">
                <div><CheckCircle2 aria-hidden="true" /><span>Leitura do arquivo antes da gravação</span></div>
                <div><CheckCircle2 aria-hidden="true" /><span>Extrato de validação por mês, categoria e canal</span></div>
                <div><CheckCircle2 aria-hidden="true" /><span>Alertas contra comportamento histórico fora do padrão</span></div>
                <div><CheckCircle2 aria-hidden="true" /><span>Botão final de aprovação somente após conferência</span></div>
                <div><CheckCircle2 aria-hidden="true" /><span>LATAMERS excluído automaticamente da carga publicada</span></div>
              </div>
            </section>

            {loadValidation && (
              <>
                <section className="load-scope-note">
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <strong>Escopo validado da carga</strong>
                    <span>
                      LATAMERS foi identificado como envio interno e não entra nos KPIs publicados. O extrato abaixo considera apenas Agências, Empresas e Outros.
                    </span>
                  </div>
                </section>

                <section className="load-kpi-block">
                  <div className="load-kpi-heading">
                    <strong>Volumes para conferência</strong>
                    <span>Somas absolutas recalculadas a partir da planilha carregada.</span>
                  </div>
                  <div className="load-kpi-grid volume">
                    {[
                      ["Disparos", formatInt(loadValidation.totals.communications), Layers3],
                      ["Emails enviados", formatInt(loadValidation.totals.sent), Send],
                      ["Emails recebidos", formatInt(loadValidation.totals.delivered), MailCheck],
                      ["Aberturas únicas", formatInt(loadValidation.totals.opens), Eye],
                      ["Cliques únicos", formatInt(loadValidation.totals.clicks), MousePointerClick],
                      ["Cliques totais", formatInt(loadValidation.totals.totalClicks), MousePointerClick],
                      ["Unsubscribe / Opt-out", formatInt(loadValidation.totals.unsubscribes), Percent],
                      ["Bounces", formatInt(loadValidation.totals.bounces), ShieldCheck],
                    ].map(([label, value, Icon], index) => {
                      const LoadIcon = Icon as LucideIcon;
                      return (
                        <article className="load-kpi-card" key={String(label)}>
                          <span className={`campaign-summary-icon tone-${index}`}><LoadIcon aria-hidden="true" /></span>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="load-kpi-block">
                  <div className="load-kpi-heading">
                    <strong>Taxas recalculadas</strong>
                    <span>Percentuais derivados dos volumes oficiais acima.</span>
                  </div>
                  <div className="load-kpi-grid rates">
                    {[
                      ["Open Rate", formatPercent(loadValidation.totals.openRate), Eye],
                      ["CTR", formatPercent(loadValidation.totals.ctr), MoveUpRight],
                      ["CTR qualificado", formatPercent(loadValidation.totals.qualifiedCtr), Target],
                      ["CTOR", formatPercent(loadValidation.totals.ctor), Target],
                      ["Opt-out %", formatPercent(loadValidation.totals.optout), Percent],
                      ["Bounce %", formatPercent(loadValidation.totals.bounce), ShieldCheck],
                    ].map(([label, value, Icon], index) => {
                      const LoadIcon = Icon as LucideIcon;
                      return (
                        <article className="load-kpi-card compact" key={String(label)}>
                          <span className={`campaign-summary-icon tone-${index + 8}`}><LoadIcon aria-hidden="true" /></span>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="load-validation-grid">
                  <article className="panel load-validation-card">
                    <div className="panel-head">
                      <SectionTitle title="Resultado da pré-validação" subtitle={`${formatMonth(loadValidation.monthKey)} · ${loadValidation.normalizedRows} linhas normalizadas`} />
                      <span className={`load-status-pill ${loadValidation.ok ? "success" : "error"}`}>
                        {loadValidation.ok ? "Sem erro crítico" : "Requer correção"}
                      </span>
                    </div>
                    <div className="load-issue-grid">
                      <div>
                        <strong>Erros críticos</strong>
                        {loadValidation.errors.length === 0 ? <p>Nenhum erro crítico identificado.</p> : loadValidation.errors.map((item) => <p className="issue-error" key={item}>{item}</p>)}
                      </div>
                      <div>
                        <strong>Avisos e alertas</strong>
                        {[...loadValidation.warnings, ...loadValidation.alerts].length === 0 ? (
                          <p>Nenhum alerta relevante frente ao histórico.</p>
                        ) : (
                          [...loadValidation.warnings, ...loadValidation.alerts].map((item) => (
                            <p className="issue-warning" title={item} key={item}>{item}</p>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="load-quality-row">
                      <span>Linhas zeradas: <strong>{formatInt(loadValidation.quality.zero_send_rows || 0)}</strong></span>
                      <span>Contadores ajustados: <strong>{formatInt(loadValidation.quality.scaled_counter_rows || 0)}</strong></span>
                      <span>Datas fora do mês: <strong>{formatInt(loadValidation.quality.dates_outside_month || 0)}</strong></span>
                    </div>
                  </article>

                  <article className="panel load-validation-card">
                    <SectionTitle title="Referência histórica" subtitle="Parâmetro interno para validar desvios antes da aprovação; não substitui o KPI oficial do mês" />
                    <div className="load-comparison-list">
                      {loadHistoryUnavailable ? (
                        <div className="load-history-empty">
                          <strong>Referência histórica temporariamente indisponível.</strong>
                          <span>A pré-validação segue pelos totais oficiais da planilha e pelas regras estruturais da carga.</span>
                        </div>
                      ) : (
                        loadValidation.comparison.map((item) => (
                          <div className={`load-comparison-item ${item.severity}`} key={item.label}>
                            <span>{item.label}</span>
                            <strong>{item.label.includes("Rate") || ["CTR", "CTOR", "Bounce", "Opt-out"].includes(item.label) ? formatPercent(item.current) : formatInt(item.current)}</strong>
                            <small>
                              Referência histórica: {item.label.includes("Rate") || ["CTR", "CTOR", "Bounce", "Opt-out"].includes(item.label) ? formatPercent(item.average) : formatInt(item.average)}
                              {item.deltaPct !== null ? ` · ${item.deltaPct >= 0 ? "+" : ""}${formatPercent(item.deltaPct)}` : ""}
                            </small>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </section>

                <article className="panel load-validation-card" id="load-validation-export">
                  <div className="panel-head">
                    <SectionTitle title="Extrato por categoria e canal" subtitle="Visão oficial que será publicada no painel após aprovação" />
                    <ExportActions
                      onCsv={() => exportCsv(
                        `validacao-carga-${loadValidation.monthKey}.csv`,
                        ["Tipo", "Nome", "Categoria", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTR qualificado", "CTOR", "Bounce", "Opt-out"],
                        ["CORP", "TRADE", "OUTROS"].flatMap((group) => {
                          const groupItem = loadValidation.byGroup.find((item) => item.label === group);
                          const segmentItems = loadValidation.bySegment.filter((item) => item.group === group);
                          return [
                            ...(groupItem ? [["Categoria", GROUP_LABELS[groupItem.label] || groupItem.label, GROUP_LABELS[groupItem.label] || groupItem.label, groupItem.metrics.communications, groupItem.metrics.sent, groupItem.metrics.delivered, groupItem.metrics.opens, groupItem.metrics.clicks, formatPercent(groupItem.metrics.openRate), formatPercent(groupItem.metrics.ctr), formatPercent(groupItem.metrics.qualifiedCtr), formatPercent(groupItem.metrics.ctor), formatPercent(groupItem.metrics.bounce), formatPercent(groupItem.metrics.optout)]] : []),
                            ...segmentItems.map((item) => ["Canal", item.label, GROUP_LABELS[item.group] || item.group, item.metrics.communications, item.metrics.sent, item.metrics.delivered, item.metrics.opens, item.metrics.clicks, formatPercent(item.metrics.openRate), formatPercent(item.metrics.ctr), formatPercent(item.metrics.qualifiedCtr), formatPercent(item.metrics.ctor), formatPercent(item.metrics.bounce), formatPercent(item.metrics.optout)]),
                          ];
                        }),
                      )}
                      imageTargetId="load-validation-export"
                      imageName={`validacao-carga-${loadValidation.monthKey}.png`}
                    />
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Tipo</th><th>Nome</th><th>Categoria</th><th>Comunicados</th><th>Enviados</th><th>Recebidos</th><th>OR</th><th>CTR</th><th>CTR qual.</th><th>Bounce</th><th>Opt-out</th></tr></thead>
                      <tbody>
                        {["CORP", "TRADE", "OUTROS"].flatMap((group) => {
                          const groupItem = loadValidation.byGroup.find((item) => item.label === group);
                          const segmentItems = loadValidation.bySegment.filter((item) => item.group === group);
                          return [
                            groupItem ? (
                              <tr key={`group-${groupItem.label}`} className="load-total-row">
                                <td>Categoria</td><td>{GROUP_LABELS[groupItem.label] || groupItem.label}</td><td>{GROUP_LABELS[groupItem.label] || groupItem.label}</td><td>{formatInt(groupItem.metrics.communications)}</td><td>{formatInt(groupItem.metrics.sent)}</td><td>{formatInt(groupItem.metrics.delivered)}</td><td>{formatPercent(groupItem.metrics.openRate)}</td><td>{formatPercent(groupItem.metrics.ctr)}</td><td>{formatPercent(groupItem.metrics.qualifiedCtr)}</td><td>{formatPercent(groupItem.metrics.bounce)}</td><td>{formatPercent(groupItem.metrics.optout)}</td>
                              </tr>
                            ) : null,
                            ...segmentItems.map((item) => (
                              <tr key={`segment-${item.group}-${item.label}`}>
                                <td>Canal</td><td><i style={{ background: segmentColor(item.label) }} />{loadSegmentLabel(item.label)}</td><td>{GROUP_LABELS[item.group] || item.group}</td><td>{formatInt(item.metrics.communications)}</td><td>{formatInt(item.metrics.sent)}</td><td>{formatInt(item.metrics.delivered)}</td><td>{formatPercent(item.metrics.openRate)}</td><td>{formatPercent(item.metrics.ctr)}</td><td>{formatPercent(item.metrics.qualifiedCtr)}</td><td>{formatPercent(item.metrics.bounce)}</td><td>{formatPercent(item.metrics.optout)}</td>
                              </tr>
                            )),
                          ].filter(Boolean);
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>

                <section className="panel load-approval-panel">
                  <div>
                    <span className="summary-kicker">APROVAÇÃO FINAL</span>
                    <h3>Publicar {formatMonth(loadValidation.monthKey)} no painel?</h3>
                    <p>Depois da aprovação, os dados entram nas tabelas oficiais e as views do dashboard passam a considerar o novo mês.</p>
                    {loadValidation.duplicateMonth && (
                      <label className="load-replace-check">
                        <input type="checkbox" checked={loadReplaceMonth} onChange={(event) => setLoadReplaceMonth(event.target.checked)} />
                        <span>Substituir todos os registros já existentes deste mês antes da nova carga.</span>
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    className="load-primary-action approve"
                    onClick={commitLoad}
                    disabled={!loadValidation.ok || loadStatus === "committing" || (loadValidation.duplicateMonth && !loadReplaceMonth)}
                  >
                    <UploadCloud aria-hidden="true" />
                    {loadStatus === "committing" ? "Publicando..." : "Aprovar e publicar"}
                  </button>
                </section>
              </>
            )}
          </div>
        )}

        {tab === "insights" && (
          <div className="insights-view">
            <section className="insight-cards" id="insight-cards-export">
              <article className="insight-card scale">
                <div className="insight-card-head"><span className="insight-icon"><TrendingUp aria-hidden="true" /></span>Alcance enviado</div>
                <h3>{volumeHeadline}</h3>
                <p>{volumeCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.sent, comparePrevious.sent)}`}><strong>{variationLabel(compareCurrent.sent, comparePrevious.sent)}</strong><span>comparado ao mês anterior</span></div>
              </article>
              <article className="insight-card delivery">
                <div className="insight-card-head"><span className="insight-icon"><CheckCircle2 aria-hidden="true" /></span>Qualidade da entrega</div>
                <h3>{deliveryHeadline}</h3>
                <p>{deliveryCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.delivery, comparePrevious.delivery)}`}><strong>{variationLabel(compareCurrent.delivery, comparePrevious.delivery)}</strong><span>na taxa de entrega</span></div>
              </article>
              <article className="insight-card opening">
                <div className="insight-card-head"><span className="insight-icon"><Eye aria-hidden="true" /></span>Interesse pelo conteúdo</div>
                <h3>{openingHeadline}</h3>
                <p>{openingCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.openRate, comparePrevious.openRate)}`}><strong>{variationLabel(compareCurrent.openRate, comparePrevious.openRate)}</strong><span>na taxa de abertura</span></div>
              </article>
              <article className="insight-card alert">
                <div className="insight-card-head"><span className="insight-icon"><AlertTriangle aria-hidden="true" /></span>Resposta ao conteúdo</div>
                <h3>{clickHeadline}</h3>
                <p>{clickCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.clicks, comparePrevious.clicks)}`}><strong>{variationLabel(compareCurrent.clicks, comparePrevious.clicks)}</strong><span>em pessoas que clicaram</span></div>
              </article>
            </section>
            <div className="insight-export-row">
              <ExportActions imageTargetId="insight-cards-export" imageName={`cards-insights-${previousMonth}-${currentMonth}.png`} />
            </div>

            <section className="insight-main-grid">
              <article className="panel performance-journey" id="insight-journey-export">
                <div className="panel-head">
                  <SectionTitle title="Do envio ao clique" subtitle={`Quantas pessoas avançaram em cada etapa · ${formatMonth(previousMonth)} versus ${formatMonth(currentMonth)}`} />
                  <div className="panel-actions">
                    <div className="compare-legend">
                      <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
                      <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
                    </div>
                    <ExportActions imageTargetId="insight-journey-export" imageName={`jornada-performance-${previousMonth}-${currentMonth}.png`} />
                  </div>
                </div>
                <div className="journey-comparison">
                  {journeyStages.map(([label, note, currentValue, previousValue]) => (
                    <div className="journey-stage" key={label}>
                      <div className="journey-label"><strong>{label}</strong><small>{note}</small></div>
                      <div className="journey-bars">
                        <span><i className="current" style={{ width: `${(currentValue / journeyMaximum) * 100}%` }} /></span>
                        <span><i className="previous" style={{ width: `${(previousValue / journeyMaximum) * 100}%` }} /></span>
                      </div>
                      <div className="journey-values"><strong>{formatInt(currentValue)}</strong><small>{formatInt(previousValue)}</small></div>
                    </div>
                  ))}
                </div>
              </article>
              <aside className="panel diagnosis-panel" id="insight-diagnosis-export">
                <div className="panel-head">
                  <SectionTitle title="Leitura executiva do mês" subtitle="Conclusões objetivas calculadas sobre os dados oficiais" />
                  <ExportActions imageTargetId="insight-diagnosis-export" imageName={`diagnostico-${previousMonth}-${currentMonth}.png`} />
                </div>
                <div className="diagnosis-list">
                  <div className={deliveryChange >= 0 ? "good" : "warn"}>
                    <strong>{deliveryChange >= 0 ? "Entrega mais eficiente, mesmo com menor alcance" : "Menor alcance e piora na entrega"}</strong>
                    <p>{formatInt(Math.abs(volumeDelta))} envios e {formatInt(Math.abs(deliveredDelta))} recebimentos {volumeDelta < 0 ? "a menos" : "a mais"}. A taxa de entrega {deliveryChange >= 0 ? "melhorou" : "recuou"} {variationLabel(compareCurrent.delivery, comparePrevious.delivery).replace("+", "")}.</p>
                  </div>
                  <div className={openChange < 0 ? "warn" : "good"}>
                    <strong>{openChange < 0 ? "Menos pessoas abriram e clicaram" : "Abertura e resposta avançaram"}</strong>
                    <p>{formatInt(Math.abs(opensDelta))} aberturas e {formatInt(Math.abs(clicksDelta))} cliques {opensDelta < 0 ? "a menos" : "a mais"}. Abertura {variationLabel(compareCurrent.openRate, comparePrevious.openRate)} e CTR {variationLabel(compareCurrent.ctr, comparePrevious.ctr)}.</p>
                  </div>
                  <div className={optoutChange !== null && optoutChange > 0 ? "warn" : "good"}>
                    <strong>{optoutChange !== null && optoutChange > 0 ? "Atenção à taxa de opt-out" : "Pressão sobre a base controlada"}</strong>
                    <p>{formatInt(compareCurrent.unsubscribes)} opt-outs contra {formatInt(comparePrevious.unsubscribes)} no mês anterior. A taxa ficou em {formatPercent(compareCurrent.optout)} ({variationLabel(compareCurrent.optout, comparePrevious.optout)}).</p>
                  </div>
                </div>
              </aside>
            </section>

            <section className="insight-lower-grid">
              <article className="panel movements-panel">
                <div className="panel-head">
                  <SectionTitle title="Onde a performance mais mudou" subtitle="Somente canais com volume comparável nos dois meses" />
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `movimentos-insights-${previousMonth}-${currentMonth}.csv`,
                        ["Canal", "KPI", formatMonth(currentMonth), formatMonth(previousMonth), "Variação %"],
                        segmentMovements.map((movement) => [
                          movement.label,
                          movement.metric,
                          formatPercent(movement.current),
                          formatPercent(movement.previous),
                          variationLabel(movement.current, movement.previous, "pp"),
                        ]),
                      )
                    }
                  />
                </div>
                <div className="movement-list">
                  {segmentMovements.map((movement) => {
                    const movementMaximum = Math.max(movement.current, movement.previous, 0.0001);
                    return (
                      <div className="movement" key={`${movement.label}-${movement.metric}`}>
                        <div className="movement-head">
                          <strong>{movement.label} · {movement.metric}</strong>
                          <span className={movement.change >= 0 ? "positive" : "negative"}>{variationLabel(movement.current, movement.previous, "pp")}</span>
                        </div>
                        <p><strong>{movement.change >= 0 ? "Subiu" : "Caiu"}</strong> de {formatPercent(movement.previous)} para {formatPercent(movement.current)}.</p>
                        <div className="movement-bar previous">
                          <span>{formatMonth(previousMonth, true)}</span>
                          <i><b style={{ width: `${Math.max(3, (movement.previous / movementMaximum) * 100)}%` }} /></i>
                          <strong>{formatPercent(movement.previous)}</strong>
                        </div>
                        <div className="movement-bar">
                          <span>{formatMonth(currentMonth, true)}</span>
                          <i><b style={{ width: `${Math.max(3, (movement.current / movementMaximum) * 100)}%` }} /></i>
                          <strong>{formatPercent(movement.current)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="panel questions-panel" id="insight-questions-export">
                <div className="panel-head">
                  <SectionTitle title="Próximas ações recomendadas" subtitle="O que revisar primeiro a partir dos sinais do mês" />
                  <ExportActions imageTargetId="insight-questions-export" imageName={`perguntas-decisao-${previousMonth}-${currentMonth}.png`} />
                </div>
                <div className="questions-list">
                  <div className="question">
                    <div><span>01</span><strong>Recuperar a eficiência de clique</strong></div>
                    <p>{clickDeclines.length ? `Comece por ${clickDeclines.join(", ")}: foram as maiores quedas de CTR entre as canais com volume comparável. Revise assunto, oferta, CTA e destino do clique.` : "Revise as campanhas com maior queda de CTR, comparando assunto, oferta, CTA e destino do clique."}</p>
                  </div>
                  <div className="question">
                    <div><span>02</span><strong>Reduzir falhas de entrega</strong></div>
                    <p>{bounceAlerts.length ? `Priorize ${bounceAlerts.join(", ")}, que concentraram as maiores taxas de bounce do mês. Verifique qualidade da lista, endereços inválidos e origem da base.` : "Analise as canais com maior bounce e verifique a qualidade e a origem das listas."}</p>
                  </div>
                  <div className="question">
                    <div><span>03</span><strong>Conter o crescimento do opt-out</strong></div>
                    <p>{optoutAlerts.length ? `Monitore ${optoutAlerts.join(", ")}, que apresentaram as maiores taxas de opt-out. Revise relevância, segmentação e pressão de comunicação antes do próximo ciclo.` : "Monitore as canais com maior opt-out e revise relevância, segmentação e pressão de comunicação."}</p>
                  </div>
                </div>
              </article>
            </section>

            <div className="insight-method">
              <span>Leitura baseada exclusivamente nos dados oficiais · Latamers excluído</span>
              <span>Comparação com o mês anterior · sem meta ou benchmark externo</span>
            </div>
          </div>
        )}

        {tab === "guide" && (
          <div className="guide-view">
            <section className="panel guide-intro">
              <div>
                <span className="summary-kicker">COMECE POR AQUI</span>
                <h2>Leia o mês em quatro perguntas</h2>
                <p>Não comece pelo melhor ou pior percentual isolado. Primeiro entenda o tamanho da operação; depois confirme se a mensagem chegou, despertou interesse e gerou ação.</p>
              </div>
              <div className="guide-intro-note">
                <ClipboardCheck aria-hidden="true" />
                <span>Use sempre o mesmo período de referência ao comparar os resultados.</span>
              </div>
            </section>

            <section className="guide-steps" aria-label="Ordem recomendada de leitura">
              <article>
                <span>01</span>
                <Send aria-hidden="true" />
                <strong>Qual foi o tamanho da operação?</strong>
                <p>Veja Comunicações e Emails enviados. Uma mudança de volume pode explicar parte da variação dos demais indicadores.</p>
              </article>
              <article>
                <span>02</span>
                <MailCheck aria-hidden="true" />
                <strong>A mensagem chegou?</strong>
                <p>Compare Emails recebidos e Bounce. Se a entrega cair, investigue a qualidade e a origem da base antes de avaliar conteúdo.</p>
              </article>
              <article>
                <span>03</span>
                <Eye aria-hidden="true" />
                <strong>O conteúdo gerou interesse?</strong>
                <p>Use a Taxa de abertura. Ela indica a proporção de recebidos que abriu o email; assunto, remetente e relevância influenciam esse momento.</p>
              </article>
              <article>
                <span>04</span>
                <MousePointerClick aria-hidden="true" />
                <strong>O interesse virou ação?</strong>
                <p>Leia CTR e CTOR juntos. Eles mostram se a peça e o CTA conduziram as pessoas até o clique.</p>
              </article>
            </section>

            <section className="guide-main-grid">
              <article className="panel guide-metric-panel">
                <SectionTitle title="O que cada indicador responde" subtitle="Uma leitura humana, sem precisar decorar siglas" />
                <div className="guide-metric-list">
                  <div><span className="guide-dot volume" /><div><strong>Comunicações e Emails enviados</strong><p>Mostram o esforço e o alcance planejado no mês.</p></div><small>Volume</small></div>
                  <div><span className="guide-dot delivery" /><div><strong>Emails recebidos e Bounce</strong><p>Mostram se a base conseguiu receber a mensagem.</p></div><small>Entrega</small></div>
                  <div><span className="guide-dot opening" /><div><strong>Taxa de abertura</strong><p>Mostra quantas pessoas abriram entre aquelas que receberam.</p></div><small>Interesse</small></div>
                  <div><span className="guide-dot action" /><div><strong>CTR, CTR qualificado e CTOR</strong><p>Mostram se houve clique e quão bem o conteúdo conduziu para a ação.</p></div><small>Ação</small></div>
                  <div><span className="guide-dot care" /><div><strong>Opt-outs</strong><p>Mostra quantas pessoas pediram para sair da base. Leia a quantidade e a taxa antes de concluir.</p></div><small>Relação</small></div>
                </div>
              </article>

              <article className="panel guide-decision-panel">
                <SectionTitle title="Quando um sinal muda, o que investigar?" subtitle="Use estas perguntas como ponto de partida, não como diagnóstico final" />
                <div className="guide-question-list">
                  <div><strong>Envios caíram ou subiram muito?</strong><p>Compare o calendário, a quantidade de campanhas e os canais ativados antes de comparar taxas.</p></div>
                  <div><strong>Entrega está estável, mas abertura caiu?</strong><p>Revise assunto, pré-header, remetente, audiência e relevância da mensagem para aquele canal.</p></div>
                  <div><strong>Abertura está boa, mas o CTR caiu?</strong><p>Investigue proposta de valor, clareza do CTA, posição do botão e destino do clique.</p></div>
                  <div><strong>Opt-outs aumentaram?</strong><p>Verifique pressão de comunicação, frequência, segmentação e alinhamento entre expectativa e conteúdo recebido.</p></div>
                </div>
              </article>
            </section>

            <section className="guide-navigation-grid">
              <article className="panel guide-navigation-card"><span>Visão geral</span><strong>Entenda o mês em poucos minutos</strong><p>Comece pelos cards, evolução e performance por canal.</p></article>
              <article className="panel guide-navigation-card"><span>Insights</span><strong>Veja onde agir primeiro</strong><p>Use a leitura gerencial para priorizar os movimentos mais relevantes.</p></article>
              <article className="panel guide-navigation-card"><span>Análise por canal</span><strong>Investigue quem explicou o resultado</strong><p>Compare o mesmo canal entre os meses, evitando conclusões influenciadas apenas pelo mix de público.</p></article>
              <article className="panel guide-navigation-card"><span>Dias e horários</span><strong>Procure padrões de envio</strong><p>Confira se dia e faixa de horário ajudam a explicar desempenho e oportunidade de teste.</p></article>
            </section>

            <section className="guide-checklist">
              <CheckCircle2 aria-hidden="true" />
              <div><strong>Antes de apresentar uma conclusão</strong><p>Compare com o mês anterior, confirme se o volume é semelhante, observe o canal e trate cada resultado como um sinal a ser investigado. Para afirmar causa e efeito, use testes controlados.</p></div>
            </section>
          </div>
        )}

        <footer className="dashboard-footer">
          <p><strong>Fonte:</strong> base oficial consolidada de Email Marketing. LATAMERS é excluído de todos os indicadores apresentados por representar envio interno.</p>
          <div className="mini-glossary" aria-label="Mini glossário de KPIs">
            <span><strong>OR / Open Rate</strong>Aberturas únicas ÷ emails recebidos.</span>
            <span><strong>CTR</strong>Cliques únicos ÷ emails enviados.</span>
            <span><strong>CTR qualificado</strong>Cliques únicos dos disparos com CTA ÷ enviados dos disparos com CTA.</span>
            <span><strong>CTOR</strong>Cliques únicos ÷ aberturas únicas.</span>
            <span><strong>Bounce</strong>Bounces ÷ emails enviados.</span>
            <span><strong>Opt-out</strong>Unsubscribes ÷ emails enviados.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
