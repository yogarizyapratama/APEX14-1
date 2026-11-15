import { getActiveScope } from "./scope.js";
import type {
  Handler,
  MethodMap,
  Middleware,
  RouteOptions,
  Guard,
  SecurityConfig,
  WebSocketHandlers,
  TaskOptions,
  TaskDispatcher,
  ScheduleOptions,
  ScheduledJob
} from "./types.js";
import type { ApexRequestContext } from "@apex14/http";

export function route(
  path: string,
  handlerOrMethods: Handler | MethodMap,
  options?: RouteOptions
): void {
  getActiveScope().route(path, handlerOrMethods, options);
}

export function sse(
  path: string,
  generatorFn: (ctx: ApexRequestContext) => AsyncIterable<any>,
  options?: RouteOptions
): void {
  getActiveScope().sse(path, generatorFn, options);
}

export function ws(path: string, handlers: WebSocketHandlers): void {
  getActiveScope().ws(path, handlers);
}

export function task<TData = any, TResult = any>(
  name: string,
  handler: (data: TData) => Promise<TResult>,
  options?: TaskOptions
): TaskDispatcher<TData, TResult> {
  return getActiveScope().task(name, handler, options);
}

export function schedule(
  patternOrOptions: string | ScheduleOptions,
  handler: () => void | Promise<void>
): ScheduledJob {
  return getActiveScope().schedule(patternOrOptions, handler);
}

export function exportMcpTools(): MethodMap {
  return getActiveScope().exportMcpTools();
}

export function getOpenApiSpec(info?: any): Record<string, any> {
  return getActiveScope().getOpenApiSpec(info);
}

export function enableDocs(options?: { docsPath?: string; specPath?: string; title?: string }): void {
  getActiveScope().enableDocs(options);
}

export function webhook(path: string, config: any): void {
  getActiveScope().webhook(path, config);
}

export function enableStudio(options?: any): void {
  getActiveScope().enableStudio(options);
}

export function toFetch(scope = getActiveScope()): (request: Request, env?: any, ctx?: any) => Promise<Response> {
  return scope.toFetch();
}

export { resilient, CircuitBreakerOpenError, TimeoutError, type ResilienceOptions } from "./resilience.js";
export { cache, ApexCache, type CacheOptions } from "./cache.js";
export { auth, ApexAuthEngine, type AuthConfig, type AuthSession, type AuthUser } from "./auth.js";
export { workflow, ApexWorkflow, WorkflowContext, workflowRegistry, type WorkflowRun, type WorkflowStepOptions, type StepRecord } from "./workflow.js";
export { live, liveBus, type LiveQueryOptions } from "./live.js";
export { heal, ApexHealEngine, type Incident, type HealConfig } from "./heal.js";
export { contract, ApexContract, type ContractDefinition } from "./contract.js";
export { agent, ApexAgent, type AgentConfig, type AgentTool, type AgentResponse, type AgentMessage } from "./agent.js";
export { tenant, ApexTenantEngine, type TenantConfig } from "./tenant.js";
export { audit, ApexAuditEngine, type AuditRecord } from "./audit.js";
export { event, ApexEvent, type OutboxEvent, type EventHandler } from "./event.js";
export { chaos, ApexChaosEngine, type ChaosConfig } from "./chaos.js";
export { geo, ApexGeoEngine, type GeoSteerOptions } from "./geo.js";
export { lock, lockEngine, ApexLockEngine, LockAcquisitionError, type LockOptions } from "./lock.js";
export { throttle, ApexThrottleInstance, type ThrottleConfig, type ThrottleTier } from "./throttle.js";
export { verify, ApexVerifyEngine, type VerifySignedOptions } from "./verify.js";
export { mock, ApexMockEngine, type MockOptions } from "./mock.js";
export { patch, ApexPatchEngine, type PatchRecord, type PatchListener } from "./patch.js";
export { wasm, ApexWasmEngine, ApexWasmInstance, WasmExecutionError, type WasmOptions } from "./wasm.js";
export { delta, ApexDeltaEngine, type PatchOperation, type PatchOpType } from "./delta.js";
export { policy, ApexPolicyEngine, type PolicyPredicate } from "./policy.js";
export { stream, ApexStreamEngine, ApexStreamPipeline } from "./stream.js";
export { replay, ApexReplayEngine, type ReplayCassette, type ReplayRecordOptions } from "./replay.js";
export { snapshot, ApexSnapshotEngine, SnapshotMismatchError, type SnapshotOptions } from "./snapshot.js";
export { sdk, ApexSdkEngine, type SdkLanguage, type SdkGenerateOptions } from "./sdk.js";
export { vector, ApexVectorEngine, ApexVectorIndex, type VectorMetric, type VectorRecord, type VectorSearchResult } from "./vector.js";
export { feature, ApexFeatureEngine, type FeatureFlagConfig } from "./feature.js";
export { mask, ApexMaskEngine, type MaskOptions } from "./mask.js";
export { guardrail, ApexGuardrailEngine } from "./guardrail.js";
export { migrate, ApexMigrateEngine, type MigrationPlan, type SqlDialect } from "./migrate.js";
export { metric, ApexMetricEngine, ApexCounter, ApexGauge, ApexHistogram } from "./metric.js";

export function group(
  prefix: string,
  callback: () => void,
  options?: RouteOptions
): void {
  getActiveScope().group(prefix, callback, options);
}

export function use(middleware: Middleware): void {
  getActiveScope().use(middleware);
}

export function guard(name: string, guardFn: Guard): void {
  getActiveScope().guard(name, guardFn);
}

export function secure(config: SecurityConfig): void {
  getActiveScope().secure(config);
}

export function inject(name: string, service: any): void {
  getActiveScope().inject(name, service);
}

export function getService<T = any>(name: string): T | undefined {
  return getActiveScope().getService<T>(name);
}

export async function handle(request: Request): Promise<Response> {
  return await getActiveScope().handle(request);
}

export async function testRequest(
  urlOrPath: string,
  init?: RequestInit
): Promise<Response> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
  const req = new Request(url, init);
  return await handle(req);
}
