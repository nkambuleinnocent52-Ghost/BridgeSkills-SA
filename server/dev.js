import { spawn } from "node:child_process";

// Both commands use Node directly so this works in Windows terminals as well as Linux.
const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.js"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    {
      stdio: "inherit",
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300).unref();
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
