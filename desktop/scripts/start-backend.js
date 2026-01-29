// desktop/scripts/start-backend.js
const { spawn } = require("child_process");
const path = require("path");

const backendDir = path.resolve(__dirname, "../../backend");

// Cambia qui se usi un altro comando per avviare FastAPI
const cmd = process.platform === "win32" ? "python" : "python3";
const args = ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"];

const child = spawn(cmd, args, {
  cwd: backendDir,
  stdio: "inherit",
  env: {
    ...process.env,
    // se vuoi forzare env del backend
    // DATABASE_URL: process.env.DATABASE_URL,
  },
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
