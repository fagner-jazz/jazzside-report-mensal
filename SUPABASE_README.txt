Supabase access and upload instructions

Project URL: https://fidfdgnnoqamhftczcer.supabase.co
Project ID: fidfdgnnoqamhftczcer
Project Name: fagner-jazz's Project

Keys:
- Publishable Key: sb_publishable_kxXpLfa6qCedVjuZQP5Xug_xL9co33j
- Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZGZkZ25ub3FhbWhmdGN6Y2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0MjQ1NywiZXhwIjoyMDk5NjE4NDU3fQ.vLZFb5celzFiwDdRq3SWt7UZYddejICG0j18l1ttYzI

Local files:
- upload_supabase.py  : script to load Excel data to Supabase
- supabase_inspect.py : script to inspect the target table

How to use:
1. Set environment variables in the terminal:
   $env:SUPABASE_URL='https://fidfdgnnoqamhftczcer.supabase.co'
   $env:SUPABASE_KEY='your_service_role_key'
   $env:SUPABASE_TABLE='base_ouro_m1_a_m6'

2. Inspect the table:
   python supabase_inspect.py

3. Upload the consolidated workbook:
   python upload_supabase.py --input-file Base_Ouro_M1_a_M6.xlsx

Notes:
- The service role key is required for inserts.
- The script normalizes columns and serializes dates/times.
- If the target table schema differs, update the table name or add column mappings in upload_supabase.py.
