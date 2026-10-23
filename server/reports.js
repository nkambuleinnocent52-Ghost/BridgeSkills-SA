// Operator-only CLI. Run in the deployed service shell; never expose this output publicly.
import { now } from "./store.js";
import { createStore } from "./database.js";
const store = await createStore();
const reportId = process.argv[2];
if (reportId) {
  const result = await store.run(
    "UPDATE reports SET status='reviewed' WHERE id=?",
    reportId,
  );
  console.log(result.changes ? "Report marked reviewed." : "Report not found.");
} else {
  const reports = await store.all(
    "SELECT r.id,r.target_type,r.target_id,r.reason,r.created_at,r.status,u.name AS reporter_name FROM reports r JOIN users u ON u.id=r.reporter_id WHERE r.status='open' ORDER BY r.created_at",
  );
  console.log(
    JSON.stringify(
      {
        generatedAt: now(),
        reports,
      },
      null,
      2,
    ),
  );
}
await store.close();
