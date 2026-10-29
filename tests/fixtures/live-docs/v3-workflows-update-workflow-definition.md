# Update Workflow Definition

PUT https://services.leadconnectorhq.com/workflows/{workflowId}/definition

**Limited availability.** The workflow API is currently enabled for selected sub-accounts only; any other sub-account receives 403 `WORKFLOW_API_NOT_ENABLED_FOR_LOCATION`.

Replace a workflow definition in full. **This is a complete overwrite** — any step absent from the request is deleted, so always read the current definition first and send it back modified — the definition carries its own `version`, so sending back what you read keeps you protected against overwriting a concurrent edit. A stale `version` is rejected with 422 and nothing is written.

**Draft only.** A published workflow is rejected with 409: the overwrite would replace steps under contacts currently moving through it. Set the workflow to draft with Update Workflow Status, update it, then publish it again.

**Order matters.** Changing status advances the `version`, so read the definition *after* setting the workflow to draft: draft → read → update → publish. Reading first and drafting second leaves you holding a stale `version`.

## Authentication

Send `Authorization: Bearer <token>` using:

- **Sub-Account token: OAuth access token or Private Integration Token.** Scopes: `workflows.write`

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version. Send `v3`. |

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | string | Yes | Workflow ID |

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locationId` | string | Yes | Sub-account (location) ID the workflow belongs to |

## OpenAPI Specification

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "HighLevel API",
    "version": "v3"
  },
  "servers": [
    {
      "url": "https://services.leadconnectorhq.com"
    }
  ],
  "paths": {
    "/workflows/{workflowId}/definition": {
      "put": {
        "summary": "Update Workflow Definition",
        "operationId": "updateWorkflowDefinition",
        "description": "**Limited availability.** The workflow API is currently enabled for selected sub-accounts only; any other sub-account receives 403 `WORKFLOW_API_NOT_ENABLED_FOR_LOCATION`.\n\nReplace a workflow definition in full. **This is a complete overwrite** — any step absent from the request is deleted, so always read the current definition first and send it back modified — the definition carries its own `version`, so sending back what you read keeps you protected against overwriting a concurrent edit. A stale `version` is rejected with 422 and nothing is written.\n\n**Draft only.** A published workflow is rejected with 409: the overwrite would replace steps under contacts currently moving through it. Set the workflow to draft with Update Workflow Status, update it, then publish it again.\n\n**Order matters.** Changing status advances the `version`, so read the definition *after* setting the workflow to draft: draft → read → update → publish. Reading first and drafting second leaves you holding a stale `version`.",
        "parameters": [
          {
            "name": "Version",
            "in": "header",
            "description": "API Version. Send `v3`.",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "v3"
              ]
            }
          },
          {
            "name": "workflowId",
            "required": true,
            "in": "path",
            "description": "Workflow ID",
            "schema": {
              "example": "b1b0de82-3efb-4d63-83f6-13c50aef208c",
              "type": "string"
            }
          },
          {
            "name": "locationId",
            "required": true,
            "in": "query",
            "description": "Sub-account (location) ID the workflow belongs to",
            "schema": {
              "example": "ve9EPM428h8vShlRW1KT",
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateWorkflowDefinitionDto"
              },
              "examples": {
                "linear": {
                  "summary": "1. Linear — two steps in sequence",
                  "description": "The smallest useful workflow: a trigger, two actions, and one edge joining them. `edges` is what orders the steps — `actions` is an unordered set, so a definition with no edges is a pile of disconnected steps, not a sequence.\n\nNote `tags`: tag names are matched against the sub-account. A name that does not exist yet comes back as a warning (`ASSET_TAG_NOT_FOUND`), the step is saved as written, and the tag is created the first time the step runs. Other references — users, pipelines, calendars, custom fields, templates — must already exist, or the save is rejected.",
                  "value": {
                    "version": 1,
                    "name": "Welcome new contacts",
                    "source": {
                      "system": "api"
                    },
                    "triggers": [
                      {
                        "type": "contact_created",
                        "name": "New contact"
                      }
                    ],
                    "actions": [
                      {
                        "id": "send-welcome-sms",
                        "type": "sms",
                        "name": "Send welcome SMS",
                        "attributes": {
                          "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
                        }
                      },
                      {
                        "id": "tag-as-welcomed",
                        "type": "add_contact_tag",
                        "name": "Tag as welcomed",
                        "attributes": {
                          "tags": [
                            "welcomed"
                          ]
                        }
                      }
                    ],
                    "edges": [
                      {
                        "from": "send-welcome-sms",
                        "to": "tag-as-welcomed"
                      }
                    ]
                  }
                },
                "branching": {
                  "summary": "2. If/else — two lanes from one condition",
                  "description": "A branch is an `if_else` action that declares its `branches`, plus one edge per branch whose `branch` is that branch's `id`. Give each branch a UUID `id`. The else lane is created for you and named by `noneBranchName`; reach it with an edge whose `branch` is `no`. A declared branch with no edge returns a warning, because contacts matching it would stop there.\n\nSend `version: 2` on the step. `conditionName`, `operator`, `if`, `noneBranchName` and `branches` are required, and every condition needs `conditionType`, `conditionSubType` and `conditionOperator`, plus `conditionValue` unless the operator takes none, as `has_value` here does not. A branch without a complete condition is rejected with 422. For other fields and operators, build the condition once in the builder and read it back with Get Workflow Definition.",
                  "value": {
                    "version": 1,
                    "name": "Route by email on file",
                    "source": {
                      "system": "api"
                    },
                    "triggers": [
                      {
                        "type": "contact_created"
                      }
                    ],
                    "actions": [
                      {
                        "id": "has-email",
                        "type": "if_else",
                        "name": "Has an email address?",
                        "attributes": {
                          "version": 2,
                          "conditionName": "Has an email address?",
                          "operator": "and",
                          "if": true,
                          "noneBranchName": "No email",
                          "branches": [
                            {
                              "id": "f0c2a6a1-9b1e-4d6a-8f3c-2a7d9e5b1c44",
                              "name": "Has email",
                              "operator": "and",
                              "segments": [
                                {
                                  "operator": "and",
                                  "conditions": [
                                    {
                                      "conditionType": "contact_detail",
                                      "conditionSubType": "email",
                                      "conditionOperator": "has_value"
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      },
                      {
                        "id": "confirm-by-text",
                        "type": "sms",
                        "name": "Confirm by text",
                        "attributes": {
                          "body": "Thanks! The details are in your inbox."
                        }
                      },
                      {
                        "id": "ask-for-email",
                        "type": "sms",
                        "name": "Ask for an email",
                        "attributes": {
                          "body": "Reply with your email address and we will send the details."
                        }
                      }
                    ],
                    "edges": [
                      {
                        "from": "has-email",
                        "to": "confirm-by-text",
                        "branch": "f0c2a6a1-9b1e-4d6a-8f3c-2a7d9e5b1c44"
                      },
                      {
                        "from": "has-email",
                        "to": "ask-for-email",
                        "branch": "no"
                      }
                    ]
                  }
                },
                "wait": {
                  "summary": "3. Wait — pause before the next step",
                  "description": "A `wait` is an ordinary action on the path, not a property of its neighbours. This one holds the contact for two days before the follow-up.\n\n`startAfter.type` accepts `seconds`, `minutes`, `hour`, `hours` or `days`, and `when` is `before`, `after` or `now`. Business-hours behaviour goes in `settings.window` at the root — not on the wait step.",
                  "value": {
                    "version": 1,
                    "name": "Follow up after two days",
                    "source": {
                      "system": "api"
                    },
                    "triggers": [
                      {
                        "type": "contact_created"
                      }
                    ],
                    "actions": [
                      {
                        "id": "wait-one-day",
                        "type": "wait",
                        "name": "Wait 2 days",
                        "attributes": {
                          "type": "time",
                          "startAfter": {
                            "when": "after",
                            "type": "days",
                            "value": 2
                          }
                        }
                      },
                      {
                        "id": "send-welcome-sms",
                        "type": "sms",
                        "name": "Follow-up SMS",
                        "attributes": {
                          "body": "Still interested?"
                        }
                      }
                    ],
                    "edges": [
                      {
                        "from": "wait-one-day",
                        "to": "send-welcome-sms"
                      }
                    ],
                    "settings": {
                      "timezone": "account",
                      "window": {
                        "condition": "when",
                        "start": "09:00",
                        "end": "17:00",
                        "days": [
                          1,
                          2,
                          3,
                          4,
                          5
                        ]
                      }
                    }
                  }
                },
                "webhook": {
                  "summary": "4. Webhook — call an external system",
                  "description": "`method` and `url` are required; `headers` and `customData` are arrays of `{key, value}` pairs rather than plain objects. `customData` becomes the outgoing payload, and merge tags in a value are resolved per contact at send time.",
                  "value": {
                    "version": 1,
                    "name": "Notify external CRM",
                    "source": {
                      "system": "api"
                    },
                    "triggers": [
                      {
                        "type": "contact_created"
                      }
                    ],
                    "actions": [
                      {
                        "id": "send-welcome-sms",
                        "type": "webhook",
                        "name": "POST to CRM",
                        "attributes": {
                          "method": "POST",
                          "url": "https://example.com/hooks/new-contact",
                          "headers": [
                            {
                              "key": "X-Api-Key",
                              "value": "your-api-key"
                            }
                          ],
                          "customData": [
                            {
                              "key": "email",
                              "value": "{{contact.email}}"
                            },
                            {
                              "key": "source",
                              "value": "workflow"
                            }
                          ]
                        }
                      }
                    ],
                    "edges": []
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Workflow updated",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateWorkflowDefinitionResponseDto"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/BadRequestDTO"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnauthorizedDTO"
                }
              }
            }
          },
          "403": {
            "description": "The workflow API is not enabled for this sub-account (code `WORKFLOW_API_NOT_ENABLED_FOR_LOCATION`). Not a token or scope failure.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowApiNotEnabledDto"
                }
              }
            }
          },
          "404": {
            "description": "No such workflow in this location",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowNotFoundDto"
                }
              }
            }
          },
          "409": {
            "description": "The workflow is published (set it to draft first), or was deleted while the update was in flight",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowConflictDto"
                }
              }
            }
          },
          "415": {
            "description": "Content-Type is not application/json",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowUnsupportedMediaTypeDto"
                }
              }
            }
          },
          "422": {
            "description": "The definition was rejected, or `version` is stale — re-read the definition and retry",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowDefinitionUnprocessableDto"
                }
              }
            }
          },
          "429": {
            "description": "Rate limit exceeded. Two limits apply, and either can refuse a request. The integration (OAuth app or private integration) has a daily quota and a 10-second burst limit for this sub-account, reported in the `X-RateLimit-*` headers; for private integrations the daily quota is shared by every private integration token of the sub-account. The sub-account also has its own budget per 10-second window, shared by every token used for it, with reads (get step types, get definition, search) and writes (validate, create, update, change status, delete) counted separately. No header reports the sub-account budget, so a 429 while `X-RateLimit-Remaining` and `X-RateLimit-Daily-Remaining` are both above 0 means that budget is spent. `Retry-After` is not sent: if `X-RateLimit-Daily-Remaining` is 0, wait `X-RateLimit-Daily-Reset` milliseconds; otherwise wait 10 seconds, then retry.",
            "headers": {
              "X-RateLimit-Max": {
                "description": "The integration's requests per burst window for this sub-account",
                "schema": {
                  "type": "integer"
                }
              },
              "X-RateLimit-Remaining": {
                "description": "The integration's requests left in the current burst window",
                "schema": {
                  "type": "integer"
                }
              },
              "X-RateLimit-Interval-Milliseconds": {
                "description": "Length of the burst window",
                "schema": {
                  "type": "integer",
                  "example": 10000
                }
              },
              "X-RateLimit-Limit-Daily": {
                "description": "The integration's daily request quota for this sub-account",
                "schema": {
                  "type": "integer"
                }
              },
              "X-RateLimit-Daily-Remaining": {
                "description": "Requests left in the daily quota",
                "schema": {
                  "type": "integer"
                }
              },
              "X-RateLimit-Daily-Reset": {
                "description": "Milliseconds until the daily quota resets",
                "schema": {
                  "type": "integer"
                }
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowRateLimitedDto"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearer": [
              "workflows.write"
            ]
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearer": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access-Only": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account.",
        "type": "http"
      },
      "Agency-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Agency (OR) Private Integration Token of Agency.",
        "type": "http"
      },
      "Agency-Access-Only": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Agency.",
        "type": "http"
      }
    },
    "schemas": {
      "UpdateWorkflowDefinitionDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Workflow name",
            "example": "Welcome series",
            "maxLength": 500
          },
          "source": {
            "description": "Where this definition came from",
            "example": {
              "system": "api"
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "system": {
                    "type": "string",
                    "description": "Identifier for the system authoring this definition",
                    "example": "my-app"
                  },
                  "workflowId": {
                    "type": "string",
                    "description": "Your own identifier for the workflow, echoed back for correlation",
                    "example": "wf-42"
                  }
                },
                "required": [
                  "system"
                ],
                "title": "WorkflowDefinitionSourceDto"
              }
            ]
          },
          "triggers": {
            "description": "Triggers that enrol contacts. May be empty — a workflow with no trigger can still be entered by another workflow or by the API — but the key must be present.",
            "example": [
              {
                "type": "contact_created",
                "name": "New contact"
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "description": "Trigger type key",
                  "example": "contact_created"
                },
                "name": {
                  "type": "string",
                  "description": "Display name shown on the canvas",
                  "example": "New contact"
                },
                "conditions": {
                  "type": "array",
                  "description": "Trigger filters. Shape depends on `type`; use Validate Workflow Definition to check it.",
                  "items": {
                    "type": "object",
                    "additionalProperties": true
                  },
                  "example": []
                },
                "scheduleConfig": {
                  "description": "Schedule for scheduler-type triggers. Absent on every other trigger type. Get Workflow Definition returns it in this shape and Update Workflow Definition accepts it back.",
                  "example": {
                    "stopAt": 1767225600000,
                    "skipWeekends": true
                  },
                  "allOf": [
                    {
                      "type": "object",
                      "properties": {
                        "stopAt": {
                          "type": "number",
                          "description": "When the schedule stops firing, as epoch milliseconds (UTC). Omit for no end date.",
                          "example": 1767225600000
                        },
                        "skipWeekends": {
                          "type": "boolean",
                          "description": "Skip runs that would fall on a Saturday or Sunday.",
                          "example": true
                        }
                      },
                      "title": "WorkflowDefinitionScheduleConfigDto"
                    }
                  ]
                },
                "id": {
                  "type": "string",
                  "description": "Trigger ID. Assigned when omitted. Get Workflow Definition returns it; sending it back keeps the trigger stable across updates.",
                  "example": "7c1f0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f",
                  "maxLength": 200
                },
                "position": {
                  "description": "Canvas position, as the builder stores it. Echoed by Get Workflow Definition; optional on write.",
                  "example": {
                    "x": 120,
                    "y": 240
                  },
                  "allOf": [
                    {
                      "type": "object",
                      "properties": {
                        "x": {
                          "type": "number",
                          "description": "Horizontal canvas position",
                          "example": 120
                        },
                        "y": {
                          "type": "number",
                          "description": "Vertical canvas position",
                          "example": 240
                        }
                      },
                      "required": [
                        "x",
                        "y"
                      ],
                      "title": "WorkflowDefinitionPositionDto"
                    }
                  ]
                },
                "testResponse": {
                  "type": "object",
                  "description": "Sample event captured by the builder for testing the trigger. Passed through verbatim.",
                  "additionalProperties": true,
                  "example": {
                    "contact": {
                      "id": "c_01HZX3K9P2Q",
                      "email": "jane@example.com"
                    }
                  }
                },
                "metadata": {
                  "type": "object",
                  "description": "Importer bookkeeping. Passed through verbatim.",
                  "additionalProperties": true,
                  "example": {
                    "unmapped": false
                  }
                },
                "workflowsTriggerType": {
                  "type": "string",
                  "description": "Marketplace (IATF) triggers only: the trigger class the app registered. Echoed by Get Workflow Definition; send it back unchanged.",
                  "example": "INTERNAL"
                },
                "integrationAccountId": {
                  "type": "string",
                  "description": "Marketplace (IATF) triggers only: the connected account the trigger listens on.",
                  "example": "acct_01HZX3K9P2Q"
                },
                "masterType": {
                  "type": "string",
                  "description": "Trigger family, as the builder stores it.",
                  "example": "internal"
                },
                "targetActionId": {
                  "type": "string",
                  "description": "For triggers bound to one step (a reply trigger, for example), the ID of that step.",
                  "example": "welcome-sms"
                }
              },
              "required": [
                "type"
              ],
              "title": "WorkflowDefinitionTriggerDto"
            }
          },
          "triggerRelation": {
            "type": "string",
            "description": "How multiple triggers combine. Echoed by Get Workflow Definition; ignored on write — the system always stores `or`.",
            "enum": [
              "and",
              "or"
            ],
            "example": "or"
          },
          "actions": {
            "description": "Steps. May be an empty array, but the key must be present.",
            "example": [
              {
                "id": "send-welcome-sms",
                "type": "sms",
                "attributes": {
                  "body": "Hi there"
                }
              },
              {
                "id": "send-follow-up-sms",
                "type": "sms",
                "attributes": {
                  "body": "Still interested?"
                }
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Step ID. Any non-empty string, unique within the definition — a readable id like `welcome-sms` is fine, and `edges` reference it by that name. It does not have to be a UUID; ids that are not get converted to one when the workflow is saved, so a definition read back will carry the converted ids rather than the ones sent.\n\n**Reuse ids across updates.** A step keeps contacts already mid-workflow on their current step only while it keeps its id. Sending back the ids from Get Workflow Definition is the reliable way to do that — a readable id also converts to the same value every time for a given workflow, so re-sending an authored definition is safe too.",
                  "example": "welcome-sms",
                  "maxLength": 200
                },
                "type": {
                  "type": "string",
                  "description": "Step type key",
                  "example": "add_contact_tag"
                },
                "name": {
                  "type": "string",
                  "description": "Display name shown on the canvas",
                  "example": "Tag as lead"
                },
                "attributes": {
                  "type": "object",
                  "description": "Step configuration. The shape depends on `type` — fetch it from Get Step Types and check it with Validate Workflow Definition.",
                  "additionalProperties": true,
                  "example": {
                    "tags": [
                      "new-lead"
                    ]
                  }
                },
                "position": {
                  "description": "Canvas position, as the builder stores it. Echoed by Get Workflow Definition; optional on write.",
                  "example": {
                    "x": 120,
                    "y": 240
                  },
                  "allOf": [
                    {
                      "type": "object",
                      "properties": {
                        "x": {
                          "type": "number",
                          "description": "Horizontal canvas position",
                          "example": 120
                        },
                        "y": {
                          "type": "number",
                          "description": "Vertical canvas position",
                          "example": 240
                        }
                      },
                      "required": [
                        "x",
                        "y"
                      ],
                      "title": "WorkflowDefinitionPositionDto"
                    }
                  ]
                },
                "metadata": {
                  "type": "object",
                  "description": "Importer bookkeeping. Passed through verbatim.",
                  "additionalProperties": true,
                  "example": {
                    "unmapped": false
                  }
                },
                "workflowsActionType": {
                  "type": "string",
                  "description": "Marketplace (IATF) steps only: the action class the app registered. Echoed by Get Workflow Definition; send it back unchanged.",
                  "example": "INTEGRATION"
                },
                "isMarketplaceAction": {
                  "type": "boolean",
                  "description": "Marketplace (IATF) steps only: marks the step as a marketplace action.",
                  "example": true
                },
                "container": {
                  "type": "string",
                  "description": "ID of the container step this step is nested in, where the builder uses one.",
                  "example": "loop-1"
                }
              },
              "required": [
                "id",
                "type"
              ],
              "title": "WorkflowDefinitionActionDto"
            }
          },
          "edges": {
            "description": "Connections between steps. May be empty, but the key must be present.",
            "example": [
              {
                "from": "send-welcome-sms",
                "to": "send-follow-up-sms"
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "from": {
                  "type": "string",
                  "description": "Step ID this edge leaves from",
                  "example": "welcome-sms"
                },
                "to": {
                  "type": "string",
                  "description": "Step ID this edge arrives at",
                  "example": "tag-as-welcomed"
                },
                "branch": {
                  "type": "string",
                  "description": "Branch label, for steps that fan out. On an if/else it is the `id` of one of the step's declared `branches`, or `no` for the else lane.",
                  "example": "no"
                },
                "goto": {
                  "type": "boolean",
                  "description": "Marks this edge as a loop back to an earlier step",
                  "example": false
                }
              },
              "required": [
                "from",
                "to"
              ],
              "title": "WorkflowDefinitionEdgeDto"
            }
          },
          "settings": {
            "description": "Workflow-level settings",
            "example": {
              "timezone": "account"
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "allowReEntry": {
                    "type": "boolean",
                    "description": "Allow a contact to enter the workflow more than once",
                    "example": false
                  },
                  "allowMultipleOpportunities": {
                    "type": "boolean",
                    "description": "Allow multiple opportunities per contact",
                    "example": false
                  },
                  "stopOnResponse": {
                    "type": "boolean",
                    "description": "Stop the workflow when the contact replies",
                    "example": true
                  },
                  "isConversationsMarkAsRead": {
                    "type": "boolean",
                    "description": "Mark conversations as read automatically",
                    "example": false
                  },
                  "timezone": {
                    "type": "string",
                    "description": "Whose timezone drives scheduling",
                    "enum": [
                      "account",
                      "contact"
                    ],
                    "example": "account"
                  },
                  "window": {
                    "description": "Sending window",
                    "example": {
                      "condition": "when",
                      "start": "09:00",
                      "end": "17:00",
                      "days": [
                        1,
                        2,
                        3,
                        4,
                        5
                      ]
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "condition": {
                            "type": "string",
                            "description": "How the window is applied",
                            "example": "wait"
                          },
                          "start": {
                            "type": "string",
                            "description": "Window start, 24h HH:mm",
                            "example": "09:00"
                          },
                          "end": {
                            "type": "string",
                            "description": "Window end, 24h HH:mm",
                            "example": "17:00"
                          },
                          "days": {
                            "description": "Days of week the window applies to, 0 = Sunday",
                            "example": [
                              1,
                              2,
                              3,
                              4,
                              5
                            ],
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          }
                        },
                        "required": [
                          "condition",
                          "start"
                        ],
                        "title": "WorkflowDefinitionWindowDto"
                      }
                    ]
                  },
                  "senderAddress": {
                    "type": "object",
                    "description": "Default sender details, passed through verbatim. Recognised keys are `from_name`, `from_email` and `from_number`. Declared as a free-form object rather than a typed schema because those keys are snake_case on the wire — the workflow format uses them verbatim, and a typed schema would fail the public-spec camelCase rule while renaming them would break round-tripping.",
                    "additionalProperties": true,
                    "example": {
                      "from_name": "Acme Dental",
                      "from_email": "hello@acme.example"
                    }
                  }
                },
                "title": "WorkflowDefinitionSettingsDto"
              }
            ]
          },
          "folderName": {
            "type": "string",
            "description": "Single-segment folder to place the workflow in. Mutually exclusive with `folderPath`.",
            "example": "Sales"
          },
          "folderPath": {
            "description": "Folder path, outermost first, max 10 levels. Mutually exclusive with `folderName`.",
            "example": [
              "Sales",
              "Q3"
            ],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "createFolderIfMissing": {
            "type": "boolean",
            "description": "Create the folder if it does not exist. Requires `folderName` or `folderPath`.",
            "example": true
          },
          "version": {
            "type": "number",
            "description": "The workflow's version counter, owned by the system — not a format version. Get Workflow Definition fills it in; leave it untouched and send it back on update, and a concurrent edit in the builder can never be silently overwritten. A stale value is rejected with 422.\n\nTreat it as opaque: echo it, never compute from it. It does not always advance by one (delete and restore each add 0.1, and a later save rounds up), so it is not always an integer.\n\nRequired on update: send back the value you read. An update without it is rejected with 422 before anything is written.",
            "example": 3
          }
        },
        "required": [
          "name",
          "source",
          "triggers",
          "actions",
          "edges",
          "version"
        ],
        "example": {
          "version": 1,
          "name": "Welcome new contacts",
          "source": {
            "system": "api"
          },
          "triggers": [
            {
              "type": "contact_created",
              "name": "New contact"
            }
          ],
          "actions": [
            {
              "id": "send-welcome-sms",
              "type": "sms",
              "name": "Send welcome SMS",
              "attributes": {
                "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
              }
            },
            {
              "id": "tag-as-welcomed",
              "type": "add_contact_tag",
              "name": "Tag as welcomed",
              "attributes": {
                "tags": [
                  "welcomed"
                ]
              }
            }
          ],
          "edges": [
            {
              "from": "send-welcome-sms",
              "to": "tag-as-welcomed"
            }
          ]
        },
        "title": "UpdateWorkflowDefinitionDto"
      },
      "UpdateWorkflowDefinitionResponseDto": {
        "type": "object",
        "properties": {
          "workflowId": {
            "type": "string",
            "description": "Workflow ID",
            "example": "b1b0de82-3efb-4d63-83f6-13c50aef208c"
          },
          "status": {
            "type": "string",
            "description": "Whether the workflow is live. Read-only here — change it with Update Workflow Status, which is gated by the workflows.publish scope. Absent only in the rare case where the update succeeded but the workflow could not be read back.",
            "enum": [
              "draft",
              "published"
            ],
            "example": "draft"
          },
          "definition": {
            "type": "object",
            "description": "The updated workflow, in the same shape Get Workflow Definition returns and this endpoint accepts — so a follow-up edit needs no separate read. Note `version` has advanced: an update increments the counter, and sending a stale one is rejected with 422. Absent only if the update succeeded but the workflow could not be read back.",
            "additionalProperties": true,
            "example": {
              "version": 4,
              "name": "Welcome new contacts",
              "source": {
                "system": "api"
              },
              "triggers": [],
              "actions": [],
              "edges": []
            }
          },
          "warnings": {
            "description": "Non-blocking findings",
            "example": [
              {
                "path": "actions[4]",
                "message": "Step has no incoming edges and may be unreachable."
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "description": "Path within the definition",
                  "example": "actions[4]"
                },
                "message": {
                  "type": "string",
                  "description": "What to be aware of",
                  "example": "Action 'orphan-step' has no incoming edges and may be unreachable."
                },
                "type": {
                  "type": "string",
                  "description": "Step type the warning relates to",
                  "example": "sms"
                }
              },
              "title": "WorkflowDefinitionWarningDto"
            }
          }
        },
        "required": [
          "workflowId",
          "warnings"
        ],
        "title": "UpdateWorkflowDefinitionResponseDto"
      },
      "BadRequestDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 400
          },
          "message": {
            "type": "string",
            "example": "Bad Request"
          }
        },
        "title": "BadRequestDTO"
      },
      "UnauthorizedDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 401
          },
          "message": {
            "type": "string",
            "example": "Invalid token: access token is invalid"
          },
          "error": {
            "type": "string",
            "example": "Unauthorized"
          }
        },
        "title": "UnauthorizedDTO"
      },
      "WorkflowApiNotEnabledDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 403
          },
          "error": {
            "type": "string",
            "description": "HTTP error name",
            "example": "Forbidden"
          },
          "code": {
            "type": "string",
            "description": "Stable code to branch on. Only ever this value for an enrolment refusal.",
            "example": "WORKFLOW_API_NOT_ENABLED_FOR_LOCATION"
          },
          "message": {
            "type": "string",
            "description": "Why the request was refused",
            "example": "The workflow API is not enabled for location ve9EPM428h8vShlRW1KT. This is not a token or scope problem — the API is currently available to selected sub-accounts only, and this one is not among them."
          }
        },
        "title": "WorkflowApiNotEnabledDto"
      },
      "WorkflowNotFoundDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 404
          },
          "message": {
            "type": "string",
            "description": "Which workflow was not found, and in which sub-account",
            "example": "Workflow b1b0de82-3efb-4d63-83f6-13c50aef208c not found in location ve9EPM428h8vShlRW1KT"
          },
          "error": {
            "type": "string",
            "description": "HTTP error name",
            "example": "Not Found"
          }
        },
        "title": "WorkflowNotFoundDto"
      },
      "WorkflowConflictDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 409
          },
          "message": {
            "type": "string",
            "description": "Why the request conflicts with the current state of the workflow",
            "example": "Workflow is published. Set it to draft before editing, then publish it again."
          },
          "error": {
            "type": "string",
            "description": "HTTP error name",
            "example": "Conflict"
          }
        },
        "title": "WorkflowConflictDto"
      },
      "WorkflowUnsupportedMediaTypeDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 415
          },
          "message": {
            "description": "What was wrong with the Content-Type header",
            "example": [
              "Content-Type must be application/json, not 'text/plain'"
            ],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "error": {
            "type": "string",
            "description": "HTTP error name",
            "example": "Unsupported Media Type"
          }
        },
        "title": "WorkflowUnsupportedMediaTypeDto"
      },
      "WorkflowDefinitionUnprocessableDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 422
          },
          "message": {
            "description": "Validation errors describing why the request could not be processed",
            "example": [
              "Unprocessable Entity"
            ],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "error": {
            "type": "string",
            "description": "HTTP error name",
            "example": "Unprocessable Entity"
          },
          "errors": {
            "description": "Per-finding detail. This is what tells you which step is wrong.",
            "example": [
              {
                "code": "STEP_VALIDATION_FAILED",
                "message": "Action is missing a required field.",
                "stage": "attributes"
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "code": {
                  "type": "string",
                  "description": "Stable error code you can branch on",
                  "example": "MISSING_REQUIRED_FIELDS"
                },
                "message": {
                  "type": "string",
                  "description": "Human-readable explanation",
                  "example": "Body is required"
                },
                "path": {
                  "type": "string",
                  "description": "Path within the definition",
                  "example": "definition.actions[2].attributes.body"
                },
                "stage": {
                  "type": "string",
                  "description": "Which validation phase produced this",
                  "example": "schema"
                },
                "context": {
                  "type": "object",
                  "description": "Which step or asset the finding relates to",
                  "additionalProperties": true,
                  "example": {
                    "stepId": "9f2c1e40-…",
                    "stepName": "SMS",
                    "stepType": "sms"
                  }
                }
              },
              "title": "WorkflowDefinitionErrorDto"
            }
          }
        },
        "title": "WorkflowDefinitionUnprocessableDto"
      },
      "WorkflowRateLimitedDto": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code",
            "example": 429
          },
          "message": {
            "type": "string",
            "description": "`Too Many Requests` when the integration's quota is spent, `Too Many Requests !` when the sub-account budget is spent. Branch on the status code, not this text.",
            "example": "Too Many Requests !"
          }
        },
        "title": "WorkflowRateLimitedDto"
      }
    }
  }
}
```

## HighLevel SDK Examples

**Node.js** (`@gohighlevel/api-client`)

```javascript
import HighLevel from '@gohighlevel/api-client';

const ghl = new HighLevel({
  privateIntegrationToken: '<PRIVATE_INTEGRATION_TOKEN>'
});

const body = {
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
};

const response = await ghl.workflows.updateWorkflowDefinition('<WORKFLOWID>', { locationId: '<LOCATIONID>' }, body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "version": 1,
    "name": "Welcome new contacts",
    "source": {
        "system": "api"
    },
    "triggers": [
        {
            "type": "contact_created",
            "name": "New contact"
        }
    ],
    "actions": [
        {
            "id": "send-welcome-sms",
            "type": "sms",
            "name": "Send welcome SMS",
            "attributes": {
                "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
            }
        },
        {
            "id": "tag-as-welcomed",
            "type": "add_contact_tag",
            "name": "Tag as welcomed",
            "attributes": {
                "tags": [
                    "welcomed"
                ]
            }
        }
    ],
    "edges": [
        {
            "from": "send-welcome-sms",
            "to": "tag-as-welcomed"
        }
    ]
}

response = await client.workflows.update_workflow_definition('<WORKFLOWID>', locationId='<LOCATIONID>', body=body)
print(response)
```

**PHP** (`gohighlevel/api-client`)

```php
<?php
require_once 'vendor/autoload.php';

use HighLevel\HighLevel;
use HighLevel\HighLevelConfig;

$config = new HighLevelConfig([
    'privateIntegrationToken' => '<PRIVATE_INTEGRATION_TOKEN>'
]);
$ghl = new HighLevel($config);

$body = [
    'version' => 1,
    'name' => 'Welcome new contacts',
    'source' => [
        'system' => 'api'
    ],
    'triggers' => [
        [
            'type' => 'contact_created',
            'name' => 'New contact'
        ]
    ],
    'actions' => [
        [
            'id' => 'send-welcome-sms',
            'type' => 'sms',
            'name' => 'Send welcome SMS',
            'attributes' => [
                'body' => 'Hi {{contact.first_name}}, thanks for getting in touch!'
            ]
        ],
        [
            'id' => 'tag-as-welcomed',
            'type' => 'add_contact_tag',
            'name' => 'Tag as welcomed',
            'attributes' => [
                'tags' => [
                    'welcomed'
                ]
            ]
        ]
    ],
    'edges' => [
        [
            'from' => 'send-welcome-sms',
            'to' => 'tag-as-welcomed'
        ]
    ]
];

$response = $ghl->workflows->updateWorkflowDefinition('<WORKFLOWID>', ['locationId' => '<LOCATIONID>'], $body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X PUT 'https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
}'
```

**Node.js**

```javascript
const options = {
  method: 'PUT',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: 'v3',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "version": 1,
      "name": "Welcome new contacts",
      "source": {
        "system": "api"
      },
      "triggers": [
        {
          "type": "contact_created",
          "name": "New contact"
        }
      ],
      "actions": [
        {
          "id": "send-welcome-sms",
          "type": "sms",
          "name": "Send welcome SMS",
          "attributes": {
            "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
          }
        },
        {
          "id": "tag-as-welcomed",
          "type": "add_contact_tag",
          "name": "Tag as welcomed",
          "attributes": {
            "tags": [
              "welcomed"
            ]
          }
        }
      ],
      "edges": [
        {
          "from": "send-welcome-sms",
          "to": "tag-as-welcomed"
        }
      ]
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/workflows/{workflowId}/definition"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

params = {
    "locationId": "<LOCATIONID>"
}

payload = {
    "version": 1,
    "name": "Welcome new contacts",
    "source": {
        "system": "api"
    },
    "triggers": [
        {
            "type": "contact_created",
            "name": "New contact"
        }
    ],
    "actions": [
        {
            "id": "send-welcome-sms",
            "type": "sms",
            "name": "Send welcome SMS",
            "attributes": {
                "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
            }
        },
        {
            "id": "tag-as-welcomed",
            "type": "add_contact_tag",
            "name": "Tag as welcomed",
            "attributes": {
                "tags": [
                    "welcomed"
                ]
            }
        }
    ],
    "edges": [
        {
            "from": "send-welcome-sms",
            "to": "tag-as-welcomed"
        }
    ]
}

response = requests.put(url, params=params, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'PUT',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .put("https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .header("Content-Type", "application/json")
  .body("{\"version\":1,\"name\":\"Welcome new contacts\",\"source\":{\"system\":\"api\"},\"triggers\":[{\"type\":\"contact_created\",\"name\":\"New contact\"}],\"actions\":[{\"id\":\"send-welcome-sms\",\"type\":\"sms\",\"name\":\"Send welcome SMS\",\"attributes\":{\"body\":\"Hi {{contact.first_name}}, thanks for getting in touch!\"}},{\"id\":\"tag-as-welcomed\",\"type\":\"add_contact_tag\",\"name\":\"Tag as welcomed\",\"attributes\":{\"tags\":[\"welcomed\"]}}],\"edges\":[{\"from\":\"send-welcome-sms\",\"to\":\"tag-as-welcomed\"}]}")
  .asString();
```

**Go**

```go
package main

import (
  "fmt"
  "net/http"
  "io"
  "strings"
)

func main() {
  url := "https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>"
  payload := strings.NewReader(`{
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
}`)
  req, _ := http.NewRequest("PUT", url, payload)
  req.Header.Add("Authorization", "Bearer <TOKEN>")
  req.Header.Add("Version", "v3")

  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}
```

**Ruby**

```ruby
require 'uri'
require 'net/http'

url = URI("https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Put.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"
request["Content-Type"] = "application/json"
request.body = '{
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
}'

response = http.request(request)
puts response.read_body
```

**PowerShell**

```powershell
$headers = @{
  "Authorization" = "Bearer <TOKEN>"
  "Version" = "v3"
}

$body = '{
  "version": 1,
  "name": "Welcome new contacts",
  "source": {
    "system": "api"
  },
  "triggers": [
    {
      "type": "contact_created",
      "name": "New contact"
    }
  ],
  "actions": [
    {
      "id": "send-welcome-sms",
      "type": "sms",
      "name": "Send welcome SMS",
      "attributes": {
        "body": "Hi {{contact.first_name}}, thanks for getting in touch!"
      }
    },
    {
      "id": "tag-as-welcomed",
      "type": "add_contact_tag",
      "name": "Tag as welcomed",
      "attributes": {
        "tags": [
          "welcomed"
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "send-welcome-sms",
      "to": "tag-as-welcomed"
    }
  ]
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/workflows/<workflowId>/definition?locationId=<LOCATIONID>' -Method 'PUT' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```
