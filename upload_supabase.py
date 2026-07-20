import argparse
import os
from pathlib import Path
from datetime import datetime, date

from load_env import load_dotenv
load_dotenv()

import pandas as pd
from supabase import create_client


COLUMN_RENAME_OVERRIDES = {
    'br_trade___gss_dessincronizacao___otas': 'br_trade_gss_dessincronizacao_otas',
    'categoria_(trade/corp)': 'categoria_trade_corp',
}


def normalize_column_name(column: str) -> str:
    normalized = (
        column.strip()
        .lower()
        .replace(' ', '_')
        .replace('-', '_')
        .replace('_%', '_pct')
        .replace('%', '_pct')
        .replace('á', 'a')
        .replace('é', 'e')
        .replace('í', 'i')
        .replace('ó', 'o')
        .replace('ú', 'u')
        .replace('ñ', 'n')
        .replace('ç', 'c')
        .replace('ã', 'a')
        .replace('õ', 'o')
        .replace('ü', 'u')
    )
    return COLUMN_RENAME_OVERRIDES.get(normalized, normalized)


def normalize_value(value):
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if hasattr(value, 'isoformat') and not isinstance(value, str):
        try:
            return value.isoformat()
        except Exception:
            pass
    if isinstance(value, (pd.Timestamp, pd.Timedelta)):
        return str(value)
    return value


def parse_percentage(value):
    if pd.isna(value) or value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace('%', '').replace(',', '.')
        if value == '':
            return None
    try:
        return float(value) / 100.0
    except Exception:
        return None


def as_int(value):
    if pd.isna(value) or value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace('.', '').replace(',', '.')
    try:
        return int(float(value))
    except Exception:
        return None


def load_excel(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    df.columns = [normalize_column_name(c) for c in df.columns]

    percent_columns = {
        'delivery_rate_pct',
        'unique_open_rate',
        'unique_click_rate',
        'unsuscribe_rate',
        'bounce_pct',
        'taxa_entrega',
        'taxa_abertura',
        'ctr',
        'taxa_bounce',
        'taxa_descadastro',
    }
    integer_columns = {
        'total_sent',
        'total_delivered',
        'unique_opens',
        'click_totales',
        'unique_clicks',
        'unsuscribe',
        'bounce',
        'enviados',
        'entregues',
        'aberturas',
        'cliques',
        'bounces',
        'descadastros',
    }
    date_columns = {'fecha_envio', 'data'}
    time_columns = {'hora_envio'}

    for col in df.columns:
        if col in percent_columns:
            df[col] = df[col].apply(parse_percentage)
        elif col in integer_columns:
            df[col] = df[col].apply(as_int)
        elif col in date_columns:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.date
        elif col in time_columns:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.time
        elif pd.api.types.is_datetime64_any_dtype(df[col]) or pd.api.types.is_timedelta64_dtype(df[col]):
            df[col] = df[col].apply(normalize_value)

    df = df.where(pd.notna(df), None)
    return df


def to_records(df: pd.DataFrame):
    records = []
    for row in df.to_dict(orient='records'):
        record = {k: normalize_value(v) for k, v in row.items()}
        records.append(record)
    return records


def build_supabase_client(url: str, key: str):
    return create_client(url, key)


def insert_records(client, table_name: str, records: list, batch_size: int = 500):
    inserted = 0
    for start in range(0, len(records), batch_size):
        batch = records[start:start + batch_size]
        response = client.table(table_name).insert(batch).execute()
        if response.error:
            raise RuntimeError(f"Supabase insert error: {response.error.message}")
        inserted += len(batch)
    return inserted


def parse_args():
    parser = argparse.ArgumentParser(description='Upload consolidated ETL data to Supabase.')
    parser.add_argument('--supabase-url', default=os.getenv('SUPABASE_URL'), help='Supabase project URL')
    parser.add_argument('--supabase-key', default=os.getenv('SUPABASE_KEY'), help='Supabase service role or anon key')
    parser.add_argument('--table', default=os.getenv('SUPABASE_TABLE', 'base_ouro_m1_a_m6'), help='Supabase table name')
    parser.add_argument('--input-file', default=os.getenv('SUPABASE_INPUT_FILE', 'Base_Ouro_M1_a_M6.xlsx'), help='Input Excel file name in outputs folder')
    parser.add_argument('--batch-size', type=int, default=500, help='Batch size for inserts')
    parser.add_argument('--dry-run', action='store_true', help='Do not upload, only preview row count and first keys')
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.supabase_url or not args.supabase_key:
        raise SystemExit('SUPABASE_URL and SUPABASE_KEY must be provided as env vars or CLI args.')

    base_path = Path(__file__).resolve().parent
    input_path = base_path / args.input_file
    if not input_path.exists():
        raise SystemExit(f'Input file not found: {input_path}')

    print(f'Loading {input_path}...')
    df = load_excel(input_path)
    records = to_records(df)
    print(f'Loaded {len(records)} records from {input_path.name}.')

    if args.dry_run:
        print('Dry run mode. Sample record:')
        print(records[0] if records else {})
        return

    client = build_supabase_client(args.supabase_url, args.supabase_key)
    print(f'Uploading to Supabase table {args.table} in batches of {args.batch_size}...')
    inserted = insert_records(client, args.table, records, batch_size=args.batch_size)
    print(f'Inserted {inserted} records into {args.table}.')


if __name__ == '__main__':
    main()
