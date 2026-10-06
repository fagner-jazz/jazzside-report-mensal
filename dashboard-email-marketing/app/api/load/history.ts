import { supabaseRest } from "./supabase-admin";

type MonthlyBySegmentRow = {
  month_key: string;
  operational_segment: string;
  communications: number | string;
  emails_sent: number | string;
  emails_delivered: number | string;
  unique_opens: number | string;
  unique_clicks: number | string;
  unsubscribes: number | string;
  bounces: number | string;
  cta_emails_sent: number | string;
  cta_unique_clicks: number | string;
};

type CampaignMetricHistoryRow = {
  month_ref: string;
  dashboard_group: string | null;
  operational_segment: string | null;
  emails_sent: number | string;
  emails_delivered: number | string;
  unique_opens: number | string;
  unique_clicks: number | string;
  unsubscribes: number | string;
  bounces: number | string;
  has_cta: boolean | string | null;
};

export type MonthlyHistoryRow = {
  month_key: string;
  emails_sent: number;
  emails_delivered: number;
  unique_opens: number;
  unique_clicks: number;
  bounces: number;
  unsubscribes: number;
  open_rate: number;
  unique_ctr: number;
  qualified_ctr: number;
  ctor: number;
  bounce_rate: number;
  unsubscribe_rate: number;
};

function n(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function monthKeyFromRef(value: string | null | undefined) {
  return String(value || "").slice(0, 7);
}

function isInternalLatamers(segment: string | null | undefined) {
  return String(segment || "").trim().toUpperCase() === "LATAMERS";
}

function toBool(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  return ["TRUE", "T", "1", "SIM", "S", "X"].includes(String(value || "").trim().toUpperCase());
}

function toMonthlyHistory(
  entries: Iterable<[string, {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    ctaSent: number;
    ctaClicks: number;
  }]>,
  limit: number,
) {
  return Array.from(entries)
    .filter(([month_key]) => Boolean(month_key))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([month_key, item]) => ({
      month_key,
      emails_sent: item.sent,
      emails_delivered: item.delivered,
      unique_opens: item.opens,
      unique_clicks: item.clicks,
      bounces: item.bounces,
      unsubscribes: item.unsubscribes,
      open_rate: rate(item.opens, item.delivered),
      unique_ctr: rate(item.clicks, item.sent),
      qualified_ctr: rate(item.ctaClicks, item.ctaSent),
      ctor: rate(item.clicks, item.opens),
      bounce_rate: rate(item.bounces, item.sent),
      unsubscribe_rate: rate(item.unsubscribes, item.sent),
    }));
}

async function loadHistoryFromMonthlyView(limit: number): Promise<MonthlyHistoryRow[]> {
  const rows = await supabaseRest<MonthlyBySegmentRow[]>(
    "vw_email_monthly_by_segment?select=month_key,operational_segment,communications,emails_sent,emails_delivered,unique_opens,unique_clicks,unsubscribes,bounces,cta_emails_sent,cta_unique_clicks&order=month_key.desc",
  );

  const grouped = new Map<string, {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    ctaSent: number;
    ctaClicks: number;
  }>();

  rows
    .filter((row) => !isInternalLatamers(row.operational_segment))
    .forEach((row) => {
      const current = grouped.get(row.month_key) || {
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        bounces: 0,
        unsubscribes: 0,
        ctaSent: 0,
        ctaClicks: 0,
      };
      current.sent += n(row.emails_sent);
      current.delivered += n(row.emails_delivered);
      current.opens += n(row.unique_opens);
      current.clicks += n(row.unique_clicks);
      current.bounces += n(row.bounces);
      current.unsubscribes += n(row.unsubscribes);
      current.ctaSent += n(row.cta_emails_sent);
      current.ctaClicks += n(row.cta_unique_clicks);
      grouped.set(row.month_key, current);
    });

  return toMonthlyHistory(grouped.entries(), limit);
}

async function loadHistoryFromCampaignTable(limit: number): Promise<MonthlyHistoryRow[]> {
  const rows = await supabaseRest<CampaignMetricHistoryRow[]>(
    "email_marketing_campaign_metrics?select=month_ref,dashboard_group,operational_segment,emails_sent,emails_delivered,unique_opens,unique_clicks,unsubscribes,bounces,has_cta&order=month_ref.desc",
  );

  const grouped = new Map<string, {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    ctaSent: number;
    ctaClicks: number;
  }>();

  rows
    .filter((row) => !isInternalLatamers(row.operational_segment))
    .forEach((row) => {
      const monthKey = monthKeyFromRef(row.month_ref);
      const current = grouped.get(monthKey) || {
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        bounces: 0,
        unsubscribes: 0,
        ctaSent: 0,
        ctaClicks: 0,
      };
      const sent = n(row.emails_sent);
      const clicks = n(row.unique_clicks);
      current.sent += sent;
      current.delivered += n(row.emails_delivered);
      current.opens += n(row.unique_opens);
      current.clicks += clicks;
      current.bounces += n(row.bounces);
      current.unsubscribes += n(row.unsubscribes);
      if (toBool(row.has_cta)) {
        current.ctaSent += sent;
        current.ctaClicks += clicks;
      }
      grouped.set(monthKey, current);
    });

  return toMonthlyHistory(grouped.entries(), limit);
}

export async function loadMonthlyHistory(limit = 6): Promise<MonthlyHistoryRow[]> {
  try {
    return await loadHistoryFromMonthlyView(limit);
  } catch {
    return loadHistoryFromCampaignTable(limit);
  }
}
