
import csv
from pathlib import Path

file_path = Path(__file__).parent / "data" / "home_tracking.csv"

with open(file_path, "r", encoding="utf-8") as file:
    reader = csv.reader(file)

    for number, row in zip(range(1, 5), reader):
        print(f"Row {number}: {row[:12]}")
