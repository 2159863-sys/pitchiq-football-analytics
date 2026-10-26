
import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL")


def get_players():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is missing")

    with psycopg.connect(
        DATABASE_URL,
        sslmode="require",
        connect_timeout=10
    ) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT id, player_name, team, position "
                "FROM players ORDER BY id"
            )
            return cursor.fetchall()


if __name__ == "__main__":
    for player in get_players():
        print(player)
