# Update Contact

PUT https://services.leadconnectorhq.com/contacts/{contactId}

Update a contact using contactId

> ⚠️ **When updating additional emails/phones, always include the current primary `email`/`phone` in the same request. Otherwise, the existing primary value may be lost.**

## Authentication

Send `Authorization: Bearer <token>` using:

- **Sub-Account token: OAuth access token or Private Integration Token.** Scopes: `contacts.write`

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version |

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `contactId` | string | Yes | Unique identifier of the contact |

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
    "/contacts/{contactId}": {
      "put": {
        "summary": "Update Contact",
        "operationId": "updateContact",
        "description": "Update a contact using contactId\n\n> ⚠️ **When updating additional emails/phones, always include the current primary `email`/`phone` in the same request. Otherwise, the existing primary value may be lost.**",
        "parameters": [
          {
            "name": "Version",
            "in": "header",
            "description": "API Version",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "v3"
              ]
            }
          },
          {
            "name": "contactId",
            "required": true,
            "in": "path",
            "description": "Unique identifier of the contact",
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
                "$ref": "#/components/schemas/UpdateContactDtoV3"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateContactsSuccessfulResponseDtoV3"
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
          "422": {
            "description": "Unprocessable Entity",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnprocessableDTO"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearer": [
              "contacts.write"
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
      "UpdateContactDtoV3": {
        "type": "object",
        "properties": {
          "firstName": {
            "type": "string",
            "description": "First name of the contact",
            "example": "rosan",
            "nullable": true
          },
          "lastName": {
            "type": "string",
            "description": "Last name of the contact",
            "example": "Deo",
            "nullable": true
          },
          "name": {
            "type": "string",
            "description": "Full name of the contact",
            "example": "rosan Deo",
            "nullable": true
          },
          "email": {
            "type": "string",
            "description": "Email address of the contact",
            "example": "rosan@deos.com",
            "nullable": true
          },
          "phone": {
            "type": "string",
            "description": "Phone number of the contact",
            "example": "+1 888-888-8888",
            "nullable": true
          },
          "address1": {
            "type": "string",
            "description": "Street address of the contact",
            "example": "3535 1st St N",
            "nullable": true
          },
          "city": {
            "type": "string",
            "description": "City of the contact",
            "example": "Dolomite",
            "nullable": true
          },
          "state": {
            "type": "string",
            "description": "State of the contact",
            "example": "AL",
            "nullable": true
          },
          "postalCode": {
            "type": "string",
            "description": "Postal code of the contact",
            "example": "35061"
          },
          "website": {
            "type": "string",
            "description": "Website URL of the contact",
            "example": "https://www.tesla.com",
            "nullable": true
          },
          "timezone": {
            "type": "string",
            "description": "Timezone of the contact",
            "example": "America/Chihuahua",
            "nullable": true
          },
          "dnd": {
            "type": "boolean",
            "description": "Whether Do Not Disturb is enabled for the contact",
            "example": true
          },
          "inboundDndSettings": {
            "description": "Inbound DND settings per channel for the contact",
            "example": {
              "all": {
                "status": "active",
                "message": "Do not contact me"
              }
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "all": {
                    "description": "Inbound DND settings applied to all channels",
                    "example": {
                      "status": "active",
                      "message": "Do not contact me"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Inbound DND status for this channel",
                            "enum": [
                              "active",
                              "inactive"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the inbound DND setting",
                            "example": "Please do not contact me via this channel"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "InboundDndSettingSchema"
                      }
                    ]
                  }
                },
                "title": "InboundDndSettingsSchema"
              }
            ]
          },
          "tags": {
            "example": [
              "nisi sint commodo amet",
              "consequat"
            ],
            "description": "This field will overwrite all current tags associated with the contact. To update a tags, it is recommended to use the Add Tag or Remove Tag API instead.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "customFields": {
            "type": "array",
            "description": "List of custom field values to assign to the contact",
            "example": [
              {
                "id": "6dvNaf7VhkQ9snc5vnjJ",
                "key": "my_custom_field",
                "fieldValue": "My Text"
              }
            ],
            "items": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "string",
                      "description": "Text value for the custom field (preferred).",
                      "example": "My Text"
                    },
                    "field_value": {
                      "type": "string",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": "My Text"
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "TextField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "string",
                      "description": "Large text value for the custom field (preferred).",
                      "example": "My Text"
                    },
                    "field_value": {
                      "type": "string",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": "My Text"
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "LargeTextField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "string",
                      "description": "Selected option value for the custom field (preferred).",
                      "example": "My Selected Option"
                    },
                    "field_value": {
                      "type": "string",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": "My Selected Option"
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "SingleSelectField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "string",
                      "description": "Selected radio option value for the custom field (preferred).",
                      "example": "My Selected Option"
                    },
                    "field_value": {
                      "type": "string",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": "My Selected Option"
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "RadioField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "object",
                      "description": "Numeric value for the custom field (preferred).",
                      "example": 100
                    },
                    "field_value": {
                      "type": "object",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": 100
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "NumericField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "object",
                      "description": "Monetary value for the custom field (preferred).",
                      "example": 100.5
                    },
                    "field_value": {
                      "type": "object",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": 100.5
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "MonetoryField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "description": "Array of selected checkbox values for the custom field (preferred).",
                      "example": [
                        "test",
                        "test2"
                      ],
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "field_value": {
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": [
                        "test",
                        "test2"
                      ],
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "CheckboxField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "description": "Array of selected values for the custom field (preferred).",
                      "example": [
                        "test",
                        "test2"
                      ],
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "field_value": {
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": [
                        "test",
                        "test2"
                      ],
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "MultiSelectField"
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "6dvNaf7VhkQ9snc5vnjJ"
                    },
                    "key": {
                      "type": "string",
                      "description": "Pass either `id` or `key` of custom field",
                      "example": "my_custom_field"
                    },
                    "fieldValue": {
                      "type": "object",
                      "description": "File upload value — a map of UUID to file metadata and download URL (preferred).",
                      "example": {
                        "f31175d4-2b06-4fc6-b7bc-74cd814c68cb": {
                          "meta": {
                            "fieldname": "1HeGizb13P0odwgOgKSs",
                            "originalname": "IMG_20231215_164412935.jpg",
                            "encoding": "7bit",
                            "mimetype": "image/jpeg",
                            "size": 1786611,
                            "uuid": "f31175d4-2b06-4fc6-b7bc-74cd814c68cb"
                          },
                          "url": "https://services.leadconnectorhq.com/documents/download/w2M9qTZ0ZJz8rGt02jdJ",
                          "documentId": "w2M9qTZ0ZJz8rGt02jdJ"
                        }
                      }
                    },
                    "field_value": {
                      "type": "object",
                      "deprecated": true,
                      "description": "Deprecated. Use `fieldValue` instead.",
                      "example": {
                        "f31175d4-2b06-4fc6-b7bc-74cd814c68cb": {
                          "meta": {
                            "fieldname": "1HeGizb13P0odwgOgKSs",
                            "originalname": "IMG_20231215_164412935.jpg",
                            "encoding": "7bit",
                            "mimetype": "image/jpeg",
                            "size": 1786611,
                            "uuid": "f31175d4-2b06-4fc6-b7bc-74cd814c68cb"
                          },
                          "url": "https://services.leadconnectorhq.com/documents/download/w2M9qTZ0ZJz8rGt02jdJ",
                          "documentId": "w2M9qTZ0ZJz8rGt02jdJ"
                        }
                      }
                    }
                  },
                  "required": [
                    "id"
                  ],
                  "title": "FileField"
                }
              ]
            }
          },
          "source": {
            "type": "string",
            "description": "Source from which the contact was updated",
            "example": "public api",
            "nullable": true
          },
          "dateOfBirth": {
            "type": "object",
            "description": "The birth date of the contact. Supported formats: YYYY/MM/DD, MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, YYYY.MM.DD, MM.DD.YYYY, YYYY_MM_DD, MM_DD_YYYY",
            "example": "1990-09-25",
            "nullable": true
          },
          "country": {
            "type": "string",
            "description": "Country code of the contact (ISO 3166-1 alpha-2), Refer country list from documentaion, documentation has list of all countries",
            "example": "US"
          },
          "assignedTo": {
            "type": "string",
            "example": "y0BeYjuRIlDwsDcOHOJo",
            "description": "User's Id",
            "nullable": true
          },
          "additionalEmails": {
            "description": "Add additional email addresses to a contact.\n\n> ⚠️ **Important:** When sending `additionalEmails`, you must also include the contact’s current primary `email` in the same request.<br>If you send `additionalEmails` without `email`, the contact’s existing primary email may be cleared or replaced.\n\n<ul style=\"list-style: disc; padding-left: 1.5rem\">\n<li style=\"list-style: disc\"><code>email</code> represents the contact’s <strong>primary email address</strong>.</li>\n<li style=\"list-style: disc\"><code>additionalEmails</code> represents secondary email addresses for the same contact.</li>\n<li style=\"list-style: disc\">Always send the primary <code>email</code> together with <code>additionalEmails</code> when updating email addresses.</li>\n<li style=\"list-style: disc\">A maximum of <strong>10 additional email addresses</strong> can be provided.</li>\n</ul>\n\nExample\n\n```json\n{\n  \"email\": \"john@example.com\",\n  \"additionalEmails\": [\n    {\n      \"email\": \"john.work@example.com\"\n    }\n  ]\n}\n```\n\nAvoid\n\n```json\n{\n  \"additionalEmails\": [\n    {\n      \"email\": \"john.work@example.com\"\n    }\n  ]\n}\n```\n\nSending only `additionalEmails` may cause the existing primary email to be lost.\n\nIf email uniqueness is enabled for the location, every email address in the request—primary and additional—must be unique across contacts. If any email already belongs to another contact, the request fails with **400 Bad Request** and no changes are saved.",
            "maxItems": 10,
            "example": [
              {
                "email": "rosan@deos.com"
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "email": {
                  "type": "string",
                  "example": "rosan@deos.com",
                  "description": "Additional Email"
                }
              },
              "required": [
                "email"
              ],
              "title": "ContactsAdditionalEmailsPayloadDto"
            }
          },
          "additionalPhones": {
            "description": "Add additional phone numbers to a contact.\n\n> ⚠️ **Important:** When sending `additionalPhones`, you must also include the contact’s current primary `phone` in the same request.<br>If you send `additionalPhones` without `phone`, the contact’s existing primary phone may be cleared or replaced.\n\n<ul style=\"list-style: disc; padding-left: 1.5rem\">\n<li style=\"list-style: disc\"><code>phone</code> represents the contact’s <strong>primary phone number</strong>.</li>\n<li style=\"list-style: disc\"><code>additionalPhones</code> represents secondary phone numbers for the same contact.</li>\n<li style=\"list-style: disc\">Always send the primary <code>phone</code> together with <code>additionalPhones</code> when updating phone numbers.</li>\n<li style=\"list-style: disc\">A maximum of <strong>10 additional phone numbers</strong> can be provided.</li>\n<li style=\"list-style: disc\"><code>phoneLabel</code> is optional. Allowed values: <code>Home</code>, <code>Work</code>, <code>Mobile</code>, or <code>Landline</code>. A label can belong to only one phone number on the contact, including the primary. If a label is repeated, it is kept on the first phone number and removed from the others.</li>\n</ul>\n\nExample\n\n```json\n{\n  \"phone\": \"+14155550100\",\n  \"additionalPhones\": [\n    {\n      \"phone\": \"+14155550101\",\n      \"phoneLabel\": \"Work\"\n    }\n  ]\n}\n```\n\nAvoid\n\n```json\n{\n  \"additionalPhones\": [\n    {\n      \"phone\": \"+14155550101\",\n      \"phoneLabel\": \"Work\"\n    }\n  ]\n}\n```\n\nSending only `additionalPhones` may cause the existing primary phone number to be lost.\n\nIf phone uniqueness is enabled for the location, every phone number in the request—primary and additional—must be unique across contacts. If any phone number already belongs to another contact, the request fails with **400 Bad Request** and no changes are saved.",
            "maxItems": 10,
            "example": [
              {
                "phone": "+18832327657",
                "phoneLabel": "Mobile"
              }
            ],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "phone": {
                  "type": "string",
                  "example": "7017345098",
                  "description": "Additional Phones"
                },
                "phoneLabel": {
                  "type": "string",
                  "description": "Label",
                  "enum": [
                    "Home",
                    "Work",
                    "Mobile",
                    "Landline"
                  ],
                  "example": "Mobile"
                }
              },
              "required": [
                "phone"
              ],
              "title": "ContactsAdditionalPhonesPayloadDto"
            }
          },
          "dndSettings": {
            "description": "Per-channel DND settings for the contact",
            "example": {
              "call": {
                "status": "active",
                "message": "Do not call"
              },
              "email": {
                "status": "inactive"
              }
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "call": {
                    "description": "DND settings for phone calls",
                    "example": {
                      "status": "active",
                      "message": "Do not call",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  },
                  "email": {
                    "description": "DND settings for email",
                    "example": {
                      "status": "active",
                      "message": "Do not email",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  },
                  "sms": {
                    "description": "DND settings for SMS",
                    "example": {
                      "status": "active",
                      "message": "Do not SMS",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  },
                  "whatsApp": {
                    "description": "DND settings for WhatsApp",
                    "example": {
                      "status": "active",
                      "message": "Do not WhatsApp",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  },
                  "gmb": {
                    "description": "DND settings for Google My Business",
                    "example": {
                      "status": "active",
                      "message": "Do not contact via GMB",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  },
                  "fb": {
                    "description": "DND settings for Facebook",
                    "example": {
                      "status": "active",
                      "message": "Do not contact via FB",
                      "code": "all"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "description": "Do Not Disturb status for this channel",
                            "enum": [
                              "active",
                              "inactive",
                              "permanent"
                            ],
                            "example": "active"
                          },
                          "message": {
                            "type": "string",
                            "description": "Custom message associated with the DND setting",
                            "example": "Do not contact via this channel"
                          },
                          "code": {
                            "type": "string",
                            "description": "DND code or reason",
                            "example": "OPTED_OUT"
                          }
                        },
                        "required": [
                          "status"
                        ],
                        "title": "DndSettingSchema"
                      }
                    ]
                  }
                },
                "title": "DndSettingsSchemaV3"
              }
            ]
          }
        },
        "title": "UpdateContactDtoV3"
      },
      "UpdateContactsSuccessfulResponseDtoV3": {
        "type": "object",
        "properties": {
          "succeeded": {
            "type": "boolean",
            "description": "Whether the update operation succeeded",
            "example": true
          },
          "contact": {
            "description": "Contact details",
            "example": {
              "id": "seD4PfOuKoVMLkEZqohJ",
              "name": "rubika deo",
              "email": "rubika@deos.com",
              "locationId": "ve9EPM428h8vShlRW1KT"
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "description": "Unique identifier of the contact",
                    "example": "seD4PfOuKoVMLkEZqohJ"
                  },
                  "name": {
                    "type": "string",
                    "description": "Full name of the contact",
                    "example": "rubika deo"
                  },
                  "locationId": {
                    "type": "string",
                    "description": "Location Id the contact belongs to",
                    "example": "ve9EPM428h8vShlRW1KT"
                  },
                  "firstName": {
                    "type": "string",
                    "description": "First name of the contact",
                    "example": "rubika"
                  },
                  "lastName": {
                    "type": "string",
                    "description": "Last name of the contact",
                    "example": "Deo"
                  },
                  "email": {
                    "type": "string",
                    "description": "Email address of the contact",
                    "example": "rubika@deos.com"
                  },
                  "emailLowerCase": {
                    "type": "string",
                    "description": "Lowercase version of the contact email",
                    "example": "rubika@deos.com"
                  },
                  "timezone": {
                    "type": "string",
                    "description": "Timezone of the contact",
                    "example": "Asia/Calcutta"
                  },
                  "companyName": {
                    "type": "string",
                    "description": "Company name of the contact",
                    "example": "DGS VolMAX"
                  },
                  "phone": {
                    "type": "string",
                    "description": "Phone number of the contact",
                    "example": "+18832327657"
                  },
                  "dnd": {
                    "type": "boolean",
                    "description": "Whether Do Not Disturb is enabled for the contact",
                    "example": true
                  },
                  "type": {
                    "type": "string",
                    "description": "Contact type classification",
                    "example": "lead"
                  },
                  "source": {
                    "type": "string",
                    "description": "Source from which the contact was created",
                    "example": "public api"
                  },
                  "assignedTo": {
                    "type": "string",
                    "description": "User Id the contact is assigned to",
                    "example": "ve9EPM428h8vShlRW1KT"
                  },
                  "address1": {
                    "type": "string",
                    "description": "Street address of the contact",
                    "example": "3535 1st St N"
                  },
                  "city": {
                    "type": "string",
                    "description": "City of the contact",
                    "example": "Birmingham"
                  },
                  "state": {
                    "type": "string",
                    "description": "State of the contact",
                    "example": "AL"
                  },
                  "country": {
                    "type": "string",
                    "description": "Country of the contact",
                    "example": "US"
                  },
                  "postalCode": {
                    "type": "string",
                    "description": "Postal code of the contact",
                    "example": "35061"
                  },
                  "website": {
                    "type": "string",
                    "description": "Website URL of the contact",
                    "example": "https://www.tesla.com"
                  },
                  "tags": {
                    "description": "List of tags associated with the contact",
                    "example": [
                      "nisi sint commodo amet",
                      "consequat"
                    ],
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "dateOfBirth": {
                    "type": "string",
                    "description": "Date of birth of the contact (YYYY-MM-DD)",
                    "example": "1990-09-25"
                  },
                  "dateAdded": {
                    "type": "string",
                    "description": "Date and time the contact was added (ISO 8601)",
                    "example": "2021-07-02T05:18:26.704Z"
                  },
                  "dateUpdated": {
                    "type": "string",
                    "description": "Date and time the contact was last updated (ISO 8601)",
                    "example": "2021-07-02T05:18:26.704Z"
                  },
                  "attachments": {
                    "type": "string",
                    "description": "List of attachment URLs associated with the contact",
                    "example": []
                  },
                  "ssn": {
                    "type": "string",
                    "description": "Social Security Number (if applicable)",
                    "example": "123-45-6789"
                  },
                  "keyword": {
                    "type": "string",
                    "description": "Search keyword associated with the contact",
                    "example": "test"
                  },
                  "firstNameLowerCase": {
                    "type": "string",
                    "description": "Lowercase version of the contact first name",
                    "example": "rubika"
                  },
                  "fullNameLowerCase": {
                    "type": "string",
                    "description": "Lowercase version of the contact full name",
                    "example": "rubika deo"
                  },
                  "lastNameLowerCase": {
                    "type": "string",
                    "description": "Lowercase version of the contact last name",
                    "example": "deo"
                  },
                  "lastActivity": {
                    "type": "string",
                    "description": "Date and time of last activity on this contact (ISO 8601)",
                    "example": "2021-07-16T11:39:30.564Z"
                  },
                  "customFields": {
                    "description": "List of custom field values for the contact",
                    "example": [
                      {
                        "id": "6dvNaf7VhkQ9snc5vnjJ",
                        "value": "My Text"
                      }
                    ],
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "description": "Unique identifier of the custom field",
                          "example": "MgobCB14YMVKuE4Ka8p1"
                        },
                        "value": {
                          "type": "string",
                          "description": "Value of the custom field",
                          "example": "name"
                        }
                      },
                      "title": "CustomFieldSchema"
                    }
                  },
                  "businessId": {
                    "type": "string",
                    "description": "Business Id the contact is associated with",
                    "example": "641c094001436dbc2081e642"
                  },
                  "attributionSource": {
                    "description": "First-touch attribution source details for the contact",
                    "example": {
                      "url": "Trigger Link",
                      "campaign": "Summer Sale"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "url": {
                            "type": "string",
                            "description": "Attribution source type",
                            "example": "Trigger Link"
                          },
                          "campaign": {
                            "type": "string",
                            "description": "Campaign name",
                            "example": "Summer Sale 2024",
                            "nullable": true
                          },
                          "utmSource": {
                            "type": "string",
                            "description": "UTM source parameter",
                            "example": "google",
                            "nullable": true
                          },
                          "utmMedium": {
                            "type": "string",
                            "description": "UTM medium parameter",
                            "example": "cpc",
                            "nullable": true
                          },
                          "utmContent": {
                            "type": "string",
                            "description": "UTM content parameter",
                            "example": "ad_variation_1",
                            "nullable": true
                          },
                          "referrer": {
                            "type": "string",
                            "description": "Referrer URL",
                            "example": "https://www.google.com",
                            "nullable": true
                          },
                          "campaignId": {
                            "type": "string",
                            "description": "Campaign Id",
                            "example": "641c094001436dbc2081e642",
                            "nullable": true
                          },
                          "fbclid": {
                            "type": "string",
                            "description": "Facebook click Id",
                            "example": "fb.1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "gclid": {
                            "type": "string",
                            "description": "Google click Id",
                            "example": "CjOKCQjwnNyUBhCZARISAI9AYIFtNnIcWcYGIOQINz_ZoFI5SSLRRugSoPZoiEu27IZBY£1-MAIWmEaAo2VEALW_WCB",
                            "nullable": true
                          },
                          "msclikid": {
                            "type": "string",
                            "description": "Microsoft click Id",
                            "example": "MS!AzEREREDJKSJD",
                            "nullable": true
                          },
                          "dclid": {
                            "type": "string",
                            "description": "DoubleClick click Id",
                            "example": "EAIaIQobChMIw",
                            "nullable": true
                          },
                          "fbc": {
                            "type": "string",
                            "description": "Facebook browser Id",
                            "example": "fb.1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "fbp": {
                            "type": "string",
                            "description": "Facebook pixel Id",
                            "example": "fb. 1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "fbEventId": {
                            "type": "string",
                            "description": "Facebook event Id",
                            "example": "Mozilla/5.0",
                            "nullable": true
                          },
                          "userAgent": {
                            "type": "string",
                            "description": "Browser user agent string",
                            "example": "Mozilla/5.0",
                            "nullable": true
                          },
                          "ip": {
                            "type": "string",
                            "description": "IP address of the visitor",
                            "example": "58.111.106.198",
                            "nullable": true
                          },
                          "medium": {
                            "type": "string",
                            "description": "Attribution medium (e.g. survey, funnel)",
                            "example": "survey",
                            "nullable": true
                          },
                          "mediumId": {
                            "type": "string",
                            "description": "Id of the attribution medium",
                            "example": "FglfHAn30PRwsZVyQlKp",
                            "nullable": true
                          }
                        },
                        "required": [
                          "url"
                        ],
                        "title": "AttributionSource"
                      }
                    ]
                  },
                  "lastAttributionSource": {
                    "description": "Last-touch attribution source details for the contact",
                    "example": {
                      "url": "Organic Search",
                      "campaign": "Brand Awareness"
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "url": {
                            "type": "string",
                            "description": "Attribution source type",
                            "example": "Trigger Link"
                          },
                          "campaign": {
                            "type": "string",
                            "description": "Campaign name",
                            "example": "Summer Sale 2024",
                            "nullable": true
                          },
                          "utmSource": {
                            "type": "string",
                            "description": "UTM source parameter",
                            "example": "google",
                            "nullable": true
                          },
                          "utmMedium": {
                            "type": "string",
                            "description": "UTM medium parameter",
                            "example": "cpc",
                            "nullable": true
                          },
                          "utmContent": {
                            "type": "string",
                            "description": "UTM content parameter",
                            "example": "ad_variation_1",
                            "nullable": true
                          },
                          "referrer": {
                            "type": "string",
                            "description": "Referrer URL",
                            "example": "https://www.google.com",
                            "nullable": true
                          },
                          "campaignId": {
                            "type": "string",
                            "description": "Campaign Id",
                            "example": "641c094001436dbc2081e642",
                            "nullable": true
                          },
                          "fbclid": {
                            "type": "string",
                            "description": "Facebook click Id",
                            "example": "fb.1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "gclid": {
                            "type": "string",
                            "description": "Google click Id",
                            "example": "CjOKCQjwnNyUBhCZARISAI9AYIFtNnIcWcYGIOQINz_ZoFI5SSLRRugSoPZoiEu27IZBY£1-MAIWmEaAo2VEALW_WCB",
                            "nullable": true
                          },
                          "msclikid": {
                            "type": "string",
                            "description": "Microsoft click Id",
                            "example": "MS!AzEREREDJKSJD",
                            "nullable": true
                          },
                          "dclid": {
                            "type": "string",
                            "description": "DoubleClick click Id",
                            "example": "EAIaIQobChMIw",
                            "nullable": true
                          },
                          "fbc": {
                            "type": "string",
                            "description": "Facebook browser Id",
                            "example": "fb.1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "fbp": {
                            "type": "string",
                            "description": "Facebook pixel Id",
                            "example": "fb. 1.1674748390986.1171287961",
                            "nullable": true
                          },
                          "fbEventId": {
                            "type": "string",
                            "description": "Facebook event Id",
                            "example": "Mozilla/5.0",
                            "nullable": true
                          },
                          "userAgent": {
                            "type": "string",
                            "description": "Browser user agent string",
                            "example": "Mozilla/5.0",
                            "nullable": true
                          },
                          "ip": {
                            "type": "string",
                            "description": "IP address of the visitor",
                            "example": "58.111.106.198",
                            "nullable": true
                          },
                          "medium": {
                            "type": "string",
                            "description": "Attribution medium (e.g. survey, funnel)",
                            "example": "survey",
                            "nullable": true
                          },
                          "mediumId": {
                            "type": "string",
                            "description": "Id of the attribution medium",
                            "example": "FglfHAn30PRwsZVyQlKp",
                            "nullable": true
                          }
                        },
                        "required": [
                          "url"
                        ],
                        "title": "AttributionSource"
                      }
                    ]
                  },
                  "additionalEmails": {
                    "description": "Additional emails associated with the contact",
                    "example": [
                      {
                        "email": "rosan@deos.com"
                      }
                    ],
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "email": {
                          "type": "string",
                          "example": "rosan@deos.com",
                          "description": "Additional Email"
                        }
                      },
                      "required": [
                        "email"
                      ],
                      "title": "ContactsAddtionalEmailsResponseDto"
                    }
                  },
                  "additionalPhones": {
                    "description": "Additional phone numbers associated with the contact",
                    "example": [
                      {
                        "phone": "+18832327657",
                        "phoneLabel": "Mobile"
                      }
                    ],
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "phone": {
                          "type": "string",
                          "example": "7017345098",
                          "description": "Additional Phones"
                        },
                        "phoneLabel": {
                          "type": "string",
                          "description": "Label",
                          "enum": [
                            "Home",
                            "Work",
                            "Mobile",
                            "Landline"
                          ],
                          "example": "Mobile"
                        }
                      },
                      "required": [
                        "phone"
                      ],
                      "title": "ContactsAdditionalPhonesPayloadDto"
                    }
                  },
                  "visitorId": {
                    "type": "string",
                    "description": "visitorId is the Unique ID assigned to each Live chat visitor.",
                    "example": "ve9EPM428h8vShlRW1KT"
                  },
                  "dndSettings": {
                    "description": "Per-channel DND settings for the contact",
                    "example": {
                      "call": {
                        "status": "active",
                        "message": "Do not call"
                      },
                      "email": {
                        "status": "inactive"
                      }
                    },
                    "allOf": [
                      {
                        "type": "object",
                        "properties": {
                          "call": {
                            "description": "DND settings for phone calls",
                            "example": {
                              "status": "active",
                              "message": "Do not call",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          },
                          "email": {
                            "description": "DND settings for email",
                            "example": {
                              "status": "active",
                              "message": "Do not email",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          },
                          "sms": {
                            "description": "DND settings for SMS",
                            "example": {
                              "status": "active",
                              "message": "Do not SMS",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          },
                          "whatsApp": {
                            "description": "DND settings for WhatsApp",
                            "example": {
                              "status": "active",
                              "message": "Do not WhatsApp",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          },
                          "gmb": {
                            "description": "DND settings for Google My Business",
                            "example": {
                              "status": "active",
                              "message": "Do not contact via GMB",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          },
                          "fb": {
                            "description": "DND settings for Facebook",
                            "example": {
                              "status": "active",
                              "message": "Do not contact via FB",
                              "code": "all"
                            },
                            "allOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "status": {
                                    "type": "string",
                                    "description": "Do Not Disturb status for this channel",
                                    "enum": [
                                      "active",
                                      "inactive",
                                      "permanent"
                                    ],
                                    "example": "active"
                                  },
                                  "message": {
                                    "type": "string",
                                    "description": "Custom message associated with the DND setting",
                                    "example": "Do not contact via this channel"
                                  },
                                  "code": {
                                    "type": "string",
                                    "description": "DND code or reason",
                                    "example": "OPTED_OUT"
                                  }
                                },
                                "required": [
                                  "status"
                                ],
                                "title": "DndSettingSchema"
                              }
                            ]
                          }
                        },
                        "title": "DndSettingsSchemaV3"
                      }
                    ]
                  }
                },
                "title": "GetContactByIdSchemaV3"
              }
            ]
          }
        },
        "title": "UpdateContactsSuccessfulResponseDtoV3"
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
      "UnprocessableDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 422
          },
          "message": {
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
            "example": "Unprocessable Entity"
          }
        },
        "title": "UnprocessableDTO"
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
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
};

const response = await ghl.contacts.updateContact('<CONTACTID>', body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "firstName": "rosan",
    "lastName": "Deo",
    "name": "rosan Deo",
    "email": "rosan@deos.com",
    "phone": "+1 888-888-8888",
    "address1": "3535 1st St N",
    "city": "Dolomite",
    "state": "AL",
    "postalCode": "35061",
    "website": "https://www.tesla.com",
    "timezone": "America/Chihuahua",
    "dnd": true,
    "inboundDndSettings": {
        "all": {
            "status": "active",
            "message": "Do not contact me"
        }
    },
    "tags": [
        "nisi sint commodo amet",
        "consequat"
    ],
    "customFields": [
        {
            "id": "6dvNaf7VhkQ9snc5vnjJ",
            "key": "my_custom_field",
            "fieldValue": "My Text"
        }
    ],
    "source": "public api",
    "dateOfBirth": "1990-09-25",
    "country": "US",
    "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
    "additionalEmails": [
        {
            "email": "rosan@deos.com"
        }
    ],
    "additionalPhones": [
        {
            "phone": "+18832327657",
            "phoneLabel": "Mobile"
        }
    ],
    "dndSettings": {
        "call": {
            "status": "active",
            "message": "Do not call"
        },
        "email": {
            "status": "inactive"
        }
    }
}

response = await client.contacts.update_contact('<CONTACTID>', body=body)
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
    'firstName' => 'rosan',
    'lastName' => 'Deo',
    'name' => 'rosan Deo',
    'email' => 'rosan@deos.com',
    'phone' => '+1 888-888-8888',
    'address1' => '3535 1st St N',
    'city' => 'Dolomite',
    'state' => 'AL',
    'postalCode' => '35061',
    'website' => 'https://www.tesla.com',
    'timezone' => 'America/Chihuahua',
    'dnd' => true,
    'inboundDndSettings' => [
        'all' => [
            'status' => 'active',
            'message' => 'Do not contact me'
        ]
    ],
    'tags' => [
        'nisi sint commodo amet',
        'consequat'
    ],
    'customFields' => [
        [
            'id' => '6dvNaf7VhkQ9snc5vnjJ',
            'key' => 'my_custom_field',
            'fieldValue' => 'My Text'
        ]
    ],
    'source' => 'public api',
    'dateOfBirth' => '1990-09-25',
    'country' => 'US',
    'assignedTo' => 'y0BeYjuRIlDwsDcOHOJo',
    'additionalEmails' => [
        [
            'email' => 'rosan@deos.com'
        ]
    ],
    'additionalPhones' => [
        [
            'phone' => '+18832327657',
            'phoneLabel' => 'Mobile'
        ]
    ],
    'dndSettings' => [
        'call' => [
            'status' => 'active',
            'message' => 'Do not call'
        ],
        'email' => [
            'status' => 'inactive'
        ]
    ]
];

$response = $ghl->contacts->updateContact('<CONTACTID>', $body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X PUT 'https://services.leadconnectorhq.com/contacts/<contactId>' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
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
      "firstName": "rosan",
      "lastName": "Deo",
      "name": "rosan Deo",
      "email": "rosan@deos.com",
      "phone": "+1 888-888-8888",
      "address1": "3535 1st St N",
      "city": "Dolomite",
      "state": "AL",
      "postalCode": "35061",
      "website": "https://www.tesla.com",
      "timezone": "America/Chihuahua",
      "dnd": true,
      "inboundDndSettings": {
        "all": {
          "status": "active",
          "message": "Do not contact me"
        }
      },
      "tags": [
        "nisi sint commodo amet",
        "consequat"
      ],
      "customFields": [
        {
          "id": "6dvNaf7VhkQ9snc5vnjJ",
          "key": "my_custom_field",
          "fieldValue": "My Text"
        }
      ],
      "source": "public api",
      "dateOfBirth": "1990-09-25",
      "country": "US",
      "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
      "additionalEmails": [
        {
          "email": "rosan@deos.com"
        }
      ],
      "additionalPhones": [
        {
          "phone": "+18832327657",
          "phoneLabel": "Mobile"
        }
      ],
      "dndSettings": {
        "call": {
          "status": "active",
          "message": "Do not call"
        },
        "email": {
          "status": "inactive"
        }
      }
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/contacts/<contactId>', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/contacts/{contactId}"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

payload = {
    "firstName": "rosan",
    "lastName": "Deo",
    "name": "rosan Deo",
    "email": "rosan@deos.com",
    "phone": "+1 888-888-8888",
    "address1": "3535 1st St N",
    "city": "Dolomite",
    "state": "AL",
    "postalCode": "35061",
    "website": "https://www.tesla.com",
    "timezone": "America/Chihuahua",
    "dnd": true,
    "inboundDndSettings": {
        "all": {
            "status": "active",
            "message": "Do not contact me"
        }
    },
    "tags": [
        "nisi sint commodo amet",
        "consequat"
    ],
    "customFields": [
        {
            "id": "6dvNaf7VhkQ9snc5vnjJ",
            "key": "my_custom_field",
            "fieldValue": "My Text"
        }
    ],
    "source": "public api",
    "dateOfBirth": "1990-09-25",
    "country": "US",
    "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
    "additionalEmails": [
        {
            "email": "rosan@deos.com"
        }
    ],
    "additionalPhones": [
        {
            "phone": "+18832327657",
            "phoneLabel": "Mobile"
        }
    ],
    "dndSettings": {
        "call": {
            "status": "active",
            "message": "Do not call"
        },
        "email": {
            "status": "inactive"
        }
    }
}

response = requests.put(url, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/contacts/<contactId>',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'PUT',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .put("https://services.leadconnectorhq.com/contacts/<contactId>")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .header("Content-Type", "application/json")
  .body("{\"firstName\":\"rosan\",\"lastName\":\"Deo\",\"name\":\"rosan Deo\",\"email\":\"rosan@deos.com\",\"phone\":\"+1 888-888-8888\",\"address1\":\"3535 1st St N\",\"city\":\"Dolomite\",\"state\":\"AL\",\"postalCode\":\"35061\",\"website\":\"https://www.tesla.com\",\"timezone\":\"America/Chihuahua\",\"dnd\":true,\"inboundDndSettings\":{\"all\":{\"status\":\"active\",\"message\":\"Do not contact me\"}},\"tags\":[\"nisi sint commodo amet\",\"consequat\"],\"customFields\":[{\"id\":\"6dvNaf7VhkQ9snc5vnjJ\",\"key\":\"my_custom_field\",\"fieldValue\":\"My Text\"}],\"source\":\"public api\",\"dateOfBirth\":\"1990-09-25\",\"country\":\"US\",\"assignedTo\":\"y0BeYjuRIlDwsDcOHOJo\",\"additionalEmails\":[{\"email\":\"rosan@deos.com\"}],\"additionalPhones\":[{\"phone\":\"+18832327657\",\"phoneLabel\":\"Mobile\"}],\"dndSettings\":{\"call\":{\"status\":\"active\",\"message\":\"Do not call\"},\"email\":{\"status\":\"inactive\"}}}")
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
  url := "https://services.leadconnectorhq.com/contacts/<contactId>"
  payload := strings.NewReader(`{
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
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

url = URI("https://services.leadconnectorhq.com/contacts/<contactId>")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Put.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"
request["Content-Type"] = "application/json"
request.body = '{
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
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
  "firstName": "rosan",
  "lastName": "Deo",
  "name": "rosan Deo",
  "email": "rosan@deos.com",
  "phone": "+1 888-888-8888",
  "address1": "3535 1st St N",
  "city": "Dolomite",
  "state": "AL",
  "postalCode": "35061",
  "website": "https://www.tesla.com",
  "timezone": "America/Chihuahua",
  "dnd": true,
  "inboundDndSettings": {
    "all": {
      "status": "active",
      "message": "Do not contact me"
    }
  },
  "tags": [
    "nisi sint commodo amet",
    "consequat"
  ],
  "customFields": [
    {
      "id": "6dvNaf7VhkQ9snc5vnjJ",
      "key": "my_custom_field",
      "fieldValue": "My Text"
    }
  ],
  "source": "public api",
  "dateOfBirth": "1990-09-25",
  "country": "US",
  "assignedTo": "y0BeYjuRIlDwsDcOHOJo",
  "additionalEmails": [
    {
      "email": "rosan@deos.com"
    }
  ],
  "additionalPhones": [
    {
      "phone": "+18832327657",
      "phoneLabel": "Mobile"
    }
  ],
  "dndSettings": {
    "call": {
      "status": "active",
      "message": "Do not call"
    },
    "email": {
      "status": "inactive"
    }
  }
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/contacts/<contactId>' -Method 'PUT' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```
