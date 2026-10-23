import { spawn } from "node:child_process";
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable test PostgreSQL database. This test creates and removes isolated test schemas.",
  );
const child = spawn(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    "tests/restart.test.js",
    "tests/workflow.test.js",
    "tests/platform.test.js",
    "tests/serverless.test.js",
  ],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => process.exit(code ?? 1));
