import sys
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest

if __name__ == '__main__':
    raise SystemExit(pytest.main(['-q', 'backend/tests/test_langgraph_agent_flow.py']))
