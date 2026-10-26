"""
Synchronised multi-player tracking for Metrica Sports Sample Game 1.

Both CSV files share the same frame numbering, so every home player,
away player and the ball can be read at the same frame and timestamp.
Player identifiers and jersey numbers come from the CSV header rows,
not from the Supabase players table.
"""

import csv
import math
import threading
from array import array
from pathlib import Path

from tracking import PITCH_LENGTH, PITCH_WIDTH

DATA_DIR = Path(__file__).parent / "data"

TEAM_FILES = {
    "home": DATA_DIR / "home_tracking.csv",
    "away": DATA_DIR / "away_tracking.csv",
}

FPS = 25

# Stats are measured over 0.2 s steps to reduce frame-to-frame jitter
STAT_STEP = 5

# Speeds above this are treated as tracking glitches (43 km/h)
MAX_SPEED_MS = 12.0

# Common industry thresholds
HIGH_SPEED_MS = 19.8 / 3.6
SPRINT_SPEED_MS = 25.2 / 3.6

MAX_CLIP_SECONDS = 300

_lock = threading.Lock()
_match = None


def _parse_number(value):
    if not value or value == "NaN":
        return math.nan
    return float(value)


def _read_team(path, team):
    with open(path, "r", encoding="utf-8") as file:
        reader = csv.reader(file)

        next(reader)  # Team name row
        numbers = next(reader)  # Jersey number row
        headers = next(reader)  # Column name row

        # Each player has an x column followed by an unnamed y column
        players = []
        for index, name in enumerate(headers):
            if index < 3 or not name or name == "Ball":
                continue

            players.append({
                "id": f"{team}-{numbers[index]}",
                "column": name.replace(" ", ""),
                "team": team,
                "number": int(numbers[index]),
                "x_index": index,
                "x": array("f"),
                "y": array("f"),
            })

        ball_index = headers.index("Ball")

        periods = array("b")
        frames = array("i")
        times = array("d")
        ball_x = array("f")
        ball_y = array("f")

        for row in reader:
            if not row:
                continue

            periods.append(int(row[0]))
            frames.append(int(row[1]))
            times.append(float(row[2]))

            for player in players:
                i = player["x_index"]
                player["x"].append(_parse_number(row[i]))
                player["y"].append(_parse_number(row[i + 1]))

            ball_x.append(_parse_number(row[ball_index]))
            ball_y.append(_parse_number(row[ball_index + 1]))

    return {
        "players": players,
        "periods": periods,
        "frames": frames,
        "times": times,
        "ball_x": ball_x,
        "ball_y": ball_y,
    }


def _player_stats(player, periods):
    xs = player["x"]
    ys = player["y"]
    total = len(xs)

    present = [i for i in range(total) if not math.isnan(xs[i])]

    stats = {
        "minutes_played": round(len(present) / FPS / 60, 1),
        "first_seen_frame": present[0] if present else None,
        "last_seen_frame": present[-1] if present else None,
        "distance_m": 0.0,
        "average_speed_kmh": 0.0,
        "top_speed_kmh": 0.0,
        "high_speed_distance_m": 0.0,
        "sprint_distance_m": 0.0,
        "average_position": {},
    }

    if not present:
        return stats

    distance = 0.0
    high_speed = 0.0
    sprint = 0.0
    top_speed = 0.0
    measured_time = 0.0

    for i in range(STAT_STEP, total, STAT_STEP):
        j = i - STAT_STEP

        if periods[i] != periods[j]:
            continue
        if math.isnan(xs[i]) or math.isnan(xs[j]):
            continue

        step = math.hypot(
            (xs[i] - xs[j]) * PITCH_LENGTH,
            (ys[i] - ys[j]) * PITCH_WIDTH,
        )
        speed = step / (STAT_STEP / FPS)

        if speed > MAX_SPEED_MS:
            continue

        distance += step
        measured_time += STAT_STEP / FPS
        top_speed = max(top_speed, speed)

        if speed >= HIGH_SPEED_MS:
            high_speed += step
        if speed >= SPRINT_SPEED_MS:
            sprint += step

    # Mean position per half, used for the average-position map
    for period in (1, 2):
        points = [i for i in present if periods[i] == period]
        if points:
            stats["average_position"][str(period)] = {
                "x": round(sum(xs[i] for i in points) / len(points), 4),
                "y": round(sum(ys[i] for i in points) / len(points), 4),
            }

    stats["distance_m"] = round(distance, 1)
    stats["average_speed_kmh"] = round(
        distance / measured_time * 3.6 if measured_time else 0, 2
    )
    stats["top_speed_kmh"] = round(top_speed * 3.6, 1)
    stats["high_speed_distance_m"] = round(high_speed, 1)
    stats["sprint_distance_m"] = round(sprint, 1)
    return stats


def load_match():
    """Parse both teams once and keep the result in memory."""
    global _match

    with _lock:
        if _match is not None:
            return _match

        home = _read_team(TEAM_FILES["home"], "home")
        away = _read_team(TEAM_FILES["away"], "away")

        # Both teams must describe exactly the same frames and timestamps
        if (home["frames"] != away["frames"]
                or home["times"] != away["times"]):
            raise RuntimeError("Home and away frames are not aligned")

        periods = home["periods"]
        times = home["times"]
        players = home["players"] + away["players"]

        for player in players:
            player["stats"] = _player_stats(player, periods)

        # First and last row index of each period
        period_ranges = {}
        for i, period in enumerate(periods):
            first, _ = period_ranges.get(period, (i, i))
            period_ranges[period] = (first, i)

        _match = {
            "players": players,
            "periods": periods,
            "frames": home["frames"],
            "times": times,
            "ball_x": home["ball_x"],
            "ball_y": home["ball_y"],
            "period_ranges": period_ranges,
        }
        return _match


def get_match_summary():
    match = load_match()
    times = match["times"]

    periods = []
    for period, (first, last) in sorted(match["period_ranges"].items()):
        periods.append({
            "period": period,
            "start_time": round(times[first], 2),
            "end_time": round(times[last], 2),
            "duration": round(times[last] - times[first], 2),
            "frames": last - first + 1,
        })

    players = []
    for player in match["players"]:
        stats = dict(player["stats"])
        first = stats.pop("first_seen_frame")
        last = stats.pop("last_seen_frame")

        players.append({
            "id": player["id"],
            "column": player["column"],
            "team": player["team"],
            "number": player["number"],
            "starter": first == 0,
            "first_seen_time": (
                round(times[first], 2) if first is not None else None
            ),
            "first_seen_period": (
                match["periods"][first] if first is not None else None
            ),
            "last_seen_time": (
                round(times[last], 2) if last is not None else None
            ),
            **stats,
        })

    return {
        "source": "Metrica Sports Sample Game 1",
        "fps": FPS,
        "pitch": {"length": PITCH_LENGTH, "width": PITCH_WIDTH},
        "total_frames": len(times),
        "periods": periods,
        "players": players,
    }


def _rounded(values):
    return [None if math.isnan(v) else round(v, 4) for v in values]


def get_match_frames(period=1, start=0.0, duration=60.0):
    """
    Return every tracked position for a clip of the match.
    `start` is measured in seconds from the beginning of the period.
    """
    match = load_match()

    if period not in match["period_ranges"]:
        raise ValueError("Unknown period")
    if duration <= 0 or duration > MAX_CLIP_SECONDS:
        raise ValueError("Clip duration out of range")

    first, last = match["period_ranges"][period]
    begin = first + max(0, int(round(start * FPS)))
    end = min(last, begin + int(round(duration * FPS)) - 1)

    if begin > last:
        raise ValueError("Clip starts after the end of the period")

    window = slice(begin, end + 1)

    return {
        "period": period,
        "fps": FPS,
        "period_start_time": round(match["times"][first], 2),
        "times": [round(t, 2) for t in match["times"][window]],
        "frames": list(match["frames"][window]),
        "ball": {
            "x": _rounded(match["ball_x"][window]),
            "y": _rounded(match["ball_y"][window]),
        },
        "players": {
            player["id"]: {
                "x": _rounded(player["x"][window]),
                "y": _rounded(player["y"][window]),
            }
            for player in match["players"]
        },
    }


if __name__ == "__main__":
    import time

    started = time.perf_counter()
    summary = get_match_summary()
    print(f"Loaded in {time.perf_counter() - started:.1f}s")
    print(summary["periods"])

    for p in summary["players"]:
        print(
            f"{p['id']:>8} {p['column']:>9} starter={p['starter']!s:5} "
            f"min={p['minutes_played']:>5} dist={p['distance_m']:>8} "
            f"avg={p['average_speed_kmh']:>5} top={p['top_speed_kmh']:>5} "
            f"hsr={p['high_speed_distance_m']:>6} spr={p['sprint_distance_m']:>6}"
        )
