import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from pipeline import run_research_pipeline

app = FastAPI(title="ai-research")

# job_id -> {status, stage, message, result?, error?}
jobs: dict[str, dict] = {}


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)


def _run(job_id: str, topic: str) -> None:
    def on_progress(stage: str, message: str) -> None:
        jobs[job_id].update(stage=stage, message=message)

    try:
        state = run_research_pipeline(topic, on_progress=on_progress)
        jobs[job_id].update(status="done", stage="done", message="Done", result=state)
    except Exception as exc:  # surface pipeline failures to the UI
        jobs[job_id].update(status="error", message=str(exc))


@app.post("/api/research")
def start_research(req: ResearchRequest):
    topic = req.topic.strip()
    if len(topic) < 3:
        raise HTTPException(422, "Topic is too short")

    job_id = uuid.uuid4().hex
    jobs[job_id] = {"status": "running", "stage": "search", "message": "Starting…"}
    threading.Thread(target=_run, args=(job_id, topic), daemon=True).start()
    return {"id": job_id}


@app.get("/api/research/{job_id}")
def get_research(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Unknown job")
    return jobs[job_id]


# Serve the UI last so it never shadows the API routes
app.mount("/", StaticFiles(directory=Path(__file__).parent / "public", html=True), name="static")
