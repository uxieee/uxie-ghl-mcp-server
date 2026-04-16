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
  switch (action.id) {
    case "locations__create-custom-field":
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

export function applyCatalogOverrides(catalog: Catalog): Catalog {
  const actions = catalog.actions.map(overrideAction);
  return {
    ...catalog,
    actions,
  };
}
