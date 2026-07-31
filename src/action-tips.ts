/**
 * Manual corrections and search boosts for catalog actions.
 * Applied at startup — survives catalog regeneration from OpenAPI specs.
 */

export interface ActionTip {
  /** Note shown alongside this action in search results */
  note?: string;
  /** Extra terms added to the search index for better discoverability */
  searchBoost?: string[];
}

/**
 * Extract search boost terms keyed by action ID.
 */
export function getSearchBoosts(
  tips: Record<string, ActionTip>
): Record<string, string[]> {
  const boosts: Record<string, string[]> = {};
  for (const [id, tip] of Object.entries(tips)) {
    if (tip.searchBoost) boosts[id] = tip.searchBoost;
  }
  return boosts;
}

export const ACTION_TIPS: Record<string, ActionTip> = {
  "custom-fields__get-custom-fields-by-object-key": {
    note: [
      "Only works for Custom Objects (objectKey must start with 'custom_objects.') and Company.",
      "Does NOT support 'contact' or 'opportunity'.",
      "For contact/opportunity custom fields, use locations__get-custom-fields with model=contact or model=opportunity instead.",
    ].join(" "),
  },
  "locations__get-custom-fields": {
    note: "Correct endpoint for contact and opportunity custom fields. Set model=contact, model=opportunity, or model=all.",
    searchBoost: [
      "opportunity custom fields",
      "contact custom fields",
      "opportunity fields",
      "contact fields",
    ],
  },
  "locations__create-custom-field": {
    note: [
      "Pass `parentId` to assign the field to an existing folder.",
      "For SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO, and CHECKBOX fields, use `options: [\"A\", \"B\"]`.",
      "Contact/opportunity folder containers themselves must still be created in the GHL UI first.",
    ].join(" "),
    searchBoost: [
      "create contact custom field in folder",
      "create opportunity custom field in folder",
      "custom field parentId",
      "custom field options array",
    ],
  },
  "locations__update-custom-field": {
    note: [
      "Pass `parentId` to move a field into an existing folder.",
      "For SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO, and CHECKBOX fields, use `options: [\"A\", \"B\"]`.",
      "GHL does not reliably convert an existing field from TEXT to SINGLE_OPTIONS via update; recreate the field if the type must change.",
    ].join(" "),
  },
  "custom-fields__create-custom-field-folder": {
    note: [
      "Folder creation works for Custom Objects and Company.",
      "Contact and opportunity custom-field folders are UI-only in GHL.",
      "Create those folders in the GHL UI, then assign fields with `parentId` on locations__create-custom-field or locations__update-custom-field.",
    ].join(" "),
    searchBoost: [
      "create custom field folder",
      "contact custom field folder",
      "opportunity custom field folder",
    ],
  },
  "contacts__get-contacts": {
    note: [
      "List responses may omit populated custom field values even when fields exist.",
      "Use contacts__get-contact for a single contact when you need the actual custom field payload.",
    ].join(" "),
    searchBoost: [
      "list contacts by tag",
      "contact list custom field values",
      "contacts tags filter",
    ],
  },
  "conversations__search-conversation": {
    note: [
      "Best starting point for reading a contact's conversation history.",
      "Search for the thread first, then call conversations__get-messages with the returned conversationId.",
    ].join(" "),
    searchBoost: [
      "conversation history for contact",
      "find conversation by contact",
      "read contact messages",
      "get messages for contact",
    ],
  },
  "conversations__get-messages": {
    note: [
      "Fetches the message history for a known conversationId.",
      "Common numeric response codes observed in the wild include type 3=email, type 20=SMS, and type 28=activity.",
    ].join(" "),
    searchBoost: [
      "conversation thread messages",
      "message history",
      "sms history",
      "email history",
    ],
  },
  "conversations__get-message": {
    note: "Common numeric response codes observed in the wild include type 3=email, type 20=SMS, and type 28=activity.",
  },
  "voice-ai__get-agents": {
    note: "These are Voice AI agents. They are a different product surface from Conversation AI bots.",
    searchBoost: [
      "voice ai agents",
      "voice bot list",
    ],
  },
  "workflows__get-workflow": {
    note: [
      "Read-only workflow list.",
      "The GHL public API does not expose workflow triggers, steps, conditions, or AI-agent usage details.",
      "Workflow builder configuration is still UI-only.",
    ].join(" "),
    searchBoost: [
      "list workflows",
      "workflow list",
      "workflow details",
      "workflow triggers",
      "workflow steps",
    ],
  },
  "opportunities__get-pipelines": {
    note: [
      "Lists pipelines with their stages.",
      "Pipelines can now also be created, updated, and deleted via the API: use opportunities-v3__create-pipeline, opportunities-v3__update-pipeline, and opportunities-v3__delete-pipeline (added 2026-06-26).",
    ].join(" "),
    searchBoost: [
      "list pipelines",
      "pipeline stages",
    ],
  },
  "opportunities-v3__create-pipeline": {
    note: "Creates a pipeline with stages in one call. Pipeline and stage names must be unique (case-insensitive) within the location. Set useOpportunityProbability true only if every stage carries stageWinProbability.",
    searchBoost: [
      "create pipeline",
      "new pipeline",
      "add pipeline",
      "create pipeline stages",
      "make pipeline",
    ],
  },
  "opportunities-v3__update-pipeline": {
    note: [
      "The stages array is a FULL replacement: include existing stage ids to keep those stages. A stage left out is deleted and its opportunities move to the lowest-position remaining stage.",
      "Sending the full stages array with every existing id preserved is safe and does not disturb opportunities (verified live against 148 records, 2026-07-31).",
      "locationId goes in the QUERY STRING here, not the body — unlike create-pipeline, this endpoint answers 422 if it is in the body.",
    ].join(" "),
    searchBoost: [
      "update pipeline",
      "edit pipeline",
      "rename pipeline",
      "add pipeline stage",
      "edit pipeline stages",
      "reorder stages",
    ],
  },
  "conversation-ai__update-agent": {
    note: [
      "Do NOT send locationId — this endpoint answers 422 when it is in the body. The agent is identified by agentId in the path.",
      "Send sleepTime / sleepTimeUnit only when sleepEnabled is true; either one present while sleep is disabled is a 422.",
      "Both verified live 2026-07-31, and both cost a round trip to discover.",
    ].join(" "),
    searchBoost: [
      "update conversation ai agent",
      "edit ai employee",
      "change ai agent instructions",
    ],
  },
  "conversation-ai-v3__update-agent": {
    note: [
      "Do NOT send locationId — this endpoint answers 422 when it is in the body. The agent is identified by agentId in the path.",
      "Send sleepTime / sleepTimeUnit only when sleepEnabled is true; either one present while sleep is disabled is a 422.",
      "Both verified live 2026-07-31, and both cost a round trip to discover.",
    ].join(" "),
    searchBoost: [
      "update conversation ai agent",
      "edit ai employee",
      "change ai agent instructions",
    ],
  },
  "opportunities-v3__delete-pipeline": {
    note: "Irreversibly deletes the pipeline AND every opportunity in it, across all stages. Confirm with the user and consider exporting opportunities first.",
    searchBoost: [
      "delete pipeline",
      "remove pipeline",
    ],
  },
  "locations__GET-all-or-email-sms-templates": {
    note: [
      "This endpoint lists email/SMS templates and can only list or delete them.",
      "SMS template creation remains UI-only, but email templates can be created via emails-v3__create-email-template, emails-v3__import-email-template, or the older emails__create-template builder endpoint.",
    ].join(" "),
  },
  "emails-v3__create-email-template": {
    note: "Creates an email template in a sub-account (API v3). Supersedes the older emails__create-template builder endpoint; use emails-v3__import-email-template to bring in existing HTML.",
    searchBoost: [
      "create email template",
      "new email template",
      "add email template",
    ],
  },
  "payments__create-coupon": {
    note: "For commerce setup, use GHL's payments__* and products__* endpoints. Stripe is the underlying rail, but Stripe API access is not required for normal GHL sub-account setup.",
    searchBoost: [
      "create coupon with ghl payments",
      "stripe coupon ghl",
      "commerce setup",
    ],
  },
  "products__create-product": {
    note: "Use GHL products__* and payments__* endpoints as the source of truth for commerce setup. Stripe IDs may appear in payloads, but direct Stripe API access is usually not needed.",
    searchBoost: [
      "create product in ghl",
      "stripe product ghl",
      "commerce source of truth",
    ],
  },
};
