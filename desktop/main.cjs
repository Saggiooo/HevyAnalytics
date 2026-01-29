const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let backendProc = null;

function startBackend() {
  // DEV: avvia il backend python dalla repo
  if (!app.isPackaged) {
    const backendCwd = path.join(__dirname, "..", "backend");
    backendProc = spawn(
      process.platform === "win32" ? "python" : "python3",
      ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
      {
        cwd: backendCwd,
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ||
            "mysql+pymysql://hevy:hevy_pass@127.0.0.1:3307/hevy",
        },
        stdio: "inherit",
      }
    );

    backendProc.on("exit", (code) => {
      console.log("Backend exited", code);
    });
    return;
  }

  // PROD: backend impacchettato dentro l'app (extraResources -> backend/hevy-backend)
  const backendPath = path.join(process.resourcesPath, "backend", "hevy-backend");

  backendProc = spawn(backendPath, [], {
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "mysql+pymysql://hevy:hevy_pass@127.0.0.1:3307/hevy",
      HEVY_HOST: "127.0.0.1",
      HEVY_PORT: "8000",
    },
    stdio: "pipe",
  });

backendProc.stdout.on("data", (d) => console.log("[BACKEND]", d.toString()));
backendProc.stderr.on("data", (d) => console.error("[BACKEND]", d.toString()));

  backendProc.on("exit", (code) => {
    console.log("Backend exited", code);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#09090b",
    webPreferences: {
      contextIsolation: true,
    },
  });

  // DEV: carica Vite dev server
  if (!app.isPackaged) {
    const url = process.env.ELECTRON_START_URL || "http://localhost:5173";
    win.loadURL(url);
    // win.webContents.openDevTools({ mode: "detach" }); // se vuoi
    return;
  }

  // PROD: carica la build copiata dentro l'app via extraResources
  // (electron-builder deve copiare ../frontend/dist -> Resources/frontend/dist)
  const indexPath = path.join(process.resourcesPath, "frontend", "dist", "index.html");
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  if (backendProc) backendProc.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProc) backendProc.kill();
});
