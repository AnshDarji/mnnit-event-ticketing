import httpx
from fastapi import HTTPException

from .config import settings


async def fetch(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.get(url, headers={"X-Internal-Secret": settings.internal_secret})
        if response.status_code == 404:
            raise HTTPException(404, "Event or user no longer exists")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        raise HTTPException(503, "A service is waking up or unavailable. Please retry shortly")


async def get_user(user_id: str) -> dict:
    return await fetch(f"{settings.auth_service_url}/internal/users/{user_id}")


async def get_event(event_id: str) -> dict:
    return await fetch(f"{settings.event_service_url}/internal/events/{event_id}")
