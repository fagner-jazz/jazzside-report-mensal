import os
from load_env import load_dotenv
load_dotenv()
from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://fidfdgnnoqamhftczcer.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_TABLE = os.getenv('SUPABASE_TABLE', 'base_ouro_m1_a_m6')

if not SUPABASE_KEY:
    raise SystemExit('Set SUPABASE_KEY to a valid Supabase anon or service_role key.')

client = create_client(SUPABASE_URL, SUPABASE_KEY)
print('Supabase URL:', SUPABASE_URL)
print('Supabase table:', SUPABASE_TABLE)

try:
    response = client.table(SUPABASE_TABLE).select('*', count='exact').limit(1).execute()
    print('Response data:', response.data)
    print('Response error:', getattr(response, 'error', None))
    print('Response count:', getattr(response, 'count', None))
    print('Response dict:', response.dict())
except Exception as exc:
    print('Supabase query failed:')
    print(exc)
