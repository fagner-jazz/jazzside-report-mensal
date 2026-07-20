import os
import re
import unicodedata
from pathlib import Path
import pandas as pd

INPUT_FILE = Path(r"C:\Users\adm\Documents\JazzSide\Report Mensal\Bases\PLANILHA 062026 - BR - FINAL.xlsx")
OUTPUT_DIR = Path(r"C:\Users\adm\Documents\JazzSide\Report Mensal\outputs")
BASE_LIMPA_PATH = OUTPUT_DIR / "Junho_Base_Limpa_POC.xlsx"
EXTRATO_PATH = OUTPUT_DIR / "Junho_Extrato_Validacao_Classificacion.xlsx"


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
    return df


def normalize_text_for_match(value: object) -> str:
    if value is None:
        return ''
    text = str(value).strip().lower()
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def normalize_counter_series(series: pd.Series) -> pd.Series:
    def parse_value(v):
        if pd.isna(v):
            return None
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str):
            s = str(v).strip()
            if s == '':
                return None
            s = re.sub(r'[^0-9.-]', '', s)
            if s in {'', '-', '.'}:
                return None
            if s.lower() in {'nan', 'none', 'null'}:
                return None
            try:
                return int(float(s))
            except ValueError:
                return None
        return None

    return series.apply(parse_value)


def normalize_date_series(series: pd.Series) -> pd.Series:
    def parse_date(v):
        if pd.isna(v):
            return pd.NaT
        if isinstance(v, pd.Timestamp):
            return v.to_pydatetime().date()
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return pd.NaT
            try:
                dt = pd.to_datetime(s, dayfirst=True, errors='coerce')
                if pd.notna(dt):
                    return dt.date()
            except Exception:
                pass
        try:
            dt = pd.to_datetime(v, errors='coerce')
            if pd.notna(dt):
                return dt.date()
        except Exception:
            return pd.NaT
        return pd.NaT

    return series.apply(parse_date)


def find_junho_sheet(path: Path) -> str:
    xls = pd.ExcelFile(path)
    sheets = xls.sheet_names
    matches = [s for s in sheets if 'jazz' in s.lower() and 'junho' in s.lower()]
    if matches:
        return matches[0]
    return sheets[0]


def find_column(df: pd.DataFrame, terms: list[str]) -> str | None:
    normalized_terms = [normalize_text_for_match(t) for t in terms]
    normalized_cols = [normalize_text_for_match(c) for c in df.columns]
    for term in normalized_terms:
        for idx, col in enumerate(normalized_cols):
            if term in col:
                return df.columns[idx]
    return None


def build_kpis(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Padronização de colunas.
    df = normalize_column_names(df)

    # Identificação de colunas por termos.
    counter_aliases = {
        'enviados': ['total_sent', 'sent', 'enviado', 'envios', 'enviados', 'envi'],
        'entregues': ['total_delivered', 'delivered', 'entregados', 'entregues', 'entreg'],
        'aberturas': ['unique_opens', 'opens', 'aberturas', 'abert', 'aberto'],
        'cliques': ['click_totales', 'unique_clicks', 'clicks', 'click', 'clique'],
        'bounces': ['bounce', 'bounces', 'bounce_total'],
        'descadastros': ['unsubscribe', 'unsuscribe', 'descadastros', 'descad', 'descadastrados'],
    }

    def resolve_counter_column(target: str):
        return find_column(df, counter_aliases[target])

    col_enviados = resolve_counter_column('enviados')
    col_entregues = resolve_counter_column('entregues')
    col_aberturas = resolve_counter_column('aberturas')
    col_cliques = resolve_counter_column('cliques')
    col_bounces = resolve_counter_column('bounces')
    col_descadastros = resolve_counter_column('descadastros')

    # Mapeamento para nomes padronizados.
    if col_enviados is not None:
        df['enviados'] = normalize_counter_series(df[col_enviados])
    else:
        df['enviados'] = None

    if col_entregues is not None:
        df['entregues'] = normalize_counter_series(df[col_entregues])
    else:
        df['entregues'] = None

    if col_aberturas is not None:
        df['aberturas'] = normalize_counter_series(df[col_aberturas])
    else:
        df['aberturas'] = None

    if col_cliques is not None:
        df['cliques'] = normalize_counter_series(df[col_cliques])
    else:
        df['cliques'] = None

    if col_bounces is not None:
        df['bounces'] = normalize_counter_series(df[col_bounces])
    else:
        df['bounces'] = None

    if col_descadastros is not None:
        df['descadastros'] = normalize_counter_series(df[col_descadastros])
    else:
        df['descadastros'] = None

    # Datas: tenta encontrar colunas de data.
    col_data = None
    for c in df.columns:
        if 'date' in str(c).lower() or 'data' in str(c).lower() or 'fecha' in str(c).lower():
            col_data = c
            break
    if col_data is not None:
        df['data'] = normalize_date_series(df[col_data])
    else:
        df['data'] = pd.NaT

    # Classificação.
    # Prioriza explicitamente a coluna de Clasificación/Classification, não a coluna de categoria trade/corp.
    preferred_class_columns = [
        'clasificacion',
        'clasificación',
        'classification',
        'classificacao',
        'classificacao',
    ]

    col_classificacao = None
    for c in df.columns:
        normalized = normalize_text_for_match(c)
        if normalized in preferred_class_columns:
            col_classificacao = c
            break

    if col_classificacao is None:
        for c in df.columns:
            normalized = normalize_text_for_match(c)
            if 'class' in normalized and 'categoria' not in normalized:
                col_classificacao = c
                break

    if col_classificacao is None:
        for c in df.columns:
            normalized = normalize_text_for_match(c)
            if 'categoria' in normalized and 'trade' in normalized:
                continue
            if 'class' in normalized or 'categoria' in normalized or 'clas' in normalized:
                col_classificacao = c
                break

    if col_classificacao is None:
        df['classificacion'] = None
    else:
        df['classificacion'] = df[col_classificacao]

    # Conversão para numérico e KPIs.
    for col in ['enviados', 'entregues', 'aberturas', 'cliques', 'bounces', 'descadastros']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    df['taxa_entrega'] = (df['entregues'] / df['enviados']).replace([float('inf'), -float('inf')], 0).fillna(0)
    df['taxa_abertura'] = (df['aberturas'] / df['entregues']).replace([float('inf'), -float('inf')], 0).fillna(0)
    df['ctr'] = (df['cliques'] / df['entregues']).replace([float('inf'), -float('inf')], 0).fillna(0)
    df['taxa_bounce'] = (df['bounces'] / df['enviados']).replace([float('inf'), -float('inf')], 0).fillna(0)
    df['taxa_descadastro'] = (df['descadastros'] / df['entregues']).replace([float('inf'), -float('inf')], 0).fillna(0)

    return df


def format_pct(series: pd.Series) -> pd.Series:
    return series.mul(100).round(2).astype(str).str.replace('.', ',') + '%'


def build_validation_summary(df: pd.DataFrame) -> pd.DataFrame:
    # Usa a coluna Clasificación como chave de agregação, conforme solicitado.
    if 'classificacion' not in df.columns:
        raise KeyError("Coluna 'classificacion' não encontrada após a limpeza.")

    summary = (
        df.groupby('classificacion', dropna=False)
        .agg(
            enviados=('enviados', 'sum'),
            entregues=('entregues', 'sum'),
            aberturas=('aberturas', 'sum'),
            cliques=('cliques', 'sum'),
            bounces=('bounces', 'sum'),
            descadastros=('descadastros', 'sum'),
        )
        .reset_index()
    )

    summary['taxa_entrega'] = summary['entregues'] / summary['enviados']
    summary['taxa_abertura'] = summary['aberturas'] / summary['entregues']
    summary['ctr'] = summary['cliques'] / summary['entregues']
    summary['taxa_bounce'] = summary['bounces'] / summary['enviados']
    summary['taxa_descadastro'] = summary['descadastros'] / summary['entregues']

    summary['taxa_entrega_pct'] = format_pct(summary['taxa_entrega'])
    summary['taxa_abertura_pct'] = format_pct(summary['taxa_abertura'])
    summary['ctr_pct'] = format_pct(summary['ctr'])
    summary['taxa_bounce_pct'] = format_pct(summary['taxa_bounce'])
    summary['taxa_descadastro_pct'] = format_pct(summary['taxa_descadastro'])

    return summary


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sheet_name = find_junho_sheet(INPUT_FILE)
    print(f"Lendo arquivo: {INPUT_FILE.name}")
    print(f"Aba selecionada: {sheet_name}")

    df_raw = pd.read_excel(INPUT_FILE, sheet_name=sheet_name)
    df = build_kpis(df_raw)

    # Salva base limpa.
    df.to_excel(BASE_LIMPA_PATH, index=False)

    # Extrato de validação.
    summary = build_validation_summary(df)
    summary.to_excel(EXTRATO_PATH, index=False)

    print('\nExtrato de Validação - Junho')
    print(summary.to_string(index=False))

    totals = {
        'enviados': int(df['enviados'].sum()),
        'entregues': int(df['entregues'].sum()),
        'aberturas': int(df['aberturas'].sum()),
        'cliques': int(df['cliques'].sum()),
        'bounces': int(df['bounces'].sum()),
        'descadastros': int(df['descadastros'].sum()),
    }
    print('\nTotais Gerais de Junho')
    print(totals)

    print(f'\nBase limpa salva em: {BASE_LIMPA_PATH}')
    print(f'Extrato salvo em: {EXTRATO_PATH}')


if __name__ == '__main__':
    main()
