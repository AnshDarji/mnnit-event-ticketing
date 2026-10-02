import hashlib
import time
from collections import defaultdict, deque

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response

from backend.common.application import application
from backend.common.config import settings

app = application("MNNIT API Gateway", database=False)
windows: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def limits(request: Request, call_next):
    category = "auth" if request.url.path.startswith("/auth/google") else "api"
    # A login caller can invent Authorization headers, so key sign-in attempts
    # by the network peer. Other calls use the token when available.
    identity = (request.client.host if request.client else "unknown") if category == "auth" else (request.headers.get("authorization") or (request.client.host if request.client else "unknown"))
    key = hashlib.sha256(f"{identity}:{category}".encode()).hexdigest()
    now = time.monotonic()
    queue = windows[key]
    while queue and queue[0] < now - 60:
        queue.popleft()
    if len(queue) >= (30 if category == "auth" else 180):
        return JSONResponse({"detail": "Too many requests. Please wait a minute"}, 429, headers={"Retry-After": "60"})
    queue.append(now)
    if len(windows) > 10000:
        for old_key in list(windows):
            if not windows[old_key] or windows[old_key][-1] < now - 60:
                del windows[old_key]
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path: str, request: Request):
    prefix = path.split("/", 1)[0]
    targets = {"auth": settings.auth_service_url, "events": settings.event_service_url, "tickets": settings.ticketing_service_url}
    if prefix not in targets:
        raise HTTPException(404, "Not found")
    body = await request.body()
    if len(body) > 1_000_000:
        raise HTTPException(413, "Request is too large")
    headers = {key: request.headers[key] for key in ("authorization", "content-type") if key in request.headers}
    headers["X-Gateway-Secret"] = settings.internal_secret
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            upstream = await client.request(request.method, f"{targets[prefix].rstrip('/')}/{path}", params=request.query_params, content=body, headers=headers)
        return Response(upstream.content, status_code=upstream.status_code, media_type=upstream.headers.get("content-type", "application/json"))
    except httpx.HTTPError:
        raise HTTPException(503, "The service is waking up or unavailable. Please retry shortly")
