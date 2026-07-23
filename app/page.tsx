"use client";

import { useEffect, useMemo, useState } from "react";

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
type Tab = "overview" | "comparison" | "insights";

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
  Consolidadores: "#4361EE",
  Corporativas: "#00A6A6",
  OTAs: "#F59E0B",
  Operators: "#8B5CF6",
  LC: "#EF4444",
  GE: "#22C55E",
  Club: "#EC4899",
  Aniversário: "#06B6D4",
  "Aniversário Agências": "#A16207",
  Pontual: "#64748B",
  Vendas: "#F97316",
};

const GROUP_LABELS: Record<string, string> = {
  TRADE: "Trade",
  CORP: "Corp",
  OUTROS: "Outros",
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

function formatMonth(key: string, short = false) {
  const [year, month] = key.split("-").map(Number);
  return short
    ? `${MONTHS_PT[month - 1].slice(0, 3)}/${String(year).slice(2)}`
    : `${MONTHS_PT[month - 1]}/${year}`;
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

function NavIcon({ name }: { name: Tab }) {
  if (name === "comparison") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 18V9M12 18V5M19 18v-6" />
      </svg>
    );
  }
  if (name === "insights") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-1 .8-1.5 1.7-1.5 2.5h-4c0-.8-.5-1.7-1.5-2.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  variation,
  status,
  icon,
}: {
  label: string;
  value: string;
  variation: string;
  status: string;
  icon: string;
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon icon-${icon}`}>{icon.toUpperCase()}</div>
      <div className="kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={status}>{variation} <em>vs. mês anterior</em></small>
      </div>
    </article>
  );
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
}: {
  title: string;
  subtitle: string;
  current: ReturnType<typeof groupRows>;
  previous: ReturnType<typeof groupRows>;
  metric: "openRate" | "ctor";
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
    <article className="panel compare-panel">
      <SectionTitle title={title} subtitle={subtitle} />
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

function VerticalCompare({
  title,
  subtitle,
  current,
  previous,
  metric,
  currentMonth,
  previousMonth,
}: {
  title: string;
  subtitle: string;
  current: ReturnType<typeof segmentRows>;
  previous: ReturnType<typeof segmentRows>;
  metric: "openRate" | "ctr";
  currentMonth: string;
  previousMonth: string;
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
    <article className="panel vertical-panel">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="compare-legend">
        <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
        <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
      </div>
      <div className="vertical-scroll">
        <div className="vertical-chart" style={{ minWidth: `${Math.max(760, labels.length * 92)}px` }}>
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
  const [currentMonth, setCurrentMonth] = useState("");
  const [previousMonth, setPreviousMonth] = useState("");
  const [trendCount, setTrendCount] = useState(6);

  useEffect(() => {
    async function loadData() {
      try {
        const endpoint =
          `${SUPABASE_URL}/rest/v1/vw_email_monthly_by_segment` +
          "?select=month_ref,month_key,dashboard_group,operational_segment,communications,emails_sent,emails_delivered,unique_opens,total_clicks,unique_clicks,unsubscribes,bounces" +
          "&order=month_ref.asc,dashboard_group.asc,operational_segment.asc";
        const response = await fetch(endpoint, {
          headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Consulta indisponível (${response.status})`);
        const payload = (await response.json()) as RawRow[];
        const operational = payload.filter(
          (row) => row.operational_segment.trim().toUpperCase() !== "LATAMERS",
        );
        setRows(operational);
        const months = Array.from(new Set(operational.map((row) => row.month_key))).sort();
        const latest = months.at(-1) || "";
        const prior = months.at(-2) || latest;
        setSelectedMonth(latest);
        setCurrentMonth(latest);
        setPreviousMonth(prior);
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
  const selectedIndex = months.indexOf(selectedMonth);
  const selectedPrevious =
    selectedIndex > 0 ? months[selectedIndex - 1] : selectedMonth;
  const current = totalForMonth(rows, selectedMonth);
  const previous = totalForMonth(rows, selectedPrevious);
  const groups = groupRows(rows, selectedMonth);
  const segments = segmentRows(rows, selectedMonth);
  const trendMonths = months.slice(-trendCount);
  const compareCurrent = totalForMonth(rows, currentMonth);
  const comparePrevious = totalForMonth(rows, previousMonth);
  const compareGroupsCurrent = groupRows(rows, currentMonth);
  const compareGroupsPrevious = groupRows(rows, previousMonth);
  const compareSegmentsCurrent = segmentRows(rows, currentMonth);
  const compareSegmentsPrevious = segmentRows(rows, previousMonth);

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

  const kpis = [
    {
      label: "Emails enviados",
      value: formatInt(current.sent),
      variation: variationLabel(current.sent, previous.sent),
      status: trendClass(current.sent, previous.sent),
      icon: "env",
    },
    {
      label: "Emails recebidos",
      value: formatInt(current.delivered),
      variation: variationLabel(current.delivered, previous.delivered),
      status: trendClass(current.delivered, previous.delivered),
      icon: "rec",
    },
    {
      label: "Taxa de abertura",
      value: formatPercent(current.openRate),
      variation: variationLabel(current.openRate, previous.openRate, "pp"),
      status: trendClass(current.openRate, previous.openRate),
      icon: "or",
    },
    {
      label: "Cliques únicos",
      value: formatInt(current.clicks),
      variation: variationLabel(current.clicks, previous.clicks),
      status: trendClass(current.clicks, previous.clicks),
      icon: "clk",
    },
    {
      label: "CTR",
      value: formatPercent(current.ctr),
      variation: variationLabel(current.ctr, previous.ctr, "pp"),
      status: trendClass(current.ctr, previous.ctr),
      icon: "ctr",
    },
    {
      label: "CTOR",
      value: formatPercent(current.ctor),
      variation: variationLabel(current.ctor, previous.ctor, "pp"),
      status: trendClass(current.ctor, previous.ctor),
      icon: "ctor",
    },
    {
      label: "Bounce rate",
      value: formatPercent(current.bounce),
      variation: variationLabel(current.bounce, previous.bounce, "pp"),
      status: trendClass(current.bounce, previous.bounce, true),
      icon: "bnc",
    },
  ];

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
  const volumeHeadline =
    compareCurrent.sent > comparePrevious.sent
      ? "Volume ampliado"
      : compareCurrent.sent < comparePrevious.sent
        ? "Volume reduzido"
        : "Volume mantido";
  const deliveryHeadline =
    deliveryChange > 0
      ? "Taxa de entrega avançou"
      : deliveryChange < 0
        ? "Taxa de entrega recuou"
        : "Taxa de entrega mantida";
  const openingHeadline =
    openChange > 0
      ? "Taxa de abertura avançou"
      : openChange < 0
        ? "Taxa de abertura recuou"
        : "Taxa de abertura mantida";
  const clickHeadline =
    clickChange !== null && clickChange > 0
      ? "Cliques avançaram"
      : clickChange !== null && clickChange < 0
        ? "Cliques recuaram"
        : "Cliques mantidos";
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
          <button className={tab === "comparison" ? "active" : ""} onClick={() => setTab("comparison")}>
            <NavIcon name="comparison" /> Mês a mês
          </button>
          <button className={tab === "insights" ? "active" : ""} onClick={() => setTab("insights")}>
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
              {tab === "comparison" && "Comparativo mensal"}
              {tab === "insights" && "Insights gerenciais"}
            </h1>
            <p>
              {tab === "overview" && "Leitura consolidada da operação e seus principais indicadores."}
              {tab === "comparison" && "Evolução dos KPIs oficiais entre os períodos selecionados."}
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
          ) : tab === "comparison" ? (
            <div className="period-pair">
              <label className="select-control">
                <span>Mês atual</span>
                <select value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)}>
                  {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                </select>
              </label>
              <span className="versus">vs.</span>
              <label className="select-control">
                <span>Mês anterior</span>
                <select value={previousMonth} onChange={(event) => setPreviousMonth(event.target.value)}>
                  {months.map((month) => <option value={month} key={month}>{formatMonth(month)}</option>)}
                </select>
              </label>
            </div>
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
              <article className="panel trend-panel">
                <div className="panel-head">
                  <SectionTitle title="Evolução das principais métricas" subtitle="Taxas recalculadas a partir dos volumes oficiais" />
                  <select value={trendCount} onChange={(event) => setTrendCount(Number(event.target.value))}>
                    <option value={6}>Últimos 6 meses</option>
                    <option value={12}>Últimos 12 meses</option>
                  </select>
                </div>
                <TrendChart rows={rows} months={trendMonths} />
              </article>
              <article className="panel composition-panel">
                <SectionTitle title="Composição dos envios" subtitle={`Distribuição por grupo · ${formatMonth(selectedMonth)}`} />
                <div className="composition-total">
                  <span>Total apresentado</span>
                  <strong>{formatInt(current.sent)}</strong>
                  <small>emails enviados</small>
                </div>
                <CompositionChart data={groups} total={current.sent} />
              </article>
            </section>

            <section className="detail-grid">
              <article className="panel table-panel">
                <SectionTitle title="Performance por classificação" subtitle="Ordenado pelo volume de emails enviados" />
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
              <article className="panel ranking-panel">
                <SectionTitle title="Abertura por classificação" subtitle="Taxa de abertura sobre emails recebidos" />
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

        {tab === "comparison" && (
          <>
            <section className="comparison-kpis">
              {[
                ["Emails enviados", compareCurrent.sent, comparePrevious.sent, false],
                ["Emails recebidos", compareCurrent.delivered, comparePrevious.delivered, false],
                ["Taxa de abertura", compareCurrent.openRate, comparePrevious.openRate, true],
                ["Cliques únicos", compareCurrent.clicks, comparePrevious.clicks, false],
                ["CTR", compareCurrent.ctr, comparePrevious.ctr, true],
                ["CTOR", compareCurrent.ctor, comparePrevious.ctor, true],
                ["Bounce rate", compareCurrent.bounce, comparePrevious.bounce, true],
              ].map(([label, a, b, isRate]) => (
                <article className="comparison-kpi" key={String(label)}>
                  <span>{label}</span>
                  <div className="compare-values">
                    <strong>{isRate ? formatPercent(Number(a)) : formatInt(Number(a))}</strong>
                    <em>{isRate ? formatPercent(Number(b)) : formatInt(Number(b))}</em>
                  </div>
                  <small className={trendClass(Number(a), Number(b), label === "Bounce rate")}>
                    {variationLabel(Number(a), Number(b), isRate ? "pp" : "percent")}
                  </small>
                </article>
              ))}
            </section>

            <article className="panel volume-panel">
              <div className="panel-head">
                <SectionTitle title="Volume mensal comparado" subtitle="Enviados, recebidos, aberturas e cliques únicos" />
                <div className="compare-legend">
                  <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
                  <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
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
              <HorizontalCompare title="Taxa de abertura por grupo" subtitle="Aberturas únicas sobre emails recebidos" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="openRate" />
              <HorizontalCompare title="CTOR por grupo" subtitle="Cliques únicos sobre aberturas únicas" current={compareGroupsCurrent} previous={compareGroupsPrevious} metric="ctor" />
            </section>
            <VerticalCompare title="CTR por classificação" subtitle="Cliques únicos sobre emails enviados" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="ctr" currentMonth={currentMonth} previousMonth={previousMonth} />
            <VerticalCompare title="Taxa de abertura por classificação" subtitle="Aberturas únicas sobre emails recebidos" current={compareSegmentsCurrent} previous={compareSegmentsPrevious} metric="openRate" currentMonth={currentMonth} previousMonth={previousMonth} />
          </>
        )}

        {tab === "insights" && (
          <>
            <section className="insight-cards">
              <article className="insight-card scale">
                <div className="insight-card-head"><span className="insight-icon">↗</span>Escala</div>
                <h3>{volumeHeadline}</h3>
                <p>{formatInt(compareCurrent.sent)} emails enviados, ante {formatInt(comparePrevious.sent)} em {formatMonth(previousMonth)}.</p>
                <div className={`insight-signal ${trendClass(compareCurrent.sent, comparePrevious.sent)}`}><strong>{variationLabel(compareCurrent.sent, comparePrevious.sent)}</strong><span>em envios</span></div>
              </article>
              <article className="insight-card delivery">
                <div className="insight-card-head"><span className="insight-icon">✓</span>Entrega</div>
                <h3>{deliveryHeadline}</h3>
                <p>{formatPercent(compareCurrent.delivery)} no mês atual versus {formatPercent(comparePrevious.delivery)} no comparativo.</p>
                <div className={`insight-signal ${trendClass(compareCurrent.delivery, comparePrevious.delivery)}`}><strong>{variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}</strong><span>em entrega</span></div>
              </article>
              <article className="insight-card opening">
                <div className="insight-card-head"><span className="insight-icon">◎</span>Abertura</div>
                <h3>{openingHeadline}</h3>
                <p>{formatPercent(compareCurrent.openRate)} no mês atual versus {formatPercent(comparePrevious.openRate)} no comparativo.</p>
                <div className={`insight-signal ${trendClass(compareCurrent.openRate, comparePrevious.openRate)}`}><strong>{variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}</strong><span>na taxa</span></div>
              </article>
              <article className="insight-card alert">
                <div className="insight-card-head"><span className="insight-icon">!</span>Cliques</div>
                <h3>{clickHeadline}</h3>
                <p>{formatInt(compareCurrent.clicks)} cliques únicos no mês atual versus {formatInt(comparePrevious.clicks)} no comparativo.</p>
                <div className={`insight-signal ${trendClass(compareCurrent.clicks, comparePrevious.clicks)}`}><strong>{variationLabel(compareCurrent.clicks, comparePrevious.clicks)}</strong><span>em cliques únicos</span></div>
              </article>
            </section>

            <section className="insight-main-grid">
              <article className="panel performance-journey">
                <div className="panel-head">
                  <SectionTitle title="Jornada de performance" subtitle={`Do envio à ação, ${formatMonth(previousMonth)} versus ${formatMonth(currentMonth)}`} />
                  <div className="compare-legend">
                    <span><i className="dot-current" />{formatMonth(currentMonth)}</span>
                    <span><i className="dot-previous" />{formatMonth(previousMonth)}</span>
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
              <aside className="panel diagnosis-panel">
                <SectionTitle title="Diagnóstico do mês" subtitle="Leitura descritiva, sem inferência causal" />
                <div className="diagnosis-list">
                  <div className={deliveryChange >= 0 ? "good" : "warn"}>
                    <strong>{deliveryChange >= 0 ? "Avanço" : "Recuo"} · alcance e entrega</strong>
                    <p>Envios {variationLabel(compareCurrent.sent, comparePrevious.sent)}, recebidos {variationLabel(compareCurrent.delivered, comparePrevious.delivered)} e entrega {variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}.</p>
                  </div>
                  <div className="neutral">
                    <strong>Abertura · variação observada</strong>
                    <p>A taxa variou {variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}; as aberturas únicas variaram {variationLabel(compareCurrent.opens, comparePrevious.opens)}.</p>
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
                <SectionTitle title="Movimentos observados nos recortes" subtitle="Maiores variações absolutas entre classificações comparáveis" />
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

              <article className="panel questions-panel">
                <SectionTitle title="Perguntas para decisão" subtitle="Próximas análises sustentadas pelos dados" />
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
          </>
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
