import express, { type Request, type Response, type NextFunction } from "express";
import { getGoatmezRuntime } from "../../../goatmez/runtime.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";

export function createGoatmezRouter(): express.Router {
  const router = express.Router();
  const auth = requireAuth as express.RequestHandler;
  const limit = rateLimitRequests as express.RequestHandler;
  const runtime = getGoatmezRuntime();

  router.get("/health", auth, (_req: Request, res: Response) => {
    res.json(runtime.health());
  });

  router.get("/config", auth, (_req: Request, res: Response) => {
    res.json({ ok: true, config: runtime.configCompatibility() });
  });

  router.get("/conflicts", auth, (_req: Request, res: Response) => {
    res.json({ ok: true, rules: runtime.conflictRules() });
  });

  router.get("/diagnostics", auth, (_req: Request, res: Response) => {
    res.json(runtime.diagnosticsSnapshot());
  });

  router.get("/metrics", auth, (_req: Request, res: Response) => {
    res.json(runtime.metricsSnapshot());
  });

  router.post("/migrations/legacy", auth, limit, (_req: Request, res: Response) => {
    res.json({ ok: true, result: runtime.importLegacyNow() });
  });

  router.post("/run", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = typeof req.body?.message === "string" ? req.body.message : "";
      const dryRun = req.body?.dryRun === true;
      const result = runtime.run({ message, dryRun });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/observability", auth, (_req: Request, res: Response) => {
    res.json(runtime.observabilitySnapshot());
  });

  router.get("/connectors", auth, (_req: Request, res: Response) => {
    res.json(runtime.connectorsStatus());
  });

  router.get("/permissions/rules", auth, (_req: Request, res: Response) => {
    res.json(runtime.listPermissionRules());
  });

  router.post("/permissions/rules", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const pattern = typeof req.body?.pattern === "string" ? req.body.pattern : "";
      const decision = req.body?.decision === "allow" || req.body?.decision === "approval" || req.body?.decision === "deny"
        ? req.body.decision
        : "approval";
      const description = typeof req.body?.description === "string" ? req.body.description : undefined;
      const enabled = req.body?.enabled !== false;
      const rule = runtime.createPermissionRule({ pattern, decision, description, enabled });
      res.json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/permissions/rules/:id", auth, (req: Request, res: Response) => {
    const deleted = runtime.deletePermissionRule(req.params.id);
    res.status(deleted ? 200 : 404).json({ ok: deleted });
  });

  router.post("/permissions/dry-run", auth, (req: Request, res: Response) => {
    const agentId = typeof req.body?.agentId === "string" ? req.body.agentId : "operator";
    const toolName = typeof req.body?.toolName === "string" ? req.body.toolName : "";
    if (!toolName) {
      res.status(400).json({ ok: false, error: "toolName is required" });
      return;
    }
    res.json({ ok: true, output: runtime.dryRunPermission(agentId, toolName) });
  });

  router.get("/permissions/diagnostics", auth, (_req: Request, res: Response) => {
    res.json(runtime.permissionDiagnostics());
  });

  router.post("/permissions/simulate", auth, (req: Request, res: Response) => {
    const agentId = typeof req.body?.agentId === "string" ? req.body.agentId : "operator";
    const toolNames = Array.isArray(req.body?.toolNames)
      ? req.body.toolNames.map(String)
      : typeof req.body?.toolsText === "string"
        ? req.body.toolsText.split(/\r?\n/g)
        : [];
    if (!toolNames.length) {
      res.status(400).json({ ok: false, error: "toolNames or toolsText is required" });
      return;
    }
    res.json(runtime.simulatePermissions(agentId, toolNames));
  });

  router.get("/sessions", auth, (_req: Request, res: Response) => {
    const state = runtime.readState();
    res.json(state.sessions.slice(0, 100));
  });

  router.post("/sessions/search", auth, (req: Request, res: Response) => {
    const query = typeof req.body?.query === "string" ? req.body.query.toLowerCase().trim() : "";
    const state = runtime.readState();
    if (!query) {
      res.json(state.sessions.slice(0, 100));
      return;
    }
    const matches = state.sessions.filter((session) =>
      `${session.message}\n${session.summary || ""}\n${session.error || ""}`.toLowerCase().includes(query)
    );
    res.json(matches.slice(0, 100));
  });

  router.get("/knowledge", auth, (_req: Request, res: Response) => {
    const state = runtime.readState();
    res.json(state.knowledgeDocuments);
  });

  router.post("/knowledge/text", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title : "";
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
      if (!title || !text.trim()) {
        res.status(400).json({ ok: false, error: "title and text are required" });
        return;
      }
      const output = runtime.addKnowledgeText({ title, text, tags, source: "dashboard" });
      res.json({ ok: true, output });
    } catch (error) {
      next(error);
    }
  });

  router.post("/knowledge/search", auth, (req: Request, res: Response) => {
    const query = typeof req.body?.query === "string" ? req.body.query : "";
    const mode = req.body?.mode === "keyword" || req.body?.mode === "vector" || req.body?.mode === "hybrid"
      ? req.body.mode
      : "hybrid";
    const limitValue = typeof req.body?.limit === "number" ? req.body.limit : Number(req.body?.limit || 10);
    res.json({
      ok: true,
      query,
      mode,
      results: runtime.searchKnowledge(query, mode, limitValue)
    });
  });

  router.get("/vault", auth, (_req: Request, res: Response) => {
    res.json({
      configured: runtime.vault.configured,
      secrets: runtime.vault.list()
    });
  });

  router.post("/vault/secrets", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name : "";
      const value = typeof req.body?.value === "string" ? req.body.value : "";
      const scope = typeof req.body?.scope === "string" ? req.body.scope : "workspace";
      const provider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
      if (!name || !value) {
        res.status(400).json({ ok: false, error: "name and value are required" });
        return;
      }
      res.json({ ok: true, secret: runtime.setSecret({ name, value, scope, provider }) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
