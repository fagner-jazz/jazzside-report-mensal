"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Download,
  Eye,
  Layers3,
  LayoutDashboard,
  MailCheck,
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SUPABASE_URL = "https://fidfdgnnoqamhftczcer.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_kxXpLfa6qCedVjuZQP5Xug_xL9co33j";

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
};

type Metrics = {
  communications: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
};

type RateKey =
  | "delivery"
  | "openRate"
  | "ctr"
  | "ctor"
  | "optout"
  | "bounce";

type Rates = Record<RateKey, number>;
type Enriched = Metrics & Rates;
type Tab = "overview" | "summary" | "comparison" | "semester" | "highlights" | "insights";
type HighlightMetric = "open_rate" | "ctr" | "ctor" | "bounce_rate";

const EMPTY: Metrics = {
  communications: 0,
  sent: 0,
  delivered: 0,
  opens: 0,
  clicks: 0,
  unsubscribes: 0,
  bounces: 0,
};

const GROUP_COLORS: Record<string, string> = {
  TRADE: "#7149e9",
  CORP: "#16a38f",
  OUTROS: "#f3a51f",
};

const SEGMENT_COLORS: Record<string, string> = {
  Consolidadores: "#1F6FEB",
  Corporativas: "#00897B",
  OTAs: "#E6A700",
  Operators: "#7C3AED",
  LC: "#D62828",
  GE: "#2E8B57",
  Club: "#D63384",
  Aniversário: "#0096C7",
  "Aniversário Agências": "#8C5A2B",
  Pontual: "#596579",
  Vendas: "#7A8B00",
};

const GROUP_LABELS: Record<string, string> = {
  TRADE: "Trade",
  CORP: "Corp",
  OUTROS: "Outros",
};

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

function num(value: number | string) {
  return Number(value) || 0;
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
  };
}

function enrich(metrics: Metrics): Enriched {
  const safe = (value: number, denominator: number) =>
    denominator > 0 ? value / denominator : 0;
  return {
    ...metrics,
    delivery: safe(metrics.delivered, metrics.sent),
    openRate: safe(metrics.opens, metrics.delivered),
    ctr: safe(metrics.clicks, metrics.sent),
    ctor: safe(metrics.clicks, metrics.opens),
    optout: safe(metrics.unsubscribes, metrics.sent),
    bounce: safe(metrics.bounces, metrics.sent),
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");
  downloadText(filename, `\uFEFF${content}`, "text/csv;charset=utf-8");
}

function inlineComputedStyles(source: Element, target: Element) {
  const styles = window.getComputedStyle(source);
  Array.from(styles).forEach((property) => {
    (target as HTMLElement).style.setProperty(
      property,
      styles.getPropertyValue(property),
      styles.getPropertyPriority(property),
    );
  });
  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) inlineComputedStyles(child, targetChild);
  });
}

async function exportElementPng(elementId: string, filename: string) {
  const node = document.getElementById(elementId);
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const clone = node.cloneNode(true) as HTMLElement;
  inlineComputedStyles(node, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(rect.width)}" height="${Math.ceil(rect.height)}">
      <foreignObject width="100%" height="100%">${html}</foreignObject>
    </svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rect.width * 2);
    canvas.height = Math.ceil(rect.height * 2);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const pngUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    });
  };
  image.src = url;
}

function formatMonth(key: string, short = false) {
  const [year, month] = key.split("-").map(Number);
  return short
    ? `${MONTHS_PT[month - 1].slice(0, 3)}/${String(year).slice(2)}`
    : `${MONTHS_PT[month - 1]}/${year}`;
}

function monthName(key: string) {
  const month = Number(key.split("-")[1]);
  return MONTHS_PT[month - 1]?.toLocaleLowerCase("pt-BR") || key;
}

function segmentLabel(segment: string) {
  const normalized = segment.trim().toUpperCase();
  const aliases: Record<string, string> = {
    CONS: "Consolidadores",
    CORPRTV: "Corporativas",
    CORPORATIVAS: "Corporativas",
    OPERATORS: "Operators",
    OTAS: "OTAs",
    LC: "LC",
    GE: "GE",
    CLUB: "Club",
    ANIVERSARIO: "Aniversário",
    ANIVERSARIOAGENCIAS: "Aniversário Agências",
    PONTUAL: "Pontual",
    VENDAS: "Vendas",
  };
  return aliases[normalized] || segment;
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
  type: "percent" | "pp" = "percent",
) {
  const value = type === "pp" ? pp(current, previous) : diff(current, previous);
  if (value === null) return "sem base anterior";
  const sign = value > 0 ? "+" : "";
  return type === "pp"
    ? `${sign}${value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} p.p.`
    : `${sign}${formatPercent(value, 1)}`;
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
      grouped.set(
        row.dashboard_group,
        add(grouped.get(row.dashboard_group) || EMPTY, toMetrics(row)),
      );
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
        group: current?.group || row.dashboard_group,
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
          : name === "insights"
            ? Sparkles
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
  onCsv,
  imageTargetId,
  imageName,
}: {
  onCsv?: () => void;
  imageTargetId?: string;
  imageName?: string;
}) {
  return (
    <div className="export-actions">
      {onCsv && (
        <button type="button" onClick={onCsv} title="Exportar tabela em CSV">
          <Download aria-hidden="true" />
          CSV
        </button>
      )}
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
  const series = [
    { key: "openRate" as RateKey, label: "Abertura", color: "#7149e9" },
    { key: "ctr" as RateKey, label: "CTR", color: "#f59d20" },
    { key: "ctor" as RateKey, label: "CTOR", color: "#e8185a" },
    { key: "bounce" as RateKey, label: "Bounce", color: "#2584ff" },
  ];
  const values = months.map((month) => totalForMonth(rows, month));
  const max = Math.max(
    0.4,
    ...values.flatMap((item) => series.map((serie) => item[serie.key])),
  );
  const width = 840;
  const height = 280;
  const pad = { left: 44, right: 18, top: 22, bottom: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left + (months.length === 1 ? innerW / 2 : (index / (months.length - 1)) * innerW);
  const y = (value: number) => pad.top + innerH - (value / max) * innerH;

  return (
    <div className="chart-shell">
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} /> {item.label}
          </span>
        ))}
      </div>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Evolução mensal das principais taxas</title>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const yy = pad.top + innerH * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={pad.left} y1={yy} x2={width - pad.right} y2={yy} className="grid-line" />
              <text x={pad.left - 8} y={yy + 4} textAnchor="end" className="axis-label">
                {formatPercent(max * ratio, 0)}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => (
          <text
            key={month}
            x={x(index)}
            y={height - 12}
            textAnchor="middle"
            className="axis-label"
          >
            {formatMonth(month, true)}
          </text>
        ))}
        {series.map((serie) => {
          const points = values
            .map((item, index) => `${x(index)},${y(item[serie.key])}`)
            .join(" ");
          return (
            <g key={serie.key}>
              <polyline
                points={points}
                fill="none"
                stroke={serie.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {values.map((item, index) => (
                <circle
                  key={months[index]}
                  cx={x(index)}
                  cy={y(item[serie.key])}
                  r="4"
                  fill="#fff"
                  stroke={serie.color}
                  strokeWidth="3"
                >
                  <title>
                    {serie.label} · {formatMonth(months[index])}:{" "}
                    {formatPercent(item[serie.key])}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
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
                  background: GROUP_COLORS[item.label] || "#7149e9",
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
      aria-label="Emails enviados por classificação no mês selecionado"
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
  const labels = Array.from(
    new Set([...previous.map((item) => item.label), ...current.map((item) => item.label)]),
  );
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
          {labels.map((label) => {
            const a = current.find((item) => item.label === label)?.[metric] || 0;
            const b = previous.find((item) => item.label === label)?.[metric] || 0;
            return (
              <div className="vertical-category" key={label}>
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
                <span><i style={{ background: segmentColor(label) }} />{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [summaryMonth, setSummaryMonth] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [previousMonth, setPreviousMonth] = useState("");
  const [comparisonSegment, setComparisonSegment] = useState("ALL");
  const [trendCount, setTrendCount] = useState(6);
  const [highlights, setHighlights] = useState<CampaignHighlight[]>([]);
  const [highlightMonth, setHighlightMonth] = useState("");
  const [highlightMetric, setHighlightMetric] = useState<HighlightMetric>("open_rate");
  const [highlightMinSent, setHighlightMinSent] = useState(100);

  useEffect(() => {
    async function loadData() {
      try {
        const endpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_monthly_by_segment` +
          "?select=month_ref,month_key,dashboard_group,operational_segment,communications,emails_sent,emails_delivered,unique_opens,total_clicks,unique_clicks,unsubscribes,bounces" +
          "&order=month_ref.asc,dashboard_group.asc,operational_segment.asc";
        const highlightsEndpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_campaign_highlights` +
          "?select=month_key,campaign_name,subject,dashboard_groups,operational_segments,audience_rows,emails_sent,emails_delivered,unique_opens,unique_clicks,unsubscribes,bounces,open_rate,ctr,ctor,bounce_rate,optout_rate" +
          "&order=month_key.asc,campaign_name.asc";
        const [response, highlightsResponse] = await Promise.all([
          fetch(endpoint, {
            headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
            cache: "no-store",
          }),
          fetch(highlightsEndpoint, {
            headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
            cache: "no-store",
          }),
        ]);
        if (!response.ok) throw new Error(`Consulta indisponível (${response.status})`);
        if (!highlightsResponse.ok) throw new Error(`Consulta de destaques indisponível (${highlightsResponse.status})`);
        const payload = (await response.json()) as RawRow[];
        const highlightsPayload = (await highlightsResponse.json()) as CampaignHighlight[];
        const operational = payload.filter(
          (row) => row.operational_segment.trim().toUpperCase() !== "LATAMERS",
        );
        setRows(operational);
        setHighlights(highlightsPayload);
        const months = Array.from(new Set(operational.map((row) => row.month_key))).sort();
        const latest = months.at(-1) || "";
        const prior = months.at(-2) || latest;
        setSelectedMonth(latest);
        setSummaryMonth(latest);
        setCurrentMonth(latest);
        setPreviousMonth(prior);
        setHighlightMonth(latest);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Falha ao carregar os dados.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const months = useMemo(
    () => Array.from(new Set(rows.map((row) => row.month_key))).sort(),
    [rows],
  );
  const classificationOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => segmentLabel(row.operational_segment))),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );
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
  const selectedPrevious =
    selectedIndex > 0 ? months[selectedIndex - 1] : selectedMonth;
  const current = totalForMonth(rows, selectedMonth);
  const previous = totalForMonth(rows, selectedPrevious);
  const groups = groupRows(rows, selectedMonth);
  const segments = segmentRows(rows, selectedMonth);
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
  const compareSegmentsCurrent = segmentRows(comparisonRows, currentMonth);
  const compareSegmentsPrevious = segmentRows(comparisonRows, previousMonth);
  const semesterMonths = months.filter((month) => month >= "2026-01" && month <= "2026-06");
  const semesterRows = rows.filter((row) => semesterMonths.includes(row.month_key));
  const semesterTotal = totalForRows(semesterRows);
  const semesterAgencies = totalForRows(
    semesterRows.filter((row) => row.dashboard_group === "TRADE"),
  );
  const semesterCompanies = totalForRows(
    semesterRows.filter((row) => row.dashboard_group === "CORP"),
  );
  const semesterOthers = totalForRows(
    semesterRows.filter((row) => row.dashboard_group === "OUTROS"),
  );
  const semesterRowsByAudience = [
    { label: "Agências", note: "Trade", data: semesterAgencies },
    { label: "Empresas", note: "Corp", data: semesterCompanies },
  ];
  const semesterMainKpis = [
    { label: "Enviados", value: formatInt(semesterTotal.sent), icon: Send, tone: "env" },
    { label: "Recebidos", value: formatInt(semesterTotal.delivered), icon: MailCheck, tone: "rec" },
    { label: "Open Rate", value: formatPercent(semesterTotal.openRate), icon: Eye, tone: "or" },
    { label: "Clicks", value: formatInt(semesterTotal.clicks), icon: MousePointerClick, tone: "clk" },
    { label: "CTR", value: formatPercent(semesterTotal.ctr), icon: MoveUpRight, tone: "ctr" },
    { label: "CTOR", value: formatPercent(semesterTotal.ctor), icon: Target, tone: "ctor" },
    { label: "Bounce", value: formatPercent(semesterTotal.bounce), icon: ShieldCheck, tone: "bnc" },
    { label: "Opt-out", value: formatPercent(semesterTotal.optout), icon: Percent, tone: "opt" },
  ];
  const semesterTableMetrics = [
    { label: "Comunicados", key: "communications" as const, type: "number" },
    { label: "Enviados", key: "sent" as const, type: "number" },
    { label: "Recebidos", key: "delivered" as const, type: "number" },
    { label: "Open Rate", key: "openRate" as const, type: "rate" },
    { label: "Clicks", key: "clicks" as const, type: "number" },
    { label: "CTR", key: "ctr" as const, type: "rate" },
    { label: "CTOR", key: "ctor" as const, type: "rate" },
    { label: "Bounce", key: "bounce" as const, type: "rate", inverse: true },
    { label: "Opt-out", key: "optout" as const, type: "rate", inverse: true },
  ];
  const rateSignal = (value: number, benchmark: number, inverse = false) => {
    if (value === benchmark) return "neutral";
    const above = value > benchmark;
    return inverse ? (above ? "negative" : "positive") : above ? "positive" : "negative";
  };

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

  const kpis = buildMonthlyKpis(current, previous);
  const summaryKpis = buildMonthlyKpis(summaryTotal, summaryPrevious);
  const highlightConfig = HIGHLIGHT_METRICS[highlightMetric];
  const highlightMonthRows = highlights.filter(
    (item) =>
      item.month_key === highlightMonth &&
      num(item.emails_sent) >= highlightMinSent,
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
      item.dashboard_groups,
      item.operational_segments,
      num(item.emails_sent),
      num(item.emails_delivered),
      num(item.unique_opens),
      num(item.unique_clicks),
      formatPercent(num(item.open_rate)),
      formatPercent(num(item.ctr)),
      formatPercent(num(item.ctor)),
      formatPercent(num(item.bounce_rate)),
      formatPercent(num(item.optout_rate)),
    ]);
  const overviewSegmentCsvRows = segments.map((item) => [
    item.label,
    GROUP_LABELS[item.group] || item.group,
    item.communications,
    item.sent,
    item.delivered,
    item.opens,
    item.clicks,
    formatPercent(item.openRate),
    formatPercent(item.ctr),
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
        formatPercent(groupTotal.ctor),
        formatPercent(groupTotal.optout),
        formatPercent(groupTotal.bounce),
      ],
    ];
  });

  const clickChange = diff(compareCurrent.clicks, comparePrevious.clicks);
  const deliveryChange = pp(compareCurrent.delivery, comparePrevious.delivery);
  const openChange = pp(compareCurrent.openRate, comparePrevious.openRate);
  const ctrChange = pp(compareCurrent.ctr, comparePrevious.ctr);
  const ctorChange = pp(compareCurrent.ctor, comparePrevious.ctor);
  const communicationsChange = diff(
    compareCurrent.communications,
    comparePrevious.communications,
  );
  const comparisonSegmentLabels = Array.from(
    new Set([
      ...compareSegmentsCurrent.map((item) => item.label),
      ...compareSegmentsPrevious.map((item) => item.label),
    ]),
  );
  const segmentMovements = comparisonSegmentLabels
    .flatMap((label) => {
      const currentSegment = compareSegmentsCurrent.find((item) => item.label === label);
      const previousSegment = compareSegmentsPrevious.find((item) => item.label === label);
      if (!currentSegment || !previousSegment || !currentSegment.sent || !previousSegment.sent) {
        return [];
      }
      return [
        {
          label,
          metric: "Abertura",
          current: currentSegment.openRate,
          previous: previousSegment.openRate,
          change: pp(currentSegment.openRate, previousSegment.openRate),
        },
        {
          label,
          metric: "CTR",
          current: currentSegment.ctr,
          previous: previousSegment.ctr,
          change: pp(currentSegment.ctr, previousSegment.ctr),
        },
      ];
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  const clickDeclines = comparisonSegmentLabels
    .map((label) => {
      const currentSegment = compareSegmentsCurrent.find((item) => item.label === label);
      const previousSegment = compareSegmentsPrevious.find((item) => item.label === label);
      return {
        label,
        change:
          currentSegment && previousSegment
            ? pp(currentSegment.ctr, previousSegment.ctr)
            : 0,
      };
    })
    .filter((item) => item.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 3)
    .map((item) => item.label);
  const openingAdvances = comparisonSegmentLabels
    .map((label) => {
      const currentSegment = compareSegmentsCurrent.find((item) => item.label === label);
      const previousSegment = compareSegmentsPrevious.find((item) => item.label === label);
      return {
        label,
        change:
          currentSegment && previousSegment
            ? pp(currentSegment.openRate, previousSegment.openRate)
            : 0,
      };
    })
    .filter((item) => item.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 3)
    .map((item) => item.label);
  const journeyStages = [
    ["Enviados", "base da jornada", compareCurrent.sent, comparePrevious.sent],
    ["Recebidos", "entrega", compareCurrent.delivered, comparePrevious.delivered],
    ["Aberturas", "únicas", compareCurrent.opens, comparePrevious.opens],
    ["Cliques", "únicos", compareCurrent.clicks, comparePrevious.clicks],
  ] as const;
  const journeyMaximum = Math.max(compareCurrent.sent, comparePrevious.sent, 1);
  const volumeDelta = compareCurrent.sent - comparePrevious.sent;
  const volumeHeadline =
    compareCurrent.sent > comparePrevious.sent
      ? "Volume ampliado"
      : compareCurrent.sent < comparePrevious.sent
        ? "Volume reduzido"
        : "Volume mantido";
  const deliveryPreserved =
    deliveryChange >= 0 && compareCurrent.bounce <= comparePrevious.bounce;
  const deliveryHeadline = deliveryPreserved
    ? "Eficiência preservada"
    : deliveryChange < 0
      ? "Entrega em atenção"
      : "Eficiência de entrega alterada";
  const openingHeadline =
    Math.abs(openChange) <= 0.1
      ? "Taxa praticamente estável"
      : openChange > 0
      ? "Taxa de abertura avançou"
      : openChange < 0
        ? "Taxa de abertura recuou"
        : "Taxa de abertura mantida";
  const clickHeadline =
    clickChange !== null && clickChange < 0 && ctrChange < 0
      ? "Eficiência em queda"
      : clickChange !== null && clickChange > 0
      ? "Cliques avançaram"
      : clickChange !== null && clickChange < 0
        ? "Cliques recuaram"
        : "Cliques mantidos";
  const volumeCopy = `${formatInt(compareCurrent.sent)} emails enviados, ${
    volumeDelta >= 0 ? "acréscimo" : "redução"
  } de ${formatInt(Math.abs(volumeDelta))} sobre ${monthName(previousMonth)}.`;
  const deliveryCopy = deliveryPreserved
    ? "A taxa de entrega avançou enquanto a taxa de bounce recuou."
    : `Entrega de ${formatPercent(compareCurrent.delivery)} em ${monthName(currentMonth)} versus ${formatPercent(comparePrevious.delivery)} em ${monthName(previousMonth)}.`;
  const openingCopy = `${formatPercent(compareCurrent.openRate)} em ${monthName(currentMonth)} versus ${formatPercent(comparePrevious.openRate)} em ${monthName(previousMonth)}${
    compareCurrent.opens > comparePrevious.opens ? ", com mais volume aberto." : "."
  }`;
  const clickCopy =
    compareCurrent.clicks < comparePrevious.clicks &&
    compareCurrent.sent > comparePrevious.sent &&
    compareCurrent.opens > comparePrevious.opens
      ? "Menos cliques mesmo com crescimento de envios e aberturas."
      : `${formatInt(compareCurrent.clicks)} cliques únicos em ${monthName(currentMonth)} versus ${formatInt(comparePrevious.clicks)} em ${monthName(previousMonth)}.`;
  const setInsightMonth = (month: string) => {
    setCurrentMonth(month);
    const index = months.indexOf(month);
    setPreviousMonth(index > 0 ? months[index - 1] : month);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 44 38" aria-hidden="true">
              <path d="M3 18 40 3 28 35l-7-10-9 5 3-10-12-2Z" />
              <path d="m15 20 25-17" />
            </svg>
          </div>
          <div><strong>COMUNICAÇÃO</strong><span>LATAM</span></div>
        </div>
        <nav>
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            <NavIcon name="overview" /> Visão geral
          </button>
          <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
            <NavIcon name="summary" /> Resumo mensal
          </button>
          <button className={tab === "highlights" ? "active" : ""} onClick={() => setTab("highlights")}>
            <NavIcon name="highlights" /> Disparos Top 3
          </button>
          <button className={tab === "comparison" ? "active" : ""} onClick={() => setTab("comparison")}>
            <NavIcon name="comparison" /> Mês a mês
          </button>
          <button className={tab === "semester" ? "active" : ""} onClick={() => setTab("semester")}>
            <NavIcon name="semester" /> 1º semestre
          </button>
          <button className={tab === "insights" ? "active" : ""} onClick={() => {
            setComparisonSegment("ALL");
            setTab("insights");
          }}>
            <NavIcon name="insights" /> Insights
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          <div><strong>Base oficial conectada</strong><small>LATAMERS excluído da apresentação</small></div>
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
              {tab === "semester" && "1º semestre"}
              {tab === "highlights" && "Disparos em destaque"}
              {tab === "insights" && "Insights gerenciais"}
            </h1>
            <p>
              {tab === "overview" && "Leitura consolidada da operação e seus principais indicadores."}
              {tab === "summary" && "Visão oficial validada, organizada por Trade, Corp e Outros."}
              {tab === "comparison" && "Evolução dos KPIs oficiais entre os períodos selecionados."}
              {tab === "semester" && "Big numbers e resultados consolidados de 01/01 a 30/06."}
              {tab === "highlights" && "Top 3 melhores e piores disparos por métrica, com filtro mínimo de volume."}
              {tab === "insights" && "Leitura descritiva dos movimentos identificados nos dados oficiais."}
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
          ) : tab === "comparison" || tab === "semester" || tab === "highlights" ? (
            <span className="validated-badge"><i />Dados validados</span>
          ) : (
            <div className="insight-period">
              <label className="select-control">
                <span>Mês analisado</span>
                <select value={currentMonth} onChange={(event) => setInsightMonth(event.target.value)}>
                  {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                </select>
              </label>
              <span className="scope-pill"><i />Sem benchmark externo</span>
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
                  <SectionTitle title="Composição dos envios" subtitle={`Distribuição por grupo · ${formatMonth(selectedMonth)}`} />
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
                  <SectionTitle title="Performance por classificação" subtitle="Ordenado pelo volume de emails enviados" />
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `performance-classificacao-${selectedMonth}.csv`,
                        ["Classificação", "Grupo", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTOR", "Opt-out", "Bounce"],
                        overviewSegmentCsvRows,
                      )
                    }
                    imageTargetId="overview-table-export"
                    imageName={`performance-classificacao-${selectedMonth}.png`}
                  />
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Classificação</th><th>Grupo</th><th>Enviados</th><th>Recebidos</th><th>OR</th><th>Cliques</th><th>CTR</th><th>CTOR</th><th>Bounce</th></tr></thead>
                    <tbody>
                      {segments.map((item) => (
                        <tr key={`${item.group}-${item.label}`}>
                          <td><i style={{ background: segmentColor(item.label) }} />{item.label}</td>
                          <td>{GROUP_LABELS[item.group] || item.group}</td>
                          <td>{formatInt(item.sent)}</td>
                          <td>{formatInt(item.delivered)}</td>
                          <td>{formatPercent(item.openRate)}</td>
                          <td>{formatInt(item.clicks)}</td>
                          <td>{formatPercent(item.ctr)}</td>
                          <td>{formatPercent(item.ctor)}</td>
                          <td>{formatPercent(item.bounce)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td>Total geral</td><td>—</td><td>{formatInt(current.sent)}</td><td>{formatInt(current.delivered)}</td><td>{formatPercent(current.openRate)}</td><td>{formatInt(current.clicks)}</td><td>{formatPercent(current.ctr)}</td><td>{formatPercent(current.ctor)}</td><td>{formatPercent(current.bounce)}</td></tr></tfoot>
                  </table>
                </div>
              </article>
              <article className="panel ranking-panel" id="overview-opening-ranking-export">
                <div className="panel-head">
                  <SectionTitle title="Abertura por classificação" subtitle="Taxa de abertura sobre emails recebidos" />
                  <ExportActions imageTargetId="overview-opening-ranking-export" imageName={`ranking-abertura-${selectedMonth}.png`} />
                </div>
                <div className="ranking">
                  {[...segments].sort((a, b) => b.openRate - a.openRate).map((item) => (
                    <div key={`${item.group}-${item.label}`}>
                      <span>{item.label}</span>
                      <div><i style={{ width: `${item.openRate * 100}%`, background: segmentColor(item.label) }} /></div>
                      <strong>{formatPercent(item.openRate)}</strong>
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
                      <p>Trade, Corp e Outros em uma única tabela, com subtotais por grupo.</p>
                    </div>
                  </div>
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `resumo-mensal-unificado-${summaryMonth}.csv`,
                        ["Mês", "Grupo", "Classificação", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTOR", "Opt-out", "Bounce"],
                        summaryUnifiedCsvRows,
                      )
                    }
                    imageTargetId="summary-monthly-table-export"
                    imageName={`resumo-mensal-unificado-${summaryMonth}.png`}
                  />
                </div>
                <div className="summary-table-scroll">
                  <table className="summary-table unified-summary-table">
                    <thead>
                      <tr>
                        <th>Grupo / Classificação</th>
                        <th>Comunicados</th>
                        <th>Emails enviados</th>
                        <th>Emails recebidos</th>
                        <th>Aberturas únicas</th>
                        <th>Taxa de abertura</th>
                        <th>CTR</th>
                        <th>CTOR</th>
                        <th>OPT-OUT</th>
                        <th>Bounce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["TRADE", "CORP", "OUTROS"].map((group) => {
                        const groupTotal = summaryGroups.find((item) => item.label === group);
                        const groupSegments = summarySegments.filter((item) => item.group === group);
                        if (!groupTotal || groupSegments.length === 0) return null;
                        return (
                          <Fragment key={`${group}-section`}>
                            <tr className="summary-group-row" key={`${group}-header`}>
                              <td colSpan={10}>
                                <span style={{ background: GROUP_COLORS[group] }} />
                                {GROUP_LABELS[group] || group}
                                <small>{groupSegments.length} classificações</small>
                              </td>
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
                  title="Emails enviados por classificação"
                  subtitle={`Volume oficial apresentado em ${formatMonth(summaryMonth)}`}
                />
                <div className="panel-actions">
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `resumo-classificacoes-${summaryMonth}.csv`,
                        ["Mês", "Grupo", "Classificação", "Comunicados", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTOR", "Opt-out", "Bounce"],
                        summarySegmentCsvRows,
                      )
                    }
                    imageTargetId="summary-chart-export"
                    imageName={`envios-classificacao-${summaryMonth}.png`}
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
            <section className="semester-slide" id="semester-slide-export">
              <div className="semester-hero">
                <div>
                  <span className="summary-kicker">BIG NUMBERS · 1º SEMESTRE 2026</span>
                  <h2>Consolidado oficial de Email Marketing</h2>
                  <p>Período considerado: 01/01 a 30/06. Leitura consolidada sem LATAMERS.</p>
                </div>
                <div className="semester-hero-actions">
                  <ExportActions imageTargetId="semester-slide-export" imageName="consolidado-1-semestre.png" />
                  <div className="semester-total">
                    <span>Total de envios</span>
                    <strong>{formatInt(semesterTotal.sent)}</strong>
                    <small>{formatInt(semesterTotal.communications)} comunicados no semestre</small>
                  </div>
                </div>
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
                    <SectionTitle
                      title="Agências e Empresas"
                      subtitle="Setas comparadas ao total geral do semestre, não a uma meta externa"
                    />
                    <ExportActions
                      onCsv={() =>
                        exportCsv(
                          "consolidado-1-semestre.csv",
                          ["KPI", "Agências", "Empresas", "Total geral"],
                          semesterCsvRows,
                        )
                      }
                      imageTargetId="semester-table-export"
                      imageName="tabela-consolidado-1-semestre.png"
                    />
                  </div>
                  <table className="semester-table">
                    <thead>
                      <tr>
                        <th>KPI</th>
                        <th>Agências <span>Trade</span></th>
                        <th>Empresas <span>Corp</span></th>
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
                            const signal =
                              metric.type === "rate"
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
                      <ExportActions imageTargetId="semester-share-export" imageName="participacao-envios-1-semestre.png" />
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
                    <p>O consolidado do semestre concentra {formatInt(semesterTotal.sent)} envios, {formatInt(semesterTotal.delivered)} recebidos e {formatInt(semesterTotal.clicks)} cliques únicos.</p>
                    <p>Open Rate de {formatPercent(semesterTotal.openRate)}, CTR de {formatPercent(semesterTotal.ctr)} e CTOR de {formatPercent(semesterTotal.ctor)} calculados diretamente sobre os volumes oficiais.</p>
                  </article>
                </aside>
              </section>
            </section>
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
                  <span>Classificação</span>
                  <select value={comparisonSegment} onChange={(event) => setComparisonSegment(event.target.value)}>
                    <option value="ALL">Todas as classificações</option>
                    {classificationOptions.map((label) => <option value={label} key={label}>{label}</option>)}
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
              <HorizontalCompare title="Taxa de abertura por grupo" subtitle="Aberturas únicas sobre emails recebidos" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="openRate" exportId="comparison-open-group-export" imageName={`abertura-grupo-${previousMonth}-${currentMonth}.png`} />
              <HorizontalCompare title="CTOR por grupo" subtitle="Cliques únicos sobre aberturas únicas" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="ctor" exportId="comparison-ctor-group-export" imageName={`ctor-grupo-${previousMonth}-${currentMonth}.png`} />
            </section>
            <VerticalCompare title="CTR por classificação" subtitle="Cliques únicos sobre emails enviados" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="ctr" currentMonth={currentMonth} previousMonth={previousMonth} exportId="comparison-ctr-segment-export" imageName={`ctr-classificacao-${previousMonth}-${currentMonth}.png`} />
            <VerticalCompare title="Taxa de abertura por classificação" subtitle="Aberturas únicas sobre emails recebidos" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="openRate" currentMonth={currentMonth} previousMonth={previousMonth} exportId="comparison-open-segment-export" imageName={`abertura-classificacao-${previousMonth}-${currentMonth}.png`} />
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
                    <option value={50}>50 enviados</option>
                    <option value={100}>100 enviados</option>
                    <option value={500}>500 enviados</option>
                    <option value={1000}>1.000 enviados</option>
                  </select>
                </label>
              </div>
              <ExportActions
                onCsv={() =>
                  exportCsv(
                    `disparos-destaque-${highlightMetric}-${highlightMonth}.csv`,
                    ["Mês", "Campanha", "Assunto", "Grupo", "Classificação", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTOR", "Bounce", "Opt-out"],
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
                        {board.items.map((item, index) => (
                          <div className="highlight-item" key={`${board.tone}-${item.month_key}-${item.campaign_name}-${item.subject}-${index}`}>
                            <div className="rank-badge">{index + 1}</div>
                            <div className="highlight-main">
                              <strong>{item.campaign_name}</strong>
                              <p>{item.subject}</p>
                              <div className="highlight-tags">
                                <span>{item.dashboard_groups}</span>
                                <span>{item.operational_segments}</span>
                              </div>
                              <div className="highlight-meta">
                                <span>{formatInt(num(item.emails_sent))} enviados</span>
                                <span>{formatInt(num(item.emails_delivered))} recebidos</span>
                                <span>{formatInt(num(item.unique_opens))} aberturas</span>
                                <span>{formatInt(num(item.unique_clicks))} cliques</span>
                              </div>
                            </div>
                            <div className="highlight-rate">
                              <small>{highlightConfig.label}</small>
                              <strong>{formatPercent(num(item[highlightMetric]))}</strong>
                              <span>Bounce {formatPercent(num(item.bounce_rate))}</span>
                            </div>
                          </div>
                        ))}
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
                          ["Mês", "Campanha", "Assunto", "Grupo", "Classificação", "Enviados", "Recebidos", "Aberturas", "Cliques", "Open Rate", "CTR", "CTOR", "Bounce", "Opt-out"],
                          highlightCsvRows,
                        )
                      }
                      imageTargetId="highlight-table-export"
                      imageName={`top-bottom-disparos-${highlightMetric}-${highlightMonth}.png`}
                    />
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Campanha</th>
                          <th>Classificação</th>
                          <th>Enviados</th>
                          <th>Open Rate</th>
                          <th>CTR</th>
                          <th>CTOR</th>
                          <th>Bounce</th>
                          <th>Opt-out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedHighlights.map((item, index) => (
                          <tr key={`highlight-row-${item.campaign_name}-${item.subject}-${index}`}>
                            <td>{item.campaign_name}</td>
                            <td>{item.operational_segments}</td>
                            <td>{formatInt(num(item.emails_sent))}</td>
                            <td>{formatPercent(num(item.open_rate))}</td>
                            <td>{formatPercent(num(item.ctr))}</td>
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

        {tab === "insights" && (
          <div className="insights-view">
            <section className="insight-cards" id="insight-cards-export">
              <article className="insight-card scale">
                <div className="insight-card-head"><span className="insight-icon"><TrendingUp aria-hidden="true" /></span>Escala</div>
                <h3>{volumeHeadline}</h3>
                <p>{volumeCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.sent, comparePrevious.sent)}`}><strong>{variationLabel(compareCurrent.sent, comparePrevious.sent)}</strong><span>em envios</span></div>
              </article>
              <article className="insight-card delivery">
                <div className="insight-card-head"><span className="insight-icon"><CheckCircle2 aria-hidden="true" /></span>Entrega</div>
                <h3>{deliveryHeadline}</h3>
                <p>{deliveryCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.delivery, comparePrevious.delivery)}`}><strong>{variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}</strong><span>em entrega</span></div>
              </article>
              <article className="insight-card opening">
                <div className="insight-card-head"><span className="insight-icon"><Eye aria-hidden="true" /></span>Abertura</div>
                <h3>{openingHeadline}</h3>
                <p>{openingCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.openRate, comparePrevious.openRate)}`}><strong>{variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}</strong><span>na taxa</span></div>
              </article>
              <article className="insight-card alert">
                <div className="insight-card-head"><span className="insight-icon"><AlertTriangle aria-hidden="true" /></span>Cliques</div>
                <h3>{clickHeadline}</h3>
                <p>{clickCopy}</p>
                <div className={`insight-signal ${trendClass(compareCurrent.clicks, comparePrevious.clicks)}`}><strong>{variationLabel(compareCurrent.clicks, comparePrevious.clicks)}</strong><span>em cliques únicos</span></div>
              </article>
            </section>
            <div className="insight-export-row">
              <ExportActions imageTargetId="insight-cards-export" imageName={`cards-insights-${previousMonth}-${currentMonth}.png`} />
            </div>

            <section className="insight-main-grid">
              <article className="panel performance-journey" id="insight-journey-export">
                <div className="panel-head">
                  <SectionTitle title="Jornada de performance" subtitle={`Do envio à ação, ${formatMonth(previousMonth)} versus ${formatMonth(currentMonth)}`} />
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
                  <SectionTitle title="Diagnóstico do mês" subtitle="Leitura descritiva, sem inferência causal" />
                  <ExportActions imageTargetId="insight-diagnosis-export" imageName={`diagnostico-${previousMonth}-${currentMonth}.png`} />
                </div>
                <div className="diagnosis-list">
                  <div className={deliveryChange >= 0 ? "good" : "warn"}>
                    <strong>{deliveryChange >= 0 ? "Bom" : "Atenção"} · alcance e entrega</strong>
                    <p>Envios {variationLabel(compareCurrent.sent, comparePrevious.sent)}, recebidos {variationLabel(compareCurrent.delivered, comparePrevious.delivered)} e entrega {variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}.</p>
                  </div>
                  <div className="neutral">
                    <strong>{Math.abs(openChange) <= 0.1 ? "Manteve" : "Mudou"} · abertura</strong>
                    <p>A taxa variou {variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}; aberturas {compareCurrent.opens >= comparePrevious.opens ? "cresceram" : "recuaram"} junto com o volume.</p>
                  </div>
                  <div className={ctrChange < 0 && ctorChange < 0 ? "warn" : "good"}>
                    <strong>{ctrChange < 0 && ctorChange < 0 ? "Alerta" : "Avanço"} · ação pós-abertura</strong>
                    <p>CTR {variationLabel(compareCurrent.ctr, comparePrevious.ctr, "pp")} e CTOR {variationLabel(compareCurrent.ctor, comparePrevious.ctor, "pp")}.</p>
                  </div>
                </div>
              </aside>
            </section>

            <section className="insight-lower-grid">
              <article className="panel movements-panel">
                <div className="panel-head">
                  <SectionTitle title="Movimentos observados nos recortes" subtitle="Maiores variações absolutas entre classificações comparáveis" />
                  <ExportActions
                    onCsv={() =>
                      exportCsv(
                        `movimentos-insights-${previousMonth}-${currentMonth}.csv`,
                        ["Classificação", "KPI", formatMonth(currentMonth), formatMonth(previousMonth), "Variação p.p."],
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
                        <p>{formatPercent(movement.current)} em {formatMonth(currentMonth)} versus {formatPercent(movement.previous)} em {formatMonth(previousMonth)}.</p>
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
                  <SectionTitle title="Perguntas para decisão" subtitle="Próximas análises sustentadas pelos dados" />
                  <ExportActions imageTargetId="insight-questions-export" imageName={`perguntas-decisao-${previousMonth}-${currentMonth}.png`} />
                </div>
                <div className="questions-list">
                  <div className="question">
                    <div><span>01</span><strong>Onde a eficiência de clique mudou?</strong></div>
                    <p>{clickDeclines.length ? `Investigar as campanhas de ${clickDeclines.join(", ")}, que apresentaram os maiores recuos de CTR entre as classificações comparáveis.` : "Abrir as campanhas com maior variação de CTR para entender onde o movimento se concentrou."}</p>
                  </div>
                  <div className="question">
                    <div><span>02</span><strong>O que acompanhou o avanço de abertura?</strong></div>
                    <p>{openingAdvances.length ? `Comparar as campanhas de ${openingAdvances.join(", ")}, que registraram os maiores avanços de abertura.` : "Comparar as campanhas com maior variação de abertura entre os períodos."}</p>
                  </div>
                  <div className="question">
                    <div><span>03</span><strong>A mudança de frequência alterou a resposta?</strong></div>
                    <p>As comunicações variaram {communicationsChange === null ? "sem base comparável" : variationLabel(compareCurrent.communications, comparePrevious.communications)}. Cruzar frequência por classificação com CTR, CTOR e opt-out.</p>
                  </div>
                </div>
              </article>
            </section>

            <div className="insight-method">
              <span>Escopo gerencial · envios internos excluídos</span>
              <span>Nenhuma meta ou benchmark externo aplicado</span>
            </div>
          </div>
        )}

        <footer>
          <p><strong>Fonte:</strong> base oficial consolidada de Email Marketing · LATAMERS excluído de todos os indicadores apresentados.</p>
          <p>OR = aberturas únicas ÷ recebidos · CTR = cliques únicos ÷ enviados · CTOR = cliques únicos ÷ aberturas únicas · Bounce = bounces ÷ enviados.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
