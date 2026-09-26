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

The backend entry point is `backend/main.py`. Add or run the API once its FastAPI application is implemented.
