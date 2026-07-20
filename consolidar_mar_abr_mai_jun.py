import re
import unicodedata
from pathlib import Path
import pandas as pd

BASE_DIR = Path(r"C:\Users\adm\Documents\JazzSide\Report Mensal")
BASES_DIR = BASE_DIR / "Bases"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    ("01", "PLANILHA 012026 - BR - FINAL.xlsx", "janeiro"),
    ("02", "PLANILHA 022026 - BR - FINAL.xlsx", "fevereiro"),
    ("03", "PLANILHA 032026 - BR - FINAL.xlsx", "março"),
    ("04", "PLANILHA 042026 - BR - FINAL.xlsx", "abril"),
    ("05", "PLANILHA 052026 - BR - FINAL.xlsx", "maio"),
    ("06", "PLANILHA 062026 - BR - FINAL.xlsx", "junho"),
]


def normalize_text_for_match(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df


def normalize_counter_series(series: pd.Series) -> pd.Series:
    def parse_value(v):
        if pd.isna(v):
            return None
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str):
            s = str(v).strip()
            if s == "":
                return None
            s = re.sub(r"[^0-9.-]", "", s)
            if s in {"", "-", "."}:
                return None
            if s.lower() in {"nan", "none", "null"}:
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
                dt = pd.to_datetime(s, dayfirst=True, errors="coerce")
                if pd.notna(dt):
                    return dt.date()
            except Exception:
                pass
        try:
            dt = pd.to_datetime(v, errors="coerce")
            if pd.notna(dt):
                return dt.date()
        except Exception:
            return pd.NaT
        return pd.NaT

    return series.apply(parse_date)


def find_sheet(path: Path, month_name: str) -> str:
    xls = pd.ExcelFile(path)
    sheet_names = xls.sheet_names
    matches = [s for s in sheet_names if "jazz" in s.lower() and month_name in s.lower()]
    if matches:
        return matches[0]
    return sheet_names[0]


def find_column(df: pd.DataFrame, terms: list[str]) -> str | None:
    normalized_terms = [normalize_text_for_match(t) for t in terms]
    normalized_cols = [normalize_text_for_match(c) for c in df.columns]
    for term in normalized_terms:
        for idx, col in enumerate(normalized_cols):
            if term in col:
                return df.columns[idx]
    return None


def resolve_classification_column(df: pd.DataFrame) -> str | None:
    preferred = ["clasificacion", "clasificación", "classification", "classificacao"]
    for c in df.columns:
        if normalize_text_for_match(c) in preferred:
            return c
    for c in df.columns:
        normalized = normalize_text_for_match(c)
        if "class" in normalized and "categoria" not in normalized:
            return c
    return None


def build_clean_frame(path: Path, month_name: str) -> pd.DataFrame:
    sheet_name = find_sheet(path, month_name)
    df = pd.read_excel(path, sheet_name=sheet_name)
    df = normalize_column_names(df)

    counter_aliases = {
        "enviados": ["total_sent", "sent", "enviado", "envios", "enviados", "envi"],
        "entregues": ["total_delivered", "delivered", "entregados", "entregues", "entreg"],
        "aberturas": ["unique_opens", "opens", "aberturas", "abert", "aberto"],
        "cliques": ["click_totales", "unique_clicks", "clicks", "click", "clique"],
        "bounces": ["bounce", "bounces", "bounce_total"],
        "descadastros": ["unsubscribe", "unsuscribe", "descadastros", "descad", "descadastrados"],
    }

    def resolve_counter_column(target: str):
        return find_column(df, counter_aliases[target])

    for target in ["enviados", "entregues", "aberturas", "cliques", "bounces", "descadastros"]:
        col = resolve_counter_column(target)
        if col is None:
            df[target] = None
        else:
            df[target] = normalize_counter_series(df[col])

    # Datas
    date_col = None
    for c in df.columns:
        normalized = normalize_text_for_match(c)
        if "date" in normalized or "data" in normalized or "fecha" in normalized:
            date_col = c
            break
    if date_col is not None:
        df["data"] = normalize_date_series(df[date_col])
    else:
        df["data"] = pd.NaT

    # Classificação: usar exclusivamente a coluna de classificação.
    class_col = resolve_classification_column(df)
    if class_col is None:
        df["classificacion"] = None
    else:
        df["classificacion"] = df[class_col]

    # Conversão numérica e KPIs
    for col in ["enviados", "entregues", "aberturas", "cliques", "bounces", "descadastros"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    df["taxa_entrega"] = (df["entregues"] / df["enviados"]).replace([float("inf"), -float("inf")], 0).fillna(0)
    df["taxa_abertura"] = (df["aberturas"] / df["entregues"]).replace([float("inf"), -float("inf")], 0).fillna(0)
    df["ctr"] = (df["cliques"] / df["entregues"]).replace([float("inf"), -float("inf")], 0).fillna(0)
    df["taxa_bounce"] = (df["bounces"] / df["enviados"]).replace([float("inf"), -float("inf")], 0).fillna(0)
    df["taxa_descadastro"] = (df["descadastros"] / df["entregues"]).replace([float("inf"), -float("inf")], 0).fillna(0)

    df["mes"] = month_name
    return df


def format_pct(series: pd.Series) -> pd.Series:
    return series.mul(100).round(2).astype(str).str.replace(".", ",") + "%"


def build_summary(consolidated: pd.DataFrame) -> pd.DataFrame:
    summary = (
        consolidated.groupby("classificacion", dropna=False)
        .agg(
            enviados=("enviados", "sum"),
            entregues=("entregues", "sum"),
            aberturas=("aberturas", "sum"),
            cliques=("cliques", "sum"),
            bounces=("bounces", "sum"),
            descadastros=("descadastros", "sum"),
        )
        .reset_index()
    )
    summary["taxa_entrega"] = summary["entregues"] / summary["enviados"]
    summary["taxa_abertura"] = summary["aberturas"] / summary["entregues"]
    summary["ctr"] = summary["cliques"] / summary["entregues"]
    summary["taxa_bounce"] = summary["bounces"] / summary["enviados"]
    summary["taxa_descadastro"] = summary["descadastros"] / summary["entregues"]

    summary["taxa_entrega_pct"] = format_pct(summary["taxa_entrega"])
    summary["taxa_abertura_pct"] = format_pct(summary["taxa_abertura"])
    summary["ctr_pct"] = format_pct(summary["ctr"])
    summary["taxa_bounce_pct"] = format_pct(summary["taxa_bounce"])
    summary["taxa_descadastro_pct"] = format_pct(summary["taxa_descadastro"])
    return summary


def main():
    frames = []
    for month_num, file_name, month_name in FILES:
        path = BASES_DIR / file_name
        print(f"Processando {file_name} -> aba {find_sheet(path, month_name)}")
        frame = build_clean_frame(path, month_name)
        frames.append(frame)

    consolidated = pd.concat(frames, ignore_index=True)
    consolidated.to_excel(OUTPUT_DIR / "Base_Ouro_M1_a_M6.xlsx", index=False)

    summary = build_summary(consolidated)
    summary.to_excel(OUTPUT_DIR / "Extrato_Consolidado_M1_a_M6.xlsx", index=False)

    print("\nExtrato Consolidado M1 a M6")
    print(summary.to_string(index=False))

    print("\nTotais consolidados")
    print({
        "enviados": int(consolidated["enviados"].sum()),
        "entregues": int(consolidated["entregues"].sum()),
        "aberturas": int(consolidated["aberturas"].sum()),
        "cliques": int(consolidated["cliques"].sum()),
        "bounces": int(consolidated["bounces"].sum()),
        "descadastros": int(consolidated["descadastros"].sum()),
    })

    print(f"\nBase salva em: {OUTPUT_DIR / 'Base_Ouro_M1_a_M6.xlsx'}")
    print(f"Extrato salvo em: {OUTPUT_DIR / 'Extrato_Consolidado_M1_a_M6.xlsx'}")


if __name__ == "__main__":
    main()
