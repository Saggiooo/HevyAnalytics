import httpx
from app.config import HEVY_API_KEY

class HevyClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def get(self, path: str, params: dict):
        headers = {"api-key": HEVY_API_KEY, "accept": "application/json"}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}{path}", headers=headers, params=params)
            resp.raise_for_status()
            return resp.json()
