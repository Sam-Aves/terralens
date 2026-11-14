from __future__ import annotations

import asyncio
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

from src.api import app


def call(method: str, path: str, **kwargs) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(request())


class PlayerApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.patch = patch(
            "src.gamification.store.DB_PATH",
            Path(self.temporary.name) / "gamification.sqlite3",
        )
        self.patch.start()
        self.base = "/api/game/players/test-player"

    def tearDown(self):
        self.patch.stop()
        self.temporary.cleanup()

    def submit(self, mission_id: int, **body):
        payload = {"missionId": str(mission_id), "answers": {}, **body}
        return call(
            "POST",
            f"/api/game/investigations/{mission_id}/players/test-player/submit",
            json=payload,
        )

    def test_new_player_starts_empty_with_starting_coins(self):
        data = call("GET", f"{self.base}/progress").json()
        self.assertEqual(
            (data["xp"], data["coins"], data["callsign"], data["journal"]),
            (0, 50, None, []),
        )

    def test_submit_grades_on_the_server_and_saves_progress(self):
        response = self.submit(1, answers={"0": 1, "1": 2, "2": 0}, hintsUsed=0)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["result"]["correctCount"], 2)
        self.assertEqual(
            [e["isCorrect"] for e in data["result"]["explanations"]],
            [True, True, False],
        )
        # 2 answers x 50 + completion 100 + no-hints 25
        self.assertEqual(data["xpBreakdown"]["total"], 225)
        self.assertEqual(data["progress"]["xp"], 225)
        self.assertEqual(data["progress"]["coins"], 50 + 2 * 25)
        self.assertEqual(data["progress"]["completedMissionIds"], [1])
        saved = call("GET", f"{self.base}/progress").json()
        self.assertEqual(saved["xp"], 225)
        self.assertEqual(len(saved["journal"]), 1)

    def test_replay_replaces_the_journal_entry(self):
        self.submit(1, answers={"0": 1})
        self.submit(1, answers={"0": 1, "1": 2, "2": 1}, hintsUsed=2)
        journal = call("GET", f"{self.base}/journal").json()
        self.assertEqual(len(journal), 1)
        self.assertEqual(journal[0]["score"], 100)

    def test_marks_xp_is_capped(self):
        data = self.submit(2, correctMarks=50).json()
        self.assertEqual(data["xpBreakdown"]["marks"], 150)

    def test_unknown_mission_is_rejected(self):
        self.assertEqual(self.submit(9).status_code, 404)

    def test_coins_cannot_go_negative(self):
        spend = lambda cost: call(
            "POST", f"{self.base}/coins/spend", json={"cost": cost}
        )
        self.assertEqual(spend(40).json()["coins"], 10)
        self.assertEqual(spend(40).status_code, 409)

    def test_bonus_xp_is_capped_and_rank_follows_xp(self):
        award = lambda xp: call("POST", f"{self.base}/xp", json={"xp": xp})
        self.assertEqual(award(9999).status_code, 422)
        award(100)
        rank = call("GET", f"{self.base}/rank").json()
        self.assertEqual(
            (rank["rank"], rank["xp"], rank["nextRankAtXp"]),
            ("Signal Explorer", 100, 350),
        )

    def test_profile_and_reset(self):
        call("PUT", self.base, json={"callsign": "Investigator-Mufliha"})
        self.assertEqual(
            call("GET", f"{self.base}/progress").json()["callsign"],
            "Investigator-Mufliha",
        )
        self.submit(1)
        reset = call("DELETE", self.base).json()
        self.assertEqual((reset["xp"], reset["coins"], reset["journal"]), (0, 50, []))

    def test_players_are_isolated_and_ids_validated(self):
        self.submit(1)
        other = call("GET", "/api/game/players/someone-else/progress").json()
        self.assertEqual(other["xp"], 0)
        self.assertEqual(call("GET", "/api/game/players/bad%20id!/progress").status_code, 422)


if __name__ == "__main__":
    unittest.main()
