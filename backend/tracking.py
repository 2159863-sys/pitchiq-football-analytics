
import csv
import math
from pathlib import Path

FILE_PATH = Path(__file__).parent / "data" / "home_tracking.csv"

PITCH_LENGTH = 105
PITCH_WIDTH = 68


def get_player_tracking(player_name="Player1", limit=250):
    frames = []
    total_distance = 0
    previous_position = None

    with open(FILE_PATH, "r", encoding="utf-8") as file:
        reader = csv.reader(file)

        next(reader)
        next(reader)

        headers = next(reader)
        player_index = headers.index(player_name)

        for i, row in enumerate(reader):
            if i >= limit:
                break

            if not row[player_index] or not row[player_index + 1]:
                continue

            time = float(row[2])
            x = float(row[player_index])
            y = float(row[player_index + 1])

            x_metres = x * PITCH_LENGTH
            y_metres = y * PITCH_WIDTH

            if previous_position is not None:
                px, py = previous_position
                distance = math.hypot(
                    x_metres - px,
                    y_metres - py
                )
                total_distance += distance

            previous_position = (x_metres, y_metres)

            frames.append({
                "time": time,
                "x": x,
                "y": y
            })

    elapsed_time = (
        frames[-1]["time"] - frames[0]["time"]
        if len(frames) > 1 else 0
    )

    average_speed = (
        total_distance / elapsed_time * 3.6
        if elapsed_time > 0 else 0
    )

    return {
        "player": player_name,
        "distance_metres": round(total_distance, 2),
        "average_speed_kmh": round(average_speed, 2),
        "frames": frames
    }


if __name__ == "__main__":
    result = get_player_tracking()
    print("Player:", result["player"])
    print("Distance:", result["distance_metres"], "m")
    print("Average speed:", result["average_speed_kmh"], "km/h")
    print("Frames:", len(result["frames"]))
