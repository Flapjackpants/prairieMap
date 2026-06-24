from __future__ import annotations

from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
STREAM_TIMEOUT = httpx.Timeout(None, connect=10.0)


def validate_base_url(base_url: str) -> str:
    parsed = urlparse(base_url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="base_url must use http or https")
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="base_url must include a host")
    normalized = f"{parsed.scheme}://{parsed.netloc}"
    return normalized.rstrip("/")


def upstream_url(base_url: str, path: str) -> str:
    root = validate_base_url(base_url)
    if not path.startswith("/"):
        path = f"/{path}"
    return urljoin(f"{root}/", path.lstrip("/"))


async def proxy_get_json(base_url: str, path: str) -> dict:
    url = upstream_url(base_url, path)
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            res = await client.get(url)
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to {url}. Port may not be reachable.",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Minecraft API request timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if res.status_code >= 400:
        detail = res.text.strip() or res.reason_phrase
        raise HTTPException(status_code=res.status_code, detail=detail)
    try:
        return res.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON from Minecraft API") from exc


async def stream_sse(base_url: str, path: str) -> AsyncIterator[bytes]:
    url = upstream_url(base_url, path)
    client = httpx.AsyncClient(timeout=STREAM_TIMEOUT)
    try:
        async with client.stream("GET", url) as response:
            if response.status_code >= 400:
                body = await response.aread()
                detail = body.decode("utf-8", errors="replace").strip() or response.reason_phrase
                raise HTTPException(status_code=response.status_code, detail=detail)
            async for chunk in response.aiter_bytes():
                yield chunk
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to {url}. Port may not be reachable.",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Minecraft API stream timed out") from exc
    except httpx.HTTPError as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await client.aclose()
