from pathlib import Path
import pandas as pd
from datetime import datetime

p = Path(r'C:/Users/adm/Documents/JazzSide/Report Mensal/outputs/Junho_Comparacao_Uniques_formatado.xlsx')
if not p.exists():
    raise SystemExit(f'File not found: {p}')

df = pd.read_excel(p)
# basic styling
css = '''
<style>
body{font-family: Arial, Helvetica, sans-serif; padding:18px;}
h1{font-size:18px}
table{border-collapse:collapse; width:100%;}
th,td{border:1px solid #ddd; padding:6px; text-align:left;}
th{background:#f3f3f3;}
</style>
'''
html = df.to_html(index=False, escape=False)
contents = f"<html><head><meta charset=\"utf-8\">{css}</head><body>"
contents += f"<h1>Comparativo Junho - cliques_unicos (gerado {datetime.now().strftime('%Y-%m-%d %H:%M')})</h1>\n"
contents += html
contents += "</body></html>"
out = p.parent / 'Junho_Comparacao_Uniques.html'
out.write_text(contents, encoding='utf-8')
print('Saved', out)
