import argparse
import os
from pathlib import Path
from datetime import datetime

from load_env import load_dotenv
load_dotenv()

import pandas as pd
from supabase import create_client

DEFAULT_URL = 'https://fidfdgnnoqamhftczcer.supabase.co'
DEFAULT_TABLE = 'base_ouro_m1_a_m6'


def build_client(url: str, key: str):
    return create_client(url, key)


def load_table(client, table_name: str):
    response = client.table(table_name).select('*').execute()
    if getattr(response, 'error', None):
        raise RuntimeError(f'Supabase query error: {response.error}')
    return pd.DataFrame(response.data or [])


def format_percentage(value):
    if pd.isna(value) or value is None:
        return ''
    try:
        return f'{float(value) * 100:.2f}%'
    except Exception:
        return str(value)


def render_dashboard(df: pd.DataFrame, table_name: str, output_path: Path):
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    row_count = len(df)
    columns = df.columns.tolist()
    if row_count == 0:
        summary = '<p>No records available.</p>'
        latest_rows = '<p>No rows to display.</p>'
    else:
        summary = df.describe(include='all').to_html(classes='summary', border=0)
        latest_rows = df.head(20).to_html(index=False, classes='preview', border=0)

    html = f"""
<html>
<head>
  <meta charset='utf-8'>
  <title>Supabase Dashboard - {table_name}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; background: #f7f7f7; color: #111; }}
    h1,h2 {{ color: #0d4d8b; }}
    .card {{ background: white; padding: 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); margin-bottom: 20px; }}
    .card-grid {{ display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 16px; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.95rem; }}
    th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
    th {{ background: #0d4d8b; color: white; }}
    .small {{ color: #666; font-size: 0.9rem; }}
  </style>
</head>
<body>
  <h1>Supabase Dashboard</h1>
  <p class='small'>Project: {table_name} | Generated: {now}</p>
  <div class='card card-grid'>
    <div class='card'><h2>Total records</h2><p>{row_count}</p></div>
    <div class='card'><h2>Columns</h2><p>{len(columns)}</p></div>
    <div class='card'><h2>Last refresh</h2><p>{now}</p></div>
  </div>
  <div class='card'>
    <h2>Column list</h2>
    <p>{', '.join(columns)}</p>
  </div>
  <div class='card'>
    <h2>Top 20 rows</h2>
    {latest_rows}
  </div>
  <div class='card'>
    <h2>Summary</h2>
    {summary}
  </div>
</body>
</html>
"""
    output_path.write_text(html, encoding='utf-8')
    print(f'Dashboard written to {output_path}')


def parse_args():
    parser = argparse.ArgumentParser(description='Generate a simple HTML dashboard from Supabase table data.')
    parser.add_argument('--supabase-url', default=os.getenv('SUPABASE_URL', DEFAULT_URL))
    parser.add_argument('--supabase-key', default=os.getenv('SUPABASE_KEY'))
    parser.add_argument('--table', default=os.getenv('SUPABASE_TABLE', DEFAULT_TABLE))
    parser.add_argument('--output', default='supabase_dashboard.html')
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.supabase_key:
        raise SystemExit('Set SUPABASE_KEY or pass --supabase-key with a valid key.')

    client = build_client(args.supabase_url, args.supabase_key)
    print(f'Connecting to {args.supabase_url} table {args.table}...')
    df = load_table(client, args.table)
    print(f'Loaded {len(df)} records.')
    render_dashboard(df, args.table, Path(args.output))


if __name__ == '__main__':
    main()
