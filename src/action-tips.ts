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
};
