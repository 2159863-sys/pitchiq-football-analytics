
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import get_players
from tracking import get_player_tracking
from match_tracking import get_match_frames, get_match_summary

app = FastAPI(title="PitchIQ API")

# Allow our React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Welcome to PitchIQ!"}


@app.get("/api/players")
def players():
    return get_players()


@app.get("/api/tracking/{player_name}")
def player_tracking(player_name: str):
    try:
        return get_player_tracking(player_name)

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Player not found in tracking dataset"
        )


@app.get("/api/match")
def match_summary():
    return get_match_summary()


@app.get("/api/match/frames")
def match_frames(period: int = 1, start: float = 0, duration: float = 60):
    try:
        return get_match_frames(period, start, duration)

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
