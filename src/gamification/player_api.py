"""Player progress for the gamified TERRALENS frontend.

Additive to the training API: separate tables, separate routes (/api/game).
Answers are graded here, coin spending is checked here, and XP, coins, the
journal and the callsign are stored here instead of in browser localStorage.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import sqlite3
from contextlib import contextmanager
from typing import Annotated, Any, Iterator

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field

from . import store
from .frontend_missions import FRONTEND_MISSIONS


router = APIRouter(prefix="/api/game", tags=["frontend-game"])

PlayerId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,64}$")]

START_COINS = 50
XP_PER_CORRECT = 50
COINS_PER_CORRECT = 25
XP_PER_CORRECT_MARK = 50
MARKS_ALLOWED = 3
XP_MISSION_COMPLETE = 100
XP_NO_HINTS_BONUS = 25
# Bonus XP calls come from the browser and cannot be verified, so they are capped.
MAX_BONUS_XP_PER_CALL = 150
MAX_COIN_SPEND = 500
RANKS = (
    (0, "Radar Rookie"),
    (100, "Signal Explorer"),
    (350, "Change Detective"),
    (600, "Earth Investigator"),
    (850, "Earth's Guardian"),
)


def rank_for_xp(xp: int) -> str:
    return [name for minimum, name in RANKS if xp >= minimum][-1]


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    path = store.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS game_players (
            player_id TEXT PRIMARY KEY,
            callsign TEXT,
            xp INTEGER NOT NULL DEFAULT 0,
            coins INTEGER NOT NULL DEFAULT 50,
            completed_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS game_journal (
            player_id TEXT NOT NULL,
            mission_id INTEGER NOT NULL,
            entry_json TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            PRIMARY KEY (player_id, mission_id)
        );
        """
    )
    try:
        yield connection
    finally:
        connection.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load(connection: sqlite3.Connection, player_id: str) -> sqlite3.Row:
    connection.execute(
        "INSERT OR IGNORE INTO game_players (player_id, coins) VALUES (?, ?)",
        (player_id, START_COINS),
    )
    return connection.execute(
        "SELECT * FROM game_players WHERE player_id = ?", (player_id,)
    ).fetchone()


def _payload(connection: sqlite3.Connection, player_id: str) -> dict[str, Any]:
    row = _load(connection, player_id)
    entries = connection.execute(
        "SELECT entry_json FROM game_journal WHERE player_id = ? "
        "ORDER BY completed_at DESC",
        (player_id,),
    ).fetchall()
    return {
        "playerId": player_id,
        "callsign": row["callsign"],
        "xp": row["xp"],
        "coins": row["coins"],
        "completedMissionIds": json.loads(row["completed_json"]),
        "journal": [json.loads(e["entry_json"]) for e in entries],
        "updatedAt": row["updated_at"],
    }


class ProfileBody(BaseModel):
    callsign: str = Field(min_length=1, max_length=40)


class XpBody(BaseModel):
    xp: int = Field(ge=1, le=MAX_BONUS_XP_PER_CALL)


class SpendBody(BaseModel):
    cost: int = Field(ge=1, le=MAX_COIN_SPEND)


class MarkIn(BaseModel):
    id: int
    lng: float
    lat: float


class SubmitBody(BaseModel):
    missionId: str
    playerCallsign: str = Field(default="", max_length=40)
    answers: dict[int, int] = Field(default_factory=dict)
    hintsUsed: int = Field(default=0, ge=0, le=100)
    marks: list[MarkIn] = Field(default_factory=list)
    correctMarks: int = Field(default=0, ge=0, le=100)


@router.get("/players/{player_id}/progress")
def progress(player_id: PlayerId) -> dict[str, Any]:
    with _db() as connection:
        return _payload(connection, player_id)


@router.put("/players/{player_id}")
def save_profile(player_id: PlayerId, body: ProfileBody) -> dict[str, Any]:
    with _db() as connection:
        _load(connection, player_id)
        connection.execute(
            "UPDATE game_players SET callsign = ?, updated_at = ? WHERE player_id = ?",
            (body.callsign.strip(), _now(), player_id),
        )
        return _payload(connection, player_id)


@router.get("/players/{player_id}/journal")
def journal(player_id: PlayerId) -> list[dict[str, Any]]:
    with _db() as connection:
        return _payload(connection, player_id)["journal"]


@router.get("/players/{player_id}/rank")
def rank(player_id: PlayerId) -> dict[str, Any]:
    with _db() as connection:
        xp = _payload(connection, player_id)["xp"]
    next_rank = next((m for m, _ in RANKS if m > xp), None)
    return {"rank": rank_for_xp(xp), "xp": xp, "nextRankAtXp": next_rank}


@router.delete("/players/{player_id}")
def reset(player_id: PlayerId) -> dict[str, Any]:
    with _db() as connection:
        connection.execute("DELETE FROM game_journal WHERE player_id = ?", (player_id,))
        connection.execute("DELETE FROM game_players WHERE player_id = ?", (player_id,))
        return _payload(connection, player_id)


@router.post("/players/{player_id}/xp")
def award_xp(player_id: PlayerId, body: XpBody) -> dict[str, Any]:
    with _db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        _load(connection, player_id)
        connection.execute(
            "UPDATE game_players SET xp = xp + ?, updated_at = ? WHERE player_id = ?",
            (body.xp, _now(), player_id),
        )
        connection.execute("COMMIT")
        return _payload(connection, player_id)


@router.post("/players/{player_id}/coins/spend")
def spend_coins(player_id: PlayerId, body: SpendBody) -> dict[str, Any]:
    with _db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _load(connection, player_id)
        if row["coins"] < body.cost:
            connection.execute("ROLLBACK")
            raise HTTPException(status_code=409, detail="Not enough coins.")
        connection.execute(
            "UPDATE game_players SET coins = coins - ?, updated_at = ? WHERE player_id = ?",
            (body.cost, _now(), player_id),
        )
        connection.execute("COMMIT")
        return _payload(connection, player_id)


@router.post("/investigations/{mission_id}/players/{player_id}/submit")
def submit(mission_id: int, player_id: PlayerId, body: SubmitBody) -> dict[str, Any]:
    mission = FRONTEND_MISSIONS.get(mission_id)
    if mission is None or body.missionId != str(mission_id):
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found.")

    challenges = mission["challenges"]
    explanations = []
    for index, challenge in enumerate(challenges):
        chosen = body.answers.get(index)
        explanations.append(
            {
                "questionId": index,
                "isCorrect": chosen == challenge["correct_index"],
                "explanation": challenge["explanation"],
            }
        )
    correct_count = sum(item["isCorrect"] for item in explanations)
    breakdown = {
        "answers": correct_count * XP_PER_CORRECT,
        # Marks are checked against a map computed in the browser; the count
        # is capped here but cannot be re-verified server-side yet.
        "marks": min(MARKS_ALLOWED, body.correctMarks) * XP_PER_CORRECT_MARK,
        "completion": XP_MISSION_COMPLETE,
        "noHints": XP_NO_HINTS_BONUS if body.hintsUsed == 0 else 0,
    }
    breakdown["total"] = sum(breakdown.values())
    now = _now()
    score = round(correct_count / len(challenges) * 100)
    badge_title = "All Answers Correct" if correct_count == len(challenges) else "Mission Complete"
    entry = {
        "id": f"{mission_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "missionId": str(mission_id),
        "missionName": mission["name"],
        "dateCompleted": now,
        "score": score,
        "xpEarned": breakdown["total"],
        "badgeTitle": badge_title,
        "thumbnailUrl": "",
        "coordinates": mission["coordinates"],
        "floodAreaKm2": mission.get("peak_new_water_km2", mission["estimatedAreaKm2"]),
    }

    with _db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _load(connection, player_id)
        completed = sorted(set(json.loads(row["completed_json"])) | {mission_id})
        connection.execute(
            "UPDATE game_players SET callsign = COALESCE(NULLIF(?, ''), callsign), "
            "xp = xp + ?, coins = coins + ?, completed_json = ?, updated_at = ? "
            "WHERE player_id = ?",
            (
                body.playerCallsign.strip(),
                breakdown["total"],
                correct_count * COINS_PER_CORRECT,
                json.dumps(completed),
                now,
                player_id,
            ),
        )
        connection.execute(
            "INSERT OR REPLACE INTO game_journal "
            "(player_id, mission_id, entry_json, completed_at) VALUES (?, ?, ?, ?)",
            (player_id, mission_id, json.dumps(entry), now),
        )
        connection.execute("COMMIT")
        player = _payload(connection, player_id)

    return {
        "result": {
            "missionId": str(mission_id),
            "score": score,
            "xpEarned": breakdown["total"],
            "correctCount": correct_count,
            "totalQuestions": len(challenges),
            "badgeAwarded": None,
            "explanations": explanations,
            "timestamp": now,
        },
        "progress": player,
        "xpBreakdown": breakdown,
        "badgeTitle": badge_title,
    }
