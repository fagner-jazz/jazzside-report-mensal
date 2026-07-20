import os
import re
from pathlib import Path
from typing import List

import pandas as pd

BASE_DIR = Path(r"C:\Users\adm\Documents\JazzSide\Report Mensal")
BASES_DIR = BASE_DIR / "Bases"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_FILE = OUTPUT_DIR / "Historico_Consolidado_LIMPO.xlsx"

MONTHS = [
    ("01", "janeiro"),
    ("02", "fevereiro"),
    ("03", "março"),
    ("04", "abril"),
    ("05", "maio"),
    ("06", "junho"),
]

FILE_NAME_HINTS = {
    "01": "012026",
    "02": "022026",
    "03": "032026",
    "04": "042026",
    "05": "052026",
    "06": "062026",
}

COUNTER_COLUMNS = [
    "enviados",
    "entregues",
    "aberturas",
    "cliques",
    "bounces",
    "descadastros",
]

COUNTER_ALIAS_MAP = {
    "enviados": ["enviados", "total_sent", "total sent", "sent", "total_sents", "totalenviados"],
    "entregues": ["entregues", "total_delivered", "total delivered", "delivered", "delivered_total", "entregas"],
    "aberturas": ["aberturas", "unique_opens", "unique opens", "opens", "open", "aberturas_unicas"],
    "cliques": ["cliques", "unique_clicks", "unique clicks", "clicks", "click", "clics"],
    "bounces": ["bounces", "bounce", "bounces_total", "bounce_total", "bounces_count"],
    "descadastros": ["descadastros", "unsubscribe", "unsubscribes", "unsuscribe", "unsuscribe_total", "descadastrados"],
}

# Colunas esperadas como fallback para identificar a aba correta e localizar dados do mês.
POSSIBLE_CLASSIFICATION_COLUMNS = [
    "classificacao",
    "classificacion",
    "classification",
    "clasificación",
    "categoria",
    "segmento",
    "clasificación",
]

POSSIBLE_DATE_COLUMNS = [
    "data",
    "date",
    "data_envio",
    "data_da_campanha",
    "data_campanha",
    "data_inicio",
    "dt_envio",
    "fecha_envío",
    "fecha_envio",
    "fecha",
]

POSSIBLE_CAMPAIGN_COLUMNS = [
    "campanha",
    "campaign",
    "nome_campanha",
    "nome_da_campanha",
    "campaign_name",
    "nombre campaña",
    "nombre_campaña",
    "nombre campaña",
]


def normalize_counter_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Remove pontos e vírgulas, preservando sinais negativos
        s = s.replace('.', '').replace(',', '').replace(' ', '')
        if s in {'', 'nan', 'NaN', 'none', 'None'}:
            return None
        try:
            return int(float(s))
        except ValueError:
            return None
    return None


def normalize_date_value(value, month_name: str, campaign_name: str = ""):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, (int, float)):
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return s
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", s):
            try:
                pd_dt = pd.to_datetime(s, format='%m/%d/%Y', errors='coerce')
                if pd.notna(pd_dt):
                    return pd_dt.date().isoformat()
            except Exception:
                pass
        if re.fullmatch(r"\d{4}/\d{2}/\d{2}", s):
            try:
                pd_dt = pd.to_datetime(s, format='%Y/%m/%d', errors='coerce')
                if pd.notna(pd_dt):
                    return pd_dt.date().isoformat()
            except Exception:
                pass
        if re.fullmatch(r"\d{1,2}-\d{1,2}-\d{4}", s):
            try:
                pd_dt = pd.to_datetime(s, format='%d-%m-%Y', errors='coerce')
                if pd.notna(pd_dt):
                    return pd_dt.date().isoformat()
            except Exception:
                pass
        # Se para o mês respectivo, tenta inferir com base no nome da campanha ou no mês.
        try:
            # Tenta parsear como texto do tipo '1/2/2026' e similar.
            pd_dt = pd.to_datetime(s, errors='coerce')
            if pd.notna(pd_dt):
                return pd_dt.date().isoformat()
        except Exception:
            pass

        # fallback conservador: usa o primeiro dia do mês correspondente
        try:
            year = int(re.search(r'(20\d{2})', campaign_name or '') or 0)
        except Exception:
            year = None
        if year is None:
            year = 2026
        month_num = None
        for m_num, m_name in MONTHS:
            if m_name in month_name.lower() or month_name.lower().startswith(m_name[:3]):
                month_num = int(m_num)
                break
        if month_num is None:
            month_num = 1
        return f"{year:04d}-{month_num:02d}-01"
    return None


def find_sheet_for_month(excel_file: str, month_num: str) -> str:
    xls = pd.ExcelFile(excel_file)
    sheet_names = xls.sheet_names
    month_name = next(name for _, name in MONTHS if _ == month_num)

    # Preferência por abas que contenham 'JAZZ' e o mês correspondente.
    candidates = []
    for sheet in sheet_names:
        s = sheet.lower()
        if 'jazz' in s and month_name.lower() in s:
            candidates.append(sheet)
    if candidates:
        return candidates[0]

    # Fallback: abas que contenham 'jazz' e/ou o mês numérico da referência.
    for sheet in sheet_names:
        s = sheet.lower()
        if 'jazz' in s and month_num in sheet:
            return sheet
    for sheet in sheet_names:
        if month_name.lower() in sheet.lower():
            return sheet
    for sheet in sheet_names:
        if 'planilha' in sheet.lower() and month_num in sheet:
            return sheet
    return sheet_names[0]


def infer_classification_column(df: pd.DataFrame) -> str:
    for col in POSSIBLE_CLASSIFICATION_COLUMNS:
        if col in df.columns:
            return col
    for col in df.columns:
        if 'class' in str(col).lower():
            return col
    return None


def infer_date_column(df: pd.DataFrame) -> str:
    for col in POSSIBLE_DATE_COLUMNS:
        if col in df.columns:
            return col
    for col in df.columns:
        if 'date' in str(col).lower() or 'data' in str(col).lower() or 'fecha' in str(col).lower():
            return col
    return None


def infer_campaign_column(df: pd.DataFrame) -> str:
    for col in POSSIBLE_CAMPAIGN_COLUMNS:
        if col in df.columns:
            return col
    for col in df.columns:
        if 'camp' in str(col).lower() or 'campaign' in str(col).lower():
            return col
    return None


def map_counter_columns(df: pd.DataFrame) -> dict:
    mapped = {}
    for target, aliases in COUNTER_ALIAS_MAP.items():
        for col in df.columns:
            col_norm = str(col).strip().lower().replace(' ', '_')
            if col_norm in aliases:
                mapped[target] = col
                break
        if target in mapped:
            continue
        # Fallback: procura por substrings nos nomes.
        for col in df.columns:
            col_norm = str(col).strip().lower().replace(' ', '_')
            for alias in aliases:
                if alias in col_norm:
                    mapped[target] = col
                    break
            if target in mapped:
                break
    return mapped


def normalize_dataframe(df: pd.DataFrame, month_name: str, month_num: str) -> pd.DataFrame:
    df = df.copy()

    # Tenta localizar colunas chave de forma flexível.
    classification_col = infer_classification_column(df)
    date_col = infer_date_column(df)
    campaign_col = infer_campaign_column(df)

    # Padroniza nomes de colunas para o processo.
    rename_map = {}
    if classification_col and classification_col != 'classificacion':
        rename_map[classification_col] = 'classificacion'
    if date_col and date_col != 'data_campanha':
        rename_map[date_col] = 'data_campanha'
    if campaign_col and campaign_col != 'nome_campanha':
        rename_map[campaign_col] = 'nome_campanha'
    df.rename(columns=rename_map, inplace=True)

    # Garante colunas básicas.
    if 'classificacion' not in df.columns:
        df['classificacion'] = None
    if 'data_campanha' not in df.columns:
        df['data_campanha'] = None
    if 'nome_campanha' not in df.columns:
        df['nome_campanha'] = None

    # Converte colunas de contadores para strings e depois int, eliminando pontos e vírgulas.
    mapping = map_counter_columns(df)
    for col in COUNTER_COLUMNS:
        source_col = mapping.get(col)
        if source_col:
            df[col] = df[source_col].apply(normalize_counter_value)
        else:
            df[col] = None

    # Normaliza datas.
    df['data_campanha'] = df['data_campanha'].apply(lambda x: normalize_date_value(x, month_name, str(df['nome_campanha'].iloc[0]) if not df['nome_campanha'].empty else ''))

    # Adiciona metadados do mês.
    df['mes'] = month_name
    df['mes_num'] = month_num

    # Trata valores inconsistentes de KPI com lógica validada.
    for col in ['enviados', 'entregues', 'aberturas', 'cliques']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype('Int64')

    if 'entregues' in df.columns:
        df['entregues'] = df[['entregues', 'enviados']].min(axis=1)
    if 'aberturas' in df.columns:
        df['aberturas'] = df[['aberturas', 'entregues']].min(axis=1)
    if 'cliques' in df.columns:
        df['cliques'] = df[['cliques', 'entregues']].min(axis=1)

    # Recalcula taxas a partir de contadores inteiros.
    df['ctr'] = None
    df['taxa_abertura'] = None
    for idx, row in df.iterrows():
        entregues = row['entregues'] if pd.notna(row['entregues']) else 0
        cliques = row['cliques'] if pd.notna(row['cliques']) else 0
        aberturas = row['aberturas'] if pd.notna(row['aberturas']) else 0
        if entregues:
            df.at[idx, 'ctr'] = round(cliques / entregues * 100, 4) if pd.notna(cliques) else None
            df.at[idx, 'taxa_abertura'] = round(aberturas / entregues * 100, 4) if pd.notna(aberturas) else None
        else:
            df.at[idx, 'ctr'] = None
            df.at[idx, 'taxa_abertura'] = None

    return df


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frames: List[pd.DataFrame] = []

    for month_num, month_name in MONTHS:
        hint = FILE_NAME_HINTS[month_num]
        matches = [p for p in BASES_DIR.glob('*.xlsx') if hint in p.name]
        if not matches:
            print(f"Arquivo não encontrado para {month_name}: {hint}")
            continue
        file_path = matches[0]
        file_name = file_path.name

        sheet_name = find_sheet_for_month(str(file_path), month_num)
        print(f"Processando {file_name} -> aba {sheet_name}")

        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        except Exception as exc:
            print(f"Falha ao ler {file_name}: {exc}")
            continue

        if df.empty:
            print(f"Planilha vazia: {file_name}")
            continue

        df = normalize_dataframe(df, month_name, month_num)
        frames.append(df)

    if not frames:
        raise RuntimeError("Nenhum arquivo foi processado.")

    consolidated = pd.concat(frames, ignore_index=True)

    # Resumo por classificação.
    summary = (
        consolidated.groupby('classificacion', dropna=False)
        .agg(
            enviados=('enviados', 'sum'),
            entregues=('entregues', 'sum'),
            aberturas=('aberturas', 'sum'),
            cliques=('cliques', 'sum'),
            campanhas=('nome_campanha', 'nunique'),
        )
        .reset_index()
    )

    # Mantém as colunas de metadados e inclui o resumo em uma planilha separada.
    with pd.ExcelWriter(OUTPUT_FILE) as writer:
        consolidated.to_excel(writer, sheet_name='Historico_Consolidado', index=False)
        summary.to_excel(writer, sheet_name='Resumo_Por_Classificacao', index=False)

    print("\nSoma total de ENVIADOS e ENTREGUES dos 6 meses:")
    print(f"ENVIADOS: {int(consolidated['enviados'].fillna(0).sum())}")
    print(f"ENTREGUES: {int(consolidated['entregues'].fillna(0).sum())}")
    print(f"Arquivo salvo em: {OUTPUT_FILE}")


if __name__ == '__main__':
    from datetime import datetime
    main()
