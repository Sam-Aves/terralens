# Run TERRALENS (frontend + backend)

Needs Python 3.10+ and Node 20+.

## One terminal (Mac/Linux)
```bash
cd ~/terralens
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-data.txt
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
cd terralens-frontend
npm install
npm run dev
```
The app opens at http://localhost:3000. Progress is saved by the backend in `cache/gamification.sqlite3`.

## Two terminals
Terminal 1 (repo root): activate the venv, then `python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 --reload`
Terminal 2: `cd terralens-frontend && npm install && npm run dev`

## Windows (PowerShell)
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-data.txt
Start-Process python -ArgumentList "-m","uvicorn","src.api:app","--host","127.0.0.1","--port","8000"
cd terralens-frontend
npm install
npm run dev
```

Without the backend the game still runs and saves to the browser instead.
Backend tests: `python -m unittest discover -s tests`
