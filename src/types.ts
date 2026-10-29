export interface CatalogAction {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  scopes: string[];
  parameters: ParameterInfo[];
  requestBody: RequestBodyInfo | null;
  versionHeader: string | null;
  /** GHL marks the op DEPRECATED in its live docs (llms-full.txt); `replacement` is the op its prose names, if any. A field, never description text: risk.ts gates on description words. */
  deprecated?: { replacement: string | null };
  /** Facts an agent should see with the op: private beta, documented only under one tree, undocumented since … */
  notes?: string[];
  /** Old path-placeholder name → the name GHL's live docs use now; the executor accepts either. */
  paramAliases?: Record<string, string>;
}

export interface ParameterInfo {
  name: string;
  in: string;
  required: boolean;
  description: string;
  type: string;
  enum?: string[];
}

export interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
}

export interface Catalog {
  generatedAt: string;
  /**
   * Where the catalogue was built from. Since W3 (2026-10-29): GHL's live docs, with the sha256 of each tree's llms.txt.
   * 2026-09-24 → 2026-10-29: a commit of GitHub's highlevel-api-docs (repo/ref/sha/committedAt).
   */
  source?: { site: string; fetchedAt: string; llms: Record<string, string> } | { repo: string; ref: string; sha: string | null; committedAt: string | null };
  baseUrl: string;
  totalActions: number;
  categories: string[];
  actions: CatalogAction[];
}

/** What a call TOUCHES — the basis for confirmation gating. See risk.ts. */
export type ActionRiskKind = "read" | "write" | "external_send" | "billing" | "delete";

export interface ActionRisk {
  level: "low" | "medium" | "high";
  kinds: ActionRiskKind[];
  notes: string[];
  requiresConfirmation: boolean;
}
