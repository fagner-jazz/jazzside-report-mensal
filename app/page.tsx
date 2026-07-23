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
                <span>{label}</span>
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

  const volumeChange = diff(compareCurrent.sent, comparePrevious.sent);
  const clickChange = diff(compareCurrent.clicks, comparePrevious.clicks);
  const deliveryChange = pp(compareCurrent.delivery, comparePrevious.delivery);
  const openChange = pp(compareCurrent.openRate, comparePrevious.openRate);
  const ctrChange = pp(compareCurrent.ctr, comparePrevious.ctr);
  const bounceChange = pp(compareCurrent.bounce, comparePrevious.bounce);
  const topOpen = [...compareSegmentsCurrent].sort((a, b) => b.openRate - a.openRate)[0];
  const topCtr = [...compareSegmentsCurrent].sort((a, b) => b.ctr - a.ctr)[0];
  const topVolume = [...compareSegmentsCurrent].sort((a, b) => b.sent - a.sent)[0];

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
          ) : (
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
                          <td><i style={{ background: GROUP_COLORS[item.group] }} />{item.label}</td>
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
                      <div><i style={{ width: `${item.openRate * 100}%`, background: GROUP_COLORS[item.group] }} /></div>
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
            <section className="insight-hero">
              <div>
                <span className="eyebrow">LEITURA EXECUTIVA · {formatMonth(currentMonth).toUpperCase()}</span>
                <h2>O volume cresceu, enquanto a resposta de clique recuou no comparativo.</h2>
                <p>Conclusão descritiva calculada sobre os dois períodos selecionados, sem benchmark externo ou atribuição causal.</p>
              </div>
              <div className="hero-stat">
                <span>Volume enviado</span>
                <strong>{volumeChange === null ? "sem base" : variationLabel(compareCurrent.sent, comparePrevious.sent)}</strong>
                <small>{formatInt(compareCurrent.sent)} emails em {formatMonth(currentMonth)}</small>
              </div>
            </section>

            <section className="insight-cards">
              <article className="insight-card scale">
                <span>01 · ESCALA</span><h3>{variationLabel(compareCurrent.sent, comparePrevious.sent)} em envios</h3>
                <p>O período atual registrou {formatInt(compareCurrent.sent)} envios, ante {formatInt(comparePrevious.sent)} no período comparado.</p>
              </article>
              <article className="insight-card delivery">
                <span>02 · ENTREGA</span><h3>{variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}</h3>
                <p>A taxa de entrega passou de {formatPercent(comparePrevious.delivery)} para {formatPercent(compareCurrent.delivery)}.</p>
              </article>
              <article className="insight-card opening">
                <span>03 · ABERTURA</span><h3>{variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}</h3>
                <p>Foram {formatInt(compareCurrent.opens)} aberturas únicas, com OR de {formatPercent(compareCurrent.openRate)}.</p>
              </article>
              <article className="insight-card alert">
                <span>04 · CLIQUE</span><h3>{variationLabel(compareCurrent.clicks, comparePrevious.clicks)} em cliques</h3>
                <p>O CTR variou {variationLabel(compareCurrent.ctr, comparePrevious.ctr, "pp")} e o CTOR {variationLabel(compareCurrent.ctor, comparePrevious.ctor, "pp")}.</p>
              </article>
            </section>

            <section className="journey">
              <SectionTitle title="Jornada do período atual" subtitle="Conversões observadas entre as etapas medidas" />
              <div className="journey-grid">
                {[
                  ["Enviados", compareCurrent.sent, "100,00% da base enviada"],
                  ["Recebidos", compareCurrent.delivered, `${formatPercent(compareCurrent.delivery)} de entrega`],
                  ["Aberturas únicas", compareCurrent.opens, `${formatPercent(compareCurrent.openRate)} dos recebidos`],
                  ["Cliques únicos", compareCurrent.clicks, `${formatPercent(compareCurrent.ctor)} das aberturas`],
                ].map(([label, value, note], index) => (
                  <article key={String(label)}>
                    <span>0{index + 1}</span><small>{label}</small><strong>{formatInt(Number(value))}</strong><p>{note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="insight-detail-grid">
              <article className="panel narrative">
                <SectionTitle title="Leitura dos movimentos" subtitle={`${formatMonth(previousMonth)} → ${formatMonth(currentMonth)}`} />
                <div className="narrative-list">
                  <div><i className={volumeChange !== null && volumeChange >= 0 ? "up" : "down"}>01</i><p><strong>Escala:</strong> envios {variationLabel(compareCurrent.sent, comparePrevious.sent)} e recebidos {variationLabel(compareCurrent.delivered, comparePrevious.delivered)}.</p></div>
                  <div><i className={deliveryChange >= 0 ? "up" : "down"}>02</i><p><strong>Entrega:</strong> variação de {variationLabel(compareCurrent.delivery, comparePrevious.delivery, "pp")}; bounce variou {variationLabel(compareCurrent.bounce, comparePrevious.bounce, "pp")}.</p></div>
                  <div><i className={openChange >= 0 ? "up" : "down"}>03</i><p><strong>Engajamento:</strong> abertura {variationLabel(compareCurrent.openRate, comparePrevious.openRate, "pp")}, CTR {variationLabel(compareCurrent.ctr, comparePrevious.ctr, "pp")} e CTOR {variationLabel(compareCurrent.ctor, comparePrevious.ctor, "pp")}.</p></div>
                </div>
              </article>
              <article className="panel evidence">
                <SectionTitle title="Destaques observados" subtitle="Resultados do mês atual, sem inferência de causa" />
                <div className="evidence-list">
                  <div><span>Maior volume</span><strong>{topVolume?.label || "—"}</strong><small>{topVolume ? `${formatInt(topVolume.sent)} enviados` : "sem dado"}</small></div>
                  <div><span>Maior abertura</span><strong>{topOpen?.label || "—"}</strong><small>{topOpen ? formatPercent(topOpen.openRate) : "sem dado"}</small></div>
                  <div><span>Maior CTR</span><strong>{topCtr?.label || "—"}</strong><small>{topCtr ? formatPercent(topCtr.ctr) : "sem dado"}</small></div>
                </div>
              </article>
            </section>

            <article className="panel decision-panel">
              <SectionTitle title="Perguntas orientadoras para a próxima análise" subtitle="Pontos que os dados indicam para investigação — não são conclusões causais" />
              <div className="decision-grid">
                <p><span>01</span>Quais classificações concentraram a queda de {clickChange === null ? "cliques" : formatPercent(Math.abs(clickChange), 1) + " em cliques"}?</p>
                <p><span>02</span>O aumento de volume ocorreu nos mesmos segmentos com maior taxa de abertura?</p>
                <p><span>03</span>Quais campanhas explicam a variação de {Math.abs(ctrChange).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p. no CTR?</p>
                <p><span>04</span>A redução de {Math.abs(bounceChange).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p. em bounce se repete no próximo ciclo?</p>
              </div>
            </article>
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
