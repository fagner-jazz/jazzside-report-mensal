from pathlib import Path
from dotenv import load_dotenv as _load_dotenv


def load_dotenv():
    env_path = Path(__file__).resolve().parent / '.env'
    if env_path.exists():
        _load_dotenv(env_path)
