import type { Catalog, CatalogAction, RequestBodyInfo } from "./types.js";

function mergeRequestBodySchema(
  requestBody: RequestBodyInfo | null,
  extraProperties: Record<string, unknown>
): RequestBodyInfo | null {
  if (!requestBody) return requestBody;

  const schema = requestBody.schema ?? {};
  const existingProperties =
    typeof schema.properties === "object" && schema.properties !== null
      ? (schema.properties as Record<string, unknown>)
      : {};

  return {
    ...requestBody,
    schema: {
      ...schema,
      type: "object",
      properties: {
        ...existingProperties,
        ...extraProperties,
      },
    },
  };
}

function overrideAction(action: CatalogAction): CatalogAction {
  // The GHL changelog (2026-07-07) added cursor pagination to this endpoint,
  // but the published specs don't carry the params yet. Match by method+path so
  // both the v2 and v3 variants pick it up regardless of operationId.
  if (
    action.method === "GET" &&
    action.path === "/ad-publishing/facebook/pages" &&
    !action.parameters.some((p) => p.name === "after")
  ) {
    return {
      ...action,
      parameters: [
        ...action.parameters,
        {
          name: "after",
          in: "query",
          required: false,
          description:
            "Cursor for pagination — pass the `after` value returned by the previous page (added 2026-07-07, not yet in the published OpenAPI spec).",
          type: "string",
        },
        {
          name: "limit",
          in: "query",
          required: false,
          description: "Max pages to return per request (added 2026-07-07).",
          type: "number",
        },
      ],
    };
  }

  switch (action.id) {
    // The upstream specs (both v2 and v3) omit `options` and `parentId` from the
    // custom-field payloads even though the live API accepts them.
    case "locations__create-custom-field":
    case "locations-v3__create-custom-field":
      return {
        ...action,
        requestBody: mergeRequestBodySchema(action.requestBody, {
          options: {
            type: "array",
            description:
              "Use a flat array of strings for SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO, and CHECKBOX field types.",
            items: { type: "string" },
            example: ["Option A", "Option B"],
          },
          parentId: {
            type: "string",
            description:
              "Assign the field to an existing folder. For contact/opportunity fields, create the folder in the GHL UI first, then pass its parentId here.",
            example: "folder_123",
          },
        }),
      };
    case "locations__update-custom-field":
    case "locations-v3__update-custom-field":
      return {
        ...action,
        requestBody: mergeRequestBodySchema(action.requestBody, {
          options: {
            type: "array",
            description:
              "Use a flat array of strings to replace the existing options for SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO, and CHECKBOX fields.",
            items: { type: "string" },
            example: ["Option A", "Option B"],
          },
          parentId: {
            type: "string",
            description:
              "Move the field into an existing folder. Contact/opportunity folders themselves still have to be created in the GHL UI.",
            example: "folder_123",
          },
        }),
      };
    default:
      return action;
  }
}

const PIPELINE_STAGE_SCHEMA = {
  type: "array",
  description:
    "Pipeline stages in display order. At least one stage is required. Stage names must be unique within the pipeline (case-insensitive).",
  items: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", description: "Stage name." },
      stageWinProbability: {
        type: "number",
        description:
          "Win probability 0-100. Required on every stage when useOpportunityProbability is true.",
      },
    },
  },
};

/**
 * Pipeline CRUD landed in the live GHL API on 2026-06-26 (changelog +
 * marketplace endpoint docs) but has not yet been published to the OpenAPI
 * specs the catalog is built from. Hand-authored from the official docs at
 * marketplace.gohighlevel.com/docs/ghl/opportunities/{create,get,update,delete}-pipeline.
 * appendMissingActions() skips each one as soon as the upstream spec carries it.
 */
const HAND_AUTHORED_ACTIONS: CatalogAction[] = [
  {
    id: "opportunities-v3__create-pipeline",
    category: "opportunities-v3",
    method: "POST",
    path: "/opportunities/pipelines",
    summary: "Create Pipeline",
    description:
      "Creates a new opportunity pipeline with stages (API addition of 2026-06-26; hand-authored from the official endpoint docs because it is not yet in the published OpenAPI specs). Pipeline names must be unique per location (case-insensitive).",
    tags: ["Pipelines"],
    scopes: [],
    parameters: [],
    requestBody: {
      required: true,
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["name", "stages"],
        properties: {
          name: {
            type: "string",
            description:
              "Pipeline name. Must be unique within the location (case-insensitive).",
          },
          stages: PIPELINE_STAGE_SCHEMA,
          useOpportunityProbability: {
            type: "boolean",
            description:
              "Enable manual win probability. When true, every stage must carry stageWinProbability; otherwise probabilities are auto-computed.",
          },
          locationId: {
            type: "string",
            description: "Sub-account (location) ID the pipeline belongs to.",
          },
        },
      },
    },
    versionHeader: "v3",
  },
  {
    id: "opportunities-v3__get-pipeline",
    category: "opportunities-v3",
    method: "GET",
    path: "/opportunities/pipelines/{pipelineId}",
    summary: "Get Pipeline",
    description:
      "Retrieves a single pipeline by ID, including all its stages and configuration (API addition of 2026-06-26; hand-authored from the official endpoint docs).",
    tags: ["Pipelines"],
    scopes: [],
    parameters: [
      {
        name: "pipelineId",
        in: "path",
        required: true,
        description: "ID of the pipeline to retrieve.",
        type: "string",
      },
    ],
    requestBody: null,
    versionHeader: "v3",
  },
  {
    id: "opportunities-v3__update-pipeline",
    category: "opportunities-v3",
    method: "PUT",
    path: "/opportunities/pipelines/{pipelineId}",
    summary: "Update Pipeline",
    description:
      "Updates a pipeline's name and stages (API addition of 2026-06-26; hand-authored from the official endpoint docs). The stages array is a full replacement: include each existing stage's id to keep it, omit the id to create a new stage, and leave a stage out to remove it. Opportunities in removed stages migrate to the lowest-position remaining stage. You cannot remove all stages.",
    tags: ["Pipelines"],
    scopes: [],
    parameters: [
      {
        name: "pipelineId",
        in: "path",
        required: true,
        description: "ID of the pipeline to update.",
        type: "string",
      },
    ],
    requestBody: {
      required: true,
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["name", "stages"],
        properties: {
          name: {
            type: "string",
            description:
              "Pipeline name. Must be unique within the location (case-insensitive).",
          },
          stages: {
            ...PIPELINE_STAGE_SCHEMA,
            description:
              "Full replacement array of stages. Include an existing stage's id to keep it; omit the id to create a new stage; leave a stage out to delete it (its opportunities move to the lowest-position remaining stage).",
            items: {
              type: "object",
              required: ["name"],
              properties: {
                id: {
                  type: "string",
                  description:
                    "Existing stage ID. Include it to preserve the stage (and its opportunities); omit for new stages.",
                },
                name: { type: "string", description: "Stage name." },
                stageWinProbability: {
                  type: "number",
                  description:
                    "Win probability 0-100. Required on every stage when useOpportunityProbability is true.",
                },
              },
            },
          },
          useOpportunityProbability: {
            type: "boolean",
            description:
              "Enable manual win probability. When true, every stage must carry stageWinProbability.",
          },
        },
      },
    },
    versionHeader: "v3",
  },
  {
    id: "opportunities-v3__delete-pipeline",
    category: "opportunities-v3",
    method: "DELETE",
    path: "/opportunities/pipelines/{pipelineId}",
    summary: "Delete Pipeline",
    description:
      "PERMANENTLY deletes a pipeline AND every opportunity in it, across all stages. This is irreversible (API addition of 2026-06-26; hand-authored from the official endpoint docs).",
    tags: ["Pipelines"],
    scopes: [],
    parameters: [
      {
        name: "pipelineId",
        in: "path",
        required: true,
        description: "ID of the pipeline to delete.",
        type: "string",
      },
    ],
    requestBody: null,
    versionHeader: "v3",
  },
];

function appendMissingActions(actions: CatalogAction[]): CatalogAction[] {
  const seen = new Set(actions.map((a) => `${a.method} ${a.path}`));
  const missing = HAND_AUTHORED_ACTIONS.filter(
    (a) => !seen.has(`${a.method} ${a.path}`)
  );
  return missing.length > 0 ? [...actions, ...missing] : actions;
}

export function applyCatalogOverrides(catalog: Catalog): Catalog {
  const actions = appendMissingActions(catalog.actions.map(overrideAction));
  return {
    ...catalog,
    totalActions: actions.length,
    categories: [...new Set(actions.map((a) => a.category))].sort(),
    actions,
  };
}
