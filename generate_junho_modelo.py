from pathlib import Path
import pandas as pd
from datetime import datetime

p = Path(r'C:/Users/adm/Documents/JazzSide/Report Mensal/outputs/Junho_Comparacao_Uniques_raw.xlsx')
if not p.exists():
    raise SystemExit(f'File not found: {p}')

df = pd.read_excel(p)
# expected columns: classificacion, comunicados, enviados, recebidos, aberturas_unicas, cliques_unicos, bounces, optouts
# normalize lowercase
df.columns = [c.strip().lower() for c in df.columns]

# ensure numeric
for col in ['enviados','recebidos','aberturas_unicas','cliques_unicos','bounces','optouts','comunicados']:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
    else:
        df[col] = 0

# compute rates
df['taxa_abertura'] = df['aberturas_unicas'] / df['recebidos'].replace({0: pd.NA})
df['ctr'] = df['cliques_unicos'] / df['recebidos'].replace({0: pd.NA})
df['ctor'] = df['cliques_unicos'] / df['aberturas_unicas'].replace({0: pd.NA})
df['optout_pct'] = df['optouts'] / df['recebidos'].replace({0: pd.NA})
df['bounce_pct'] = df['bounces'] / df['recebidos'].replace({0: pd.NA})

# formatting helpers
def fmt_int(x):
    try:
        return f"{int(x):,}".replace(',', '.')
    except:
        return '0'

def fmt_pct(x):
    if pd.isna(x):
        return ''
    return f"{x*100:0.2f}".replace('.', ',') + '%'

# build final frame with exact column names and order
out = pd.DataFrame()
out['Segmento'] = df['classificacion']
out['Comunicados'] = df['comunicados']
out['Emails Enviados'] = df['enviados']
out['Emails Recebidos'] = df['recebidos']
out['Aberturas unicas'] = df['aberturas_unicas']
out['Taxa de Abertura %'] = df['taxa_abertura']
out['CTR %'] = df['ctr']
out['CTOR %'] = df['ctor']
out['OPT-OUT %'] = df['optout_pct']
out['Bounce %'] = df['bounce_pct']

# format display
out_display = out.copy()
for c in ['Comunicados','Emails Enviados','Emails Recebidos','Aberturas unicas']:
    out_display[c] = out_display[c].map(fmt_int)
for c in ['Taxa de Abertura %','CTR %','CTOR %','OPT-OUT %','Bounce %']:
    out_display[c] = out_display[c].map(fmt_pct)

# add TOTAL row
total = {
    'Segmento': 'TOTAL',
    'Comunicados': fmt_int(out['Comunicados'].sum()),
    'Emails Enviados': fmt_int(out['Emails Enviados'].sum()),
    'Emails Recebidos': fmt_int(out['Emails Recebidos'].sum()),
    'Aberturas unicas': fmt_int(out['Aberturas unicas'].sum()),
}
# totals for rates: compute from sums
tot_receb = out['Emails Recebidos'].sum()
tot_abert = out['Aberturas unicas'].sum()
tot_clicks = df['cliques_unicos'].sum()
tot_optouts = df['OPT-OUT %'] if 'OPT-OUT %' in df.columns else df['optouts'].sum()
# compute numeric totals
try:
    total['Taxa de Abertura %'] = fmt_pct(tot_abert / tot_receb) if tot_receb>0 else ''
except:
    total['Taxa de Abertura %'] = ''
try:
    total['CTR %'] = fmt_pct(tot_clicks / tot_receb) if tot_receb>0 else ''
except:
    total['CTR %'] = ''
try:
    total['CTOR %'] = fmt_pct(tot_clicks / tot_abert) if tot_abert>0 else ''
except:
    total['CTOR %'] = ''
try:
    total['OPT-OUT %'] = fmt_pct(df['optouts'].sum() / tot_receb) if tot_receb>0 else ''
except:
    total['OPT-OUT %'] = ''
try:
    total['Bounce %'] = fmt_pct(df['bounces'].sum() / tot_receb) if tot_receb>0 else ''
except:
    total['Bounce %'] = ''

# append total
out_display = pd.concat([out_display, pd.DataFrame([total])], ignore_index=True)

# export to HTML with simple styling
css = '''<style>body{font-family:Arial,Helvetica,sans-serif;padding:18px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f3f3f3}</style>'''
html = out_display.to_html(index=False, escape=False)
contents = f"<html><head><meta charset=\"utf-8\">{css}</head><body>"
contents += f"<h1>RESUMO JUNHO/2026 - Formato Modelo (cliques_unicos) — gerado {datetime.now().strftime('%Y-%m-%d %H:%M')} </h1>\n"
contents += html
contents += "</body></html>"
out_file = p.parent / 'Junho_Modelo_Comparacao.html'
out_file.write_text(contents, encoding='utf-8')
print('Saved', out_file)
