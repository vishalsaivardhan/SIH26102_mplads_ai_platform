# SIH26102 MPLADS AI Platform

Project workspace for the Smart India Hackathon solution SIH26102. The repository keeps the web client and API service in separate top-level folders.

## Repository Layout

```text
.
|-- backend/
|   |-- data/          # Source MPLADS allocation dataset
|   |-- main.py        # FastAPI application entry point
|   `-- requirements.txt
|-- frontend/
|   |-- public/        # Static files served as-is
|   `-- src/           # React application and assets
`-- README.md
```

## Frontend

Requirements: Node.js and npm.

```powershell
cd frontend
npm install
npm run dev
```

Run the production checks with `npm run lint` and `npm run build` from `frontend/`.

## Backend

Requirements: Python 3 and pip.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The API reads `backend/data/Allocated Limit for Honble MPs.csv` directly. Start it from `backend/` with:

```powershell
uvicorn main:app --reload
```

API docs are available at `http://127.0.0.1:8000/docs`.

## Model Scope

The current source file contains MP allocation limits, not individual works, sanctions, expenditure, payments, or progress events. An Isolation Forest screens allocation amounts and ranks a small review queue against the national distribution. Its score is an outlier priority, not a fraud probability or an audit finding. Work-level cost, duplicate-work, utilization, and execution-stall detection need the corresponding work-level records.

The state map uses simplified ADM1 boundaries from geoBoundaries, source DataMeet / Election Commission of India, boundary ID `IND-ADM1-1811400`, under CC BY 2.5 IN. Attribution is retained in the frontend.

## Free Deployment

### Render API

1. Push this repository to GitHub.
2. In Render, create a Blueprint from the repository and select the root `render.yaml`; it creates a free Python web service from `backend/`.
3. Wait for `/health` to pass and copy the service URL, such as `https://mplads-allocation-api.onrender.com`.

Render's free web service may sleep when idle; its first request after sleeping can take longer. The CSV is bundled with the service, so it does not need a persistent disk.

### Vercel frontend

1. Import the same GitHub repository into Vercel.
2. Set the project Root Directory to `frontend` and keep the Vite framework preset.
3. Add `VITE_API_BASE_URL` with the Render service URL, without a trailing slash, then deploy.
4. Copy the Vercel production URL. In Render, add `FRONTEND_ORIGINS` with that origin (for example `https://your-project.vercel.app`) and redeploy the API.

For a local frontend, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_BASE_URL=http://127.0.0.1:8000`.
