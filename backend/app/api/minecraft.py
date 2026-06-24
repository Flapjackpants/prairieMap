from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services import minecraft_proxy

router = APIRouter(prefix="/minecraft", tags=["minecraft"])


@router.get("/health")
async def minecraft_health(base_url: str = Query(..., alias="base_url")) -> dict:
    return await minecraft_proxy.proxy_get_json(base_url, "/api/health")


@router.get("/players/record")
async def minecraft_players_record(base_url: str = Query(..., alias="base_url")) -> StreamingResponse:
    return StreamingResponse(
        minecraft_proxy.stream_sse(base_url, "/api/players/record"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/players")
async def minecraft_players(base_url: str = Query(..., alias="base_url")) -> dict:
    return await minecraft_proxy.proxy_get_json(base_url, "/api/players")


@router.get("/players/{uuid}")
async def minecraft_player(uuid: str, base_url: str = Query(..., alias="base_url")) -> dict:
    return await minecraft_proxy.proxy_get_json(base_url, f"/api/players/{uuid}")
