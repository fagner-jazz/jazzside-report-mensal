import pandas as pd
from pathlib import Path
p=Path(r'C:/Users/adm/Documents/JazzSide/Report Mensal/outputs/Junho_Base_Limpa_POC.xlsx')
df=pd.read_excel(p)
# normalize
cols=[c.strip().lower().replace(' ','_') for c in df.columns]
df.columns=cols
print('Columns:', cols)
# helper
def find(cols, patterns):
    for c in cols:
        for p in patterns:
            if p in c:
                return c
    return None

ent_col=find(cols,['entreg','deliv','delivered','receb'])
sent_col=find(cols,['envi','sent'])
unique_open_col=find(cols,['abert','unique_open','unique_op','uniqueopens','uniqueopen'])
unique_click_col=find(cols,['unique_click','clique_unico','cliques_unicos','unique_clicks','unique_click_count','click_unico','cliquesunicos'])
clicks_col=find(cols,['clicks','click_total','click'])
bounce_col=find(cols,['bounc'])
optout_col=find(cols,['opt','unsu','unsub','optout','opt_out'])
comunicado_col=find(cols,['comunicad','campaign','assunto','subject','id'])
print('Detected:',{'sent':sent_col,'delivered':ent_col,'unique_open':unique_open_col,'unique_click':unique_click_col,'clicks':clicks_col,'bounce':bounce_col,'optout':optout_col,'comunicado':comunicado_col})
# numeric cleanup
import re

def to_int_series(s):
    return s.fillna(0).astype(str).str.replace(r'[^0-9]','',regex=True).replace('', '0').astype(int)

if ent_col: df[ent_col]=to_int_series(df[ent_col])
if sent_col: df[sent_col]=to_int_series(df[sent_col])
if unique_open_col: df[unique_open_col]=to_int_series(df[unique_open_col])
if unique_click_col: df[unique_click_col]=to_int_series(df[unique_click_col])
elif clicks_col: df[clicks_col]=to_int_series(df[clicks_col])
if bounce_col: df[bounce_col]=to_int_series(df[bounce_col])
if optout_col: df[optout_col]=to_int_series(df[optout_col])

# group
if 'classificacion' not in df.columns:
    raise SystemExit('classificacion column not found')

group=df.groupby('classificacion', dropna=False)

agg_dict={}
if sent_col:
    agg_dict['enviados']=(sent_col,'sum')
else:
    agg_dict['enviados']=(df.columns[0],'count')
if ent_col:
    agg_dict['recebidos']=(ent_col,'sum')
else:
    agg_dict['recebidos']=(df.columns[0],'count')
if unique_open_col:
    agg_dict['aberturas_unicas']=(unique_open_col,'sum')
else:
    agg_dict['aberturas_unicas']=(df.columns[0],'count')
if unique_click_col:
    agg_dict['cliques_unicos']=(unique_click_col,'sum')
elif clicks_col:
    agg_dict['cliques_unicos']=(clicks_col,'sum')
else:
    agg_dict['cliques_unicos']=(df.columns[0],'count')
if bounce_col:
    agg_dict['bounces']=(bounce_col,'sum')
else:
    agg_dict['bounces']=(df.columns[0],'sum')
if optout_col:
    agg_dict['optouts']=(optout_col,'sum')
else:
    agg_dict['optouts']=(df.columns[0],'sum')

res=group.agg(**agg_dict)
# Comunicados: unique count of comunicado_col if exists, else count of rows per group
if comunicado_col:
    coms=group[comunicado_col].nunique()
else:
    coms=group.size()
res.insert(0,'comunicados',coms)
# compute rates
res['ctr_pct']=res['cliques_unicos']/res['recebidos']
res['ctor_pct']=res['cliques_unicos']/res['aberturas_unicas'].replace({0:pd.NA})
res['optout_pct']=res['optouts']/res['recebidos']
res['bounce_pct']=res['bounces']/res['recebidos']
# formatting for display similar to image: decimals with comma

def fmt_int(x):
    return f"{int(x):,}".replace(',','.')

def fmt_pct(x):
    if pd.isna(x):
        return ''
    return f"{x*100:0.2f}".replace('.',',')+'%'

out=res.reset_index()
# apply formatting columns
out_display=out.copy()
for c in ['enviados','recebidos','aberturas_unicas','cliques_unicos','bounces','optouts','comunicados']:
    if c in out_display.columns:
        out_display[c]=out_display[c].astype(int).map(fmt_int)
out_display['taxa_abertura']= (out['aberturas_unicas']/out['recebidos']).map(lambda x: fmt_pct(x))
out_display['ctr']= out['ctr_pct'].map(fmt_pct)
out_display['ctor']= out['ctor_pct'].map(fmt_pct)
out_display['optout_pct']= out['optout_pct'].map(fmt_pct)
out_display['bounce_pct']= out['bounce_pct'].map(fmt_pct)

# reorder like image (approx)
cols_order=['classificacion','comunicados','enviados','recebidos','aberturas_unicas','taxa_abertura','ctr','ctor','optout_pct','bounce_pct']
existing=[c for c in cols_order if c in out_display.columns]
out_display=out_display[existing]

print('\nAdjusted summary (formatted):')
print(out_display.to_string(index=False))
# save raw numeric and formatted excel
out.to_excel(p.parent / 'Junho_Comparacao_Uniques_raw.xlsx', index=False)
out_display.to_excel(p.parent / 'Junho_Comparacao_Uniques_formatado.xlsx', index=False)
print('\nSaved outputs:', p.parent / 'Junho_Comparacao_Uniques_formatado.xlsx')
