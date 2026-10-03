import cors from "cors";
import express from "express";
import { env } from "./env";
import { router } from "./routes";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").map((o) => o.trim()),
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(router);

app.listen(env.port, () => {
  console.log(`[tuklas] API listening on :${env.port}`);
  console.log(`[tuklas] database: ${env.databaseUrl ? "postgres" : "in-memory"}`);
});
