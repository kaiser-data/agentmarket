// Boot all three lead-enrichment services in one process (handy for the demo).

import "dotenv/config";
import { spawn } from "node:child_process";
import { SERVICES } from "./services.config.ts";

const portFor: Record<string, string | undefined> = {
  clearleads: process.env.SVC_A_PORT ?? "4101",
  dataping: process.env.SVC_B_PORT ?? "4102",
  cheaplist: process.env.SVC_C_PORT ?? "4103",
};

for (const s of SERVICES) {
  const child = spawn("tsx", ["agents/service.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      SVC_ID: s.id,
      SVC_BEHAVIOR: s.behavior ?? "honest",
      SVC_PORT: portFor[s.id],
      SVC_PRICE: s.pricePerCallUsdc.toFixed(2),
      SVC_PAYTO: s.payTo,
    },
  });
  child.on("exit", (code) => console.log(`${s.id} exited: ${code}`));
}
