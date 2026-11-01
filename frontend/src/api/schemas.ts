/**
 * Runtime mirror of backend/app/api/schemas.py (and app/agents/schemas.py for the
 * extraction payload). Every response is parsed through these, so a contract drift
 * shows up as a clear error state instead of a crash deep in a component.
 *
 * Datetimes stay ISO strings (the API sends naive UTC timestamps); see lib/format.ts.
 */
import { z } from "zod";

export const statusSchema = z.enum(["pending", "extracting", "assessing", "done", "failed"]);
export const levelSchema = z.enum(["none", "low", "medium", "high"]);

export type Status = z.infer<typeof statusSchema>;
export type Level = z.infer<typeof levelSchema>;

const isoDate = z.string();

export const emailSummarySchema = z.object({
  id: z.string(),
  source: z.string(),
  sender: z.string(),
  subject: z.string(),
  date: isoDate.nullable(),
  status: statusSchema,
  risk_level: levelSchema.nullable(),
  risk_tags: z.array(z.string()),
  summary: z.string().nullable(),
  processed_by: z.string().nullable(),
  error: z.string().nullable(),
});

export const emailListSchema = z.object({
  items: z.array(emailSummarySchema),
  total: z.number().int(),
  in_flight: z.number().int(),
});

// ---- extraction (Agent A output, app/agents/schemas.py::ExtractionResult)

export const factSchema = z.object({
  type: z.string(), // amount | date | account | reference | url | attachment | other
  value: z.string(),
  context: z.string().default(""),
});

export const extractedAttachmentSchema = z.object({
  filename: z.string(),
  summary: z.string().default(""),
});

export const extractionResultSchema = z.object({
  sender: z.string().default(""),
  recipients: z.array(z.string()).default([]),
  date: z.string().nullable().default(null),
  subject: z.string().default(""),
  summary: z.string(),
  key_facts: z.array(factSchema).default([]),
  attachments: z.array(extractedAttachmentSchema).default([]),
});

// ---- detail

export const attachmentSchema = z.object({
  filename: z.string(),
  extracted_text: z.string(),
});

export const signalSchema = z.object({
  tag: z.string(),
  weight: z.number(),
  evidence: z.string(),
});

export const riskSchema = z.object({
  level: levelSchema,
  rationale: z.string(),
  tags: z.array(z.string()),
  signals: z.array(signalSchema),
  provider: z.string(),
  model: z.string(),
});

export const extractionSchema = z.object({
  result: extractionResultSchema,
  provider: z.string(),
  model: z.string(),
});

const attributesSchema = z.record(z.unknown());

export const entitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  attributes: attributesSchema,
});

export const relationshipSchema = z.object({
  id: z.number().int(),
  source_id: z.number().int(),
  target_id: z.number().int(),
  source: z.string(),
  target: z.string(),
  type: z.string(),
  confidence: z.number(),
});

export const stepSchema = z.object({
  run: z.number().int(),
  step: z.string(),
  provider: z.string(),
  model: z.string(),
  attempts: z.number().int(),
  latency_ms: z.number().int(),
  outcome: z.string(), // ok | repaired | fallback | error
  error: z.string().nullable(),
  created_at: isoDate,
});

export const emailDetailSchema = z.object({
  id: z.string(),
  source: z.string(),
  sender: z.string(),
  recipients: z.array(z.string()),
  subject: z.string(),
  date: isoDate.nullable(),
  status: statusSchema,
  error: z.string().nullable(),
  raw_content: z.string(),
  body: z.string(),
  attachments: z.array(attachmentSchema),
  extraction: extractionSchema.nullable(),
  risk: riskSchema.nullable(),
  entities: z.array(entitySchema),
  relationships: z.array(relationshipSchema),
  steps: z.array(stepSchema),
});

export const acceptedSchema = z.object({
  id: z.string(),
  status: statusSchema,
});

// ---- graph

export const graphNodeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  attributes: attributesSchema,
  email_ids: z.array(z.string()),
  mention_count: z.number().int(),
  max_risk: levelSchema,
});

export const graphEdgeSchema = z.object({
  source: z.number().int(),
  target: z.number().int(),
  type: z.string(),
  email_ids: z.array(z.string()),
  confidence: z.number(),
});

export const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

// ---- health

export const healthSchema = z.object({
  status: z.literal("ok"),
  mode: z.enum(["llm", "rules"]),
  providers: z.array(z.string()),
  queue: z.record(z.number().int()),
});

/** FastAPI errors: `{detail: string}` from HTTPException, `{detail: [...]}` from request validation. */
export const errorBodySchema = z.object({
  detail: z.union([
    z.string(),
    z.array(
      z.object({ msg: z.string(), loc: z.array(z.union([z.string(), z.number()])).optional() }).passthrough(),
    ),
  ]),
});

export type EmailSummary = z.infer<typeof emailSummarySchema>;
export type EmailList = z.infer<typeof emailListSchema>;
export type EmailDetail = z.infer<typeof emailDetailSchema>;
export type Fact = z.infer<typeof factSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Accepted = z.infer<typeof acceptedSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
export type Health = z.infer<typeof healthSchema>;
