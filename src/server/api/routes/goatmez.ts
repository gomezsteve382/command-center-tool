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

  router.get("/mcp/diagnostics", auth, (_req: Request, res: Response) => {
    res.json({ ok: true, mcp: runtime.diagnosticsSnapshot().mcp });
  });

  router.get("/mcp/explorer", auth, (_req: Request, res: Response) => {
    res.json(runtime.mcpExplorerSnapshot());
  });

  router.post("/mcp/reload", auth, limit, (_req: Request, res: Response) => {
    res.json({ ok: true, mcp: runtime.diagnosticsSnapshot().mcp, reloadedAt: new Date().toISOString() });
  });

  router.get("/metrics", auth, (_req: Request, res: Response) => {
    res.json(runtime.metricsSnapshot());
  });

  router.get("/activity/recent", auth, (req: Request, res: Response) => {
    const limit = typeof req.query?.limit === "string" ? Number(req.query.limit) : 30;
    res.json(runtime.recentActivity(Number.isFinite(limit) ? limit : 30));
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

  router.post("/operator/run-summary", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = typeof req.body?.message === "string" ? req.body.message : "";
      const dryRun = req.body?.dryRun === true;
      const output = runtime.runWithSummary({ message, dryRun });
      res.json({ ok: true, ...output });
    } catch (error) {
      next(error);
    }
  });

  router.post("/operator/command-preview", auth, (req: Request, res: Response) => {
    const command = typeof req.body?.command === "string" ? req.body.command : "";
    const preview = runtime.previewCommand(command);
    res.status(preview.ok ? 200 : 400).json(preview);
  });

  router.get("/observability", auth, (_req: Request, res: Response) => {
    res.json(runtime.observabilitySnapshot());
  });

  router.get("/connectors", auth, (req: Request, res: Response) => {
    const agentId = typeof req.query?.agentId === "string" ? req.query.agentId : "operator";
    res.json(runtime.connectorsStatus(agentId));
  });

  router.get("/connectors/diagnostics", auth, (req: Request, res: Response) => {
    const agentId = typeof req.query?.agentId === "string" ? req.query.agentId : "operator";
    res.json({
      ok: true,
      agentId,
      connectors: runtime.connectorsStatus(agentId)
    });
  });

  router.get("/connectors/matrix", auth, (req: Request, res: Response) => {
    const raw = typeof req.query?.agents === "string" ? req.query.agents : "operator,developer";
    const agents = raw.split(",").map((item) => item.trim()).filter(Boolean);
    res.json(runtime.connectorVerificationMatrix(agents));
  });

  router.get("/connectors/:id/diagnostics", auth, (req: Request, res: Response) => {
    const agentId = typeof req.query?.agentId === "string" ? req.query.agentId : "operator";
    const output = runtime.connectorDiagnostics(req.params.id, agentId);
    if (!output) {
      res.status(404).json({ ok: false, error: "connector not found" });
      return;
    }
    res.json(output);
  });

  router.post("/connectors/:id/verify-dry-run", auth, limit, (req: Request, res: Response) => {
    const agentId = typeof req.body?.agentId === "string" ? req.body.agentId : "operator";
    const output = runtime.verifyConnectorDryRun(req.params.id, agentId);
    if (!output) {
      res.status(404).json({ ok: false, error: "connector not found" });
      return;
    }
    res.json(output);
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

  router.post("/permissions/rules/:id/enable", auth, limit, (req: Request, res: Response) => {
    const rule = runtime.setPermissionRuleEnabled(req.params.id, true);
    if (!rule) {
      res.status(404).json({ ok: false, error: "permission rule not found" });
      return;
    }
    res.json({ ok: true, rule });
  });

  router.post("/permissions/rules/:id/disable", auth, limit, (req: Request, res: Response) => {
    const rule = runtime.setPermissionRuleEnabled(req.params.id, false);
    if (!rule) {
      res.status(404).json({ ok: false, error: "permission rule not found" });
      return;
    }
    res.json({ ok: true, rule });
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

  router.get("/plugins", auth, (req: Request, res: Response) => {
    const kind = typeof req.query?.kind === "string" ? req.query.kind : undefined;
    res.json({ ok: true, plugins: runtime.listPlugins(kind) });
  });

  router.get("/plugins/registry", auth, (_req: Request, res: Response) => {
    res.json(runtime.pluginRegistrySnapshot());
  });

  router.get("/plugins/hooks", auth, (_req: Request, res: Response) => {
    res.json(runtime.pluginHookSnapshot());
  });

  router.post("/plugins/hooks/check", auth, (req: Request, res: Response) => {
    const hook = typeof req.body?.hook === "string" ? req.body.hook : "";
    const output = runtime.checkPluginHook(hook);
    res.status(output.ok ? 200 : 400).json(output);
  });

  router.post("/plugins/:id/enable", auth, limit, (req: Request, res: Response) => {
    const plugin = runtime.setPluginEnabled(req.params.id, true);
    if (!plugin) {
      res.status(404).json({ ok: false, error: "plugin not found" });
      return;
    }
    res.json({ ok: true, plugin });
  });

  router.post("/plugins/:id/disable", auth, limit, (req: Request, res: Response) => {
    const plugin = runtime.setPluginEnabled(req.params.id, false);
    if (!plugin) {
      res.status(404).json({ ok: false, error: "plugin not found" });
      return;
    }
    res.json({ ok: true, plugin });
  });

  router.get("/models", auth, (req: Request, res: Response) => {
    const provider = typeof req.query?.provider === "string" ? req.query.provider : undefined;
    res.json({ ok: true, models: runtime.listModels(provider) });
  });

  router.get("/models/registry", auth, (_req: Request, res: Response) => {
    res.json(runtime.modelRegistrySnapshot());
  });

  router.post("/models/:id/verify-dry-run", auth, limit, (req: Request, res: Response) => {
    const output = runtime.verifyModelDryRun(req.params.id);
    if (!output) {
      res.status(404).json({ ok: false, error: "model not found" });
      return;
    }
    res.json(output);
  });

  router.get("/agents", auth, (req: Request, res: Response) => {
    const role = typeof req.query?.role === "string" ? req.query.role : undefined;
    res.json({ ok: true, agents: runtime.listAgents(role) });
  });

  router.get("/agents/matrix", auth, (_req: Request, res: Response) => {
    res.json(runtime.agentCapabilityMatrix());
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

  router.get("/approvals", auth, (req: Request, res: Response) => {
    const status = typeof req.query?.status === "string" ? req.query.status : undefined;
    const validStatus = status === "pending" || status === "approved" || status === "rejected" || status === "executed" || status === "failed"
      ? status
      : undefined;
    res.json({ ok: true, approvals: runtime.listApprovals(validStatus) });
  });

  router.post("/approvals/:id/approve", auth, limit, (req: Request, res: Response) => {
    const updated = runtime.setApprovalStatus(req.params.id, "approved");
    if (!updated) {
      res.status(404).json({ ok: false, error: "approval not found" });
      return;
    }
    res.json({ ok: true, approval: updated });
  });

  router.post("/approvals/:id/reject", auth, limit, (req: Request, res: Response) => {
    const updated = runtime.setApprovalStatus(req.params.id, "rejected");
    if (!updated) {
      res.status(404).json({ ok: false, error: "approval not found" });
      return;
    }
    res.json({ ok: true, approval: updated });
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

  router.get("/sessions/:id", auth, (req: Request, res: Response) => {
    const session = runtime.getSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: "session not found" });
      return;
    }
    res.json({ ok: true, session });
  });

  router.post("/sessions/:id/replay-summary", auth, (req: Request, res: Response) => {
    const output = runtime.replaySessionSummary(req.params.id);
    if (!output) {
      res.status(404).json({ ok: false, error: "session not found" });
      return;
    }
    res.json(output);
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
