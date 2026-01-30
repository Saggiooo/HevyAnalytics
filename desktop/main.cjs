const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let backendProc = null;
let backendStarting = false;

const HEVY_HOST = process.env.HEVY_HOST || "127.0.0.1";
const HEVY_PORT = process.env.HEVY_PORT || "8000";
const BACKEND_BASE = `http://${HEVY_HOST}:${HEVY_PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForBackendHealth({ timeoutMs = 30_000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const url = `${BACKEND_BASE}/health`;

  while (Date.now() < deadline) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(url, (res) => {
          // qualsiasi 2xx/3xx = backend su
          resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1500, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (ok) return true;
    } catch {
      // ignore
    }
    await sleep(intervalMs);
  }
  return false;
}

function startBackendOnce() {
  // evita doppi spawn (succede facilmente con lifecycle Electron)
  if (backendProc || backendStarting) return;
  backendStarting = true;

  const commonEnv = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "mysql+pymysql://hevy:hevy_pass@127.0.0.1:3307/hevy",
    HEVY_HOST,
    HEVY_PORT,
  };

  // DEV: avvia il backend python dalla repo
  if (!app.isPackaged) {
    const backendCwd = path.join(__dirname, "..", "backend");

    backendProc = spawn(
      process.platform === "win32" ? "python" : "python3",
      ["-m", "uvicorn", "app.main:app", "--host", HEVY_HOST, "--port", HEVY_PORT],
      {
        cwd: backendCwd,
        env: commonEnv,
        stdio: "inherit",
      }
    );

    backendProc.on("exit", (code, signal) => {
      console.log("Backend exited", { code, signal });
      backendProc = null;
      backendStarting = false;
    });

    backendStarting = false;
    return;
  }

  // PROD: backend impacchettato dentro l'app (extraResources -> backend/hevy-backend)
  const backendPath = path.join(process.resourcesPath, "backend", "hevy-backend");

  backendProc = spawn(backendPath, [], {
    env: commonEnv,
    // se tieni 'pipe' ricordati di consumare stdout/stderr (noi lo facciamo sotto)
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProc.stdout.on("data", (d) => console.log("[BACKEND]", d.toString()));
  backendProc.stderr.on("data", (d) => console.error("[BACKEND]", d.toString()));

  backendProc.on("error", (err) => {
    console.error("Backend spawn error", err);
  });

  backendProc.on("exit", (code, signal) => {
    console.log("Backend exited", { code, signal });
    backendProc = null;
    backendStarting = false;
  });

  backendStarting = false;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1800,
    height: 1000,
    backgroundColor: "#09090b",
    webPreferences: {
      contextIsolation: true,
    },
  });

  // DEV: carica Vite dev server
  if (!app.isPackaged) {
    const url = process.env.ELECTRON_START_URL || "http://localhost:5173";
    win.loadURL(url);
    return win;
  }

  // PROD: carica la build copiata dentro l'app via extraResources
  const indexPath = path.join(process.resourcesPath, "frontend", "dist", "index.html");
  win.loadFile(indexPath);
  return win;
}

async function boot() {
  // importantissimo: backend prima, poi UI (altrimenti fetch subito -> ERR_CONNECTION_REFUSED)
  startBackendOnce();

  const ok = await waitForBackendHealth({ timeoutMs: 45_000, intervalMs: 350 });
  if (!ok) {
    console.error("Backend non raggiungibile su /health:", `${BACKEND_BASE}/health`);
    // Apriamo comunque la UI, ma almeno sai che il problema è backend/connessione
  }

  createWindow();
}

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  // su macOS l'app resta viva; il backend lo chiudiamo comunque se non ci sono finestre
  if (backendProc) backendProc.kill();
  backendProc = null;

  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProc) backendProc.kill();
  backendProc = null;
});

// se l'utente riapre l'app (macOS dock) e il backend era morto, ripartilo
app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startBackendOnce();
    await waitForBackendHealth({ timeoutMs: 15_000, intervalMs: 350 });
    createWindow();
  }
});
