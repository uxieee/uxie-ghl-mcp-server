# Get reporting list

GET https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list

Retrieve campaigns, ad sets, or ads with their reporting metrics. `listType` selects the entity and changes the item shape; `adsets` and `ads` additionally require `campaignId`. Entities Meta has no insights for are still returned, padded with a fixed zero row that carries fewer fields than a real one. Note `none` is accepted by validation but has no handler and fails with a 409. Deprecated: use GET /ad-publishing/facebook/reporting/rows with header version: v4.

## Authentication

Send `Authorization: Bearer <token>` using:

- **Sub-Account token: OAuth access token or Private Integration Token.** Scopes: `adPublishing.readonly`

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version |

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locationId` | string | Yes | Location identifier |
| `listType` | string | Yes | Reporting list type |
| `startDate` | string | Yes | Report start date (YYYY-MM-DD) |
| `endDate` | string | Yes | Report end date (YYYY-MM-DD) |
| `campaignId` | string | No | Campaign identifier (required when listType is adsets or ads) |
| `type` | string | Yes | Integration source type |

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
    "/ad-publishing/facebook/reporting/list": {
      "get": {
        "summary": "Get reporting list",
        "operationId": "getReportingList",
        "description": "Retrieve campaigns, ad sets, or ads with their reporting metrics. `listType` selects the entity and changes the item shape; `adsets` and `ads` additionally require `campaignId`. Entities Meta has no insights for are still returned, padded with a fixed zero row that carries fewer fields than a real one. Note `none` is accepted by validation but has no handler and fails with a 409. Deprecated: use GET /ad-publishing/facebook/reporting/rows with header version: v4.",
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
            "name": "locationId",
            "required": true,
            "in": "query",
            "description": "Location identifier",
            "schema": {
              "example": "fRMewNQIxSyZ5R4nQyit",
              "type": "string"
            }
          },
          {
            "name": "listType",
            "required": true,
            "in": "query",
            "description": "Reporting list type",
            "schema": {
              "example": "campaigns",
              "enum": [
                "ads",
                "adsets",
                "campaigns",
                "none"
              ],
              "type": "string"
            }
          },
          {
            "name": "startDate",
            "required": true,
            "in": "query",
            "description": "Report start date (YYYY-MM-DD)",
            "schema": {
              "example": "2022-01-11",
              "type": "string"
            }
          },
          {
            "name": "endDate",
            "required": true,
            "in": "query",
            "description": "Report end date (YYYY-MM-DD)",
            "schema": {
              "example": "2022-01-31",
              "type": "string"
            }
          },
          {
            "name": "campaignId",
            "required": false,
            "in": "query",
            "description": "Campaign identifier (required when listType is adsets or ads)",
            "schema": {
              "example": "196684453527082",
              "type": "string"
            }
          },
          {
            "name": "type",
            "required": true,
            "in": "query",
            "description": "Integration source type",
            "schema": {
              "example": "INTEGRATION",
              "enum": [
                "AD_MANAGER",
                "INTEGRATION"
              ],
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "The entities and their metrics. The item shape follows `listType`: campaigns are keyed by `_id` and carry `publishingStatus`, ad sets by `adSetId` with a nested `campaign`, and ads by `adId` with `adsetId` and `adsetName`. Only the campaigns branch includes locally stored fields; all three append CDP revenue and contact figures.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/GetReportingListResponse"
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
          },
          "500": {
            "description": "Internal Server Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InternalServerErrorDTO"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearer": [
              "adPublishing.readonly"
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
      "GetReportingListResponse": {
        "type": "array",
        "items": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "_id": {
                  "type": "string",
                  "description": "Campaign id in this service. Note `_id`, not `id`.",
                  "example": "6888ebcd08b53700119d3c18"
                },
                "name": {
                  "type": "string",
                  "description": "Campaign name",
                  "example": "Spring Promo"
                },
                "objective": {
                  "type": "string",
                  "description": "Campaign objective",
                  "example": "OUTCOME_LEADS"
                },
                "publishingStatus": {
                  "type": "string",
                  "description": "Publishing status. Archived campaigns are excluded from this list.",
                  "example": "PAUSED"
                },
                "fbCampaignId": {
                  "type": "string",
                  "description": "Meta campaign id. Campaigns without one are excluded.",
                  "example": "120209705920280122"
                },
                "clicks": {
                  "type": "string",
                  "description": "Clicks",
                  "example": "16"
                },
                "cpc": {
                  "type": "string",
                  "description": "Cost per click",
                  "example": "0.03125"
                },
                "ctr": {
                  "type": "string",
                  "description": "Click-through rate as a percentage",
                  "example": "2.413273"
                },
                "impressions": {
                  "type": "string",
                  "description": "Impressions",
                  "example": "663"
                },
                "spend": {
                  "type": "string",
                  "description": "Spend",
                  "example": "0.5"
                },
                "results": {
                  "type": "object",
                  "description": "Counts per action type as strings. Padded rows carry only `{ lead: \"0\", linkClick: \"0\" }` regardless of which actions the campaign could produce.",
                  "additionalProperties": {
                    "type": "string"
                  },
                  "example": {
                    "linkClick": "10",
                    "postEngagement": "12"
                  }
                },
                "revenue": {
                  "type": "string",
                  "description": "Attributed revenue from the CDP service. `\"0\"` on padded rows, `\"0.00\"` when genuinely zero.",
                  "example": "0.00"
                },
                "sales": {
                  "type": "string",
                  "description": "Attributed opportunities",
                  "example": "0"
                },
                "leads": {
                  "type": "string",
                  "description": "Attributed contacts",
                  "example": "0"
                },
                "averageRevenue": {
                  "type": "string",
                  "description": "Revenue per opportunity, or `\"0.00\"` when there are none",
                  "example": "0.00"
                },
                "campaignId": {
                  "type": "string",
                  "description": "Meta campaign id, repeated. Present only when Meta returned insights.",
                  "example": "120216900088000122"
                },
                "campaignName": {
                  "type": "string",
                  "description": "Campaign name as Meta holds it, which can differ from `name`. Insight rows only.",
                  "example": "sales-messaging"
                },
                "reach": {
                  "type": "string",
                  "description": "Unique people reached. Insight rows only.",
                  "example": "650"
                },
                "frequency": {
                  "type": "string",
                  "description": "Average impressions per person. Insight rows only.",
                  "example": "1.02"
                },
                "dateStart": {
                  "type": "string",
                  "description": "Start of the reported window. Insight rows only.",
                  "example": "2025-09-01"
                },
                "dateStop": {
                  "type": "string",
                  "description": "End of the reported window. Insight rows only.",
                  "example": "2026-08-19"
                }
              },
              "required": [
                "_id",
                "name",
                "objective",
                "publishingStatus",
                "fbCampaignId",
                "clicks",
                "cpc",
                "ctr",
                "impressions",
                "spend",
                "results",
                "revenue",
                "sales",
                "leads",
                "averageRevenue"
              ],
              "title": "FacebookReportingListCampaignDTO"
            },
            {
              "type": "object",
              "properties": {
                "adSetId": {
                  "type": "string",
                  "description": "Meta ad set id",
                  "example": "120229485770350122"
                },
                "name": {
                  "type": "string",
                  "description": "Ad set name",
                  "example": "Do not touch - Lead form Adset"
                },
                "campaign": {
                  "type": "object",
                  "description": "Parent campaign, as a nested object. Its `objective` is copied to the top-level `objective`.",
                  "additionalProperties": true,
                  "example": {
                    "id": "120229485769880122",
                    "objective": "OUTCOME_LEADS"
                  }
                },
                "campaignId": {
                  "type": "string",
                  "description": "Parent campaign id, repeated flat",
                  "example": "120229485769880122"
                },
                "objective": {
                  "type": "string",
                  "description": "Objective copied from the parent campaign",
                  "example": "OUTCOME_LEADS"
                },
                "adAccountId": {
                  "type": "string",
                  "description": "Ad account",
                  "example": "act_357046700569338"
                },
                "locationId": {
                  "type": "string",
                  "description": "Owning location",
                  "example": "fRMewNQIxSyZ5R4nQyit"
                },
                "promotedObject": {
                  "type": "object",
                  "description": "What the ad set promotes. Presence of `pixelId` is what the service uses to infer a website conversion location.",
                  "additionalProperties": true,
                  "example": {
                    "pageId": "196684453527082",
                    "smartPseEnabled": false
                  }
                },
                "clicks": {
                  "type": "string",
                  "description": "Clicks",
                  "example": "32"
                },
                "cpc": {
                  "type": "string",
                  "description": "Cost per click",
                  "example": "0.03625"
                },
                "ctr": {
                  "type": "string",
                  "description": "Click-through rate as a percentage",
                  "example": "1.440792"
                },
                "impressions": {
                  "type": "string",
                  "description": "Impressions",
                  "example": "2221"
                },
                "spend": {
                  "type": "string",
                  "description": "Spend",
                  "example": "1.16"
                },
                "reach": {
                  "type": "string",
                  "description": "Unique people reached",
                  "example": "2214"
                },
                "frequency": {
                  "type": "string",
                  "description": "Average impressions per person reached",
                  "example": "1.003162"
                },
                "dateStart": {
                  "type": "string",
                  "description": "First day of the reported window",
                  "example": "2025-08-01"
                },
                "dateStop": {
                  "type": "string",
                  "description": "Last day of the reported window",
                  "example": "2026-08-19"
                },
                "results": {
                  "type": "object",
                  "description": "Counts per Meta action type, as strings",
                  "additionalProperties": {
                    "type": "string"
                  },
                  "example": {
                    "lead": "5",
                    "linkClick": "22"
                  }
                },
                "revenue": {
                  "type": "string",
                  "description": "Attributed revenue from the CDP, matched to this ad set by NAME rather than id. An ad set renamed since the activity occurred will not match and falls back to zeros.",
                  "example": "0.00"
                },
                "sales": {
                  "type": "string",
                  "description": "Attributed opportunities",
                  "example": "0"
                },
                "leads": {
                  "type": "string",
                  "description": "Attributed contacts. Because attribution is resolved separately per level, this does not necessarily agree with the same figure on the parent campaign or child ads.",
                  "example": "0"
                },
                "averageRevenue": {
                  "type": "string",
                  "description": "Revenue per opportunity, or `\"0.00\"` when there are none",
                  "example": "0.00"
                }
              },
              "required": [
                "adSetId",
                "name",
                "adAccountId",
                "locationId",
                "revenue",
                "sales",
                "leads",
                "averageRevenue"
              ],
              "title": "FacebookReportingListAdsetDTO"
            },
            {
              "type": "object",
              "properties": {
                "adId": {
                  "type": "string",
                  "description": "Meta ad id",
                  "example": "120229486180110122"
                },
                "name": {
                  "type": "string",
                  "description": "Ad name. Also the key used to match CDP attribution.",
                  "example": "Do not touch - Lead form Ad"
                },
                "adsetId": {
                  "type": "string",
                  "description": "Parent ad set id",
                  "example": "120229485770350122"
                },
                "adsetName": {
                  "type": "string",
                  "description": "Parent ad set name",
                  "example": "Do not touch - Lead form Adset"
                },
                "campaignId": {
                  "type": "string",
                  "description": "Parent campaign id",
                  "example": "120229485769880122"
                },
                "objective": {
                  "type": "string",
                  "description": "Objective copied from the parent campaign",
                  "example": "OUTCOME_LEADS"
                },
                "adAccountId": {
                  "type": "string",
                  "description": "Ad account",
                  "example": "act_357046700569338"
                },
                "locationId": {
                  "type": "string",
                  "description": "Owning location",
                  "example": "fRMewNQIxSyZ5R4nQyit"
                },
                "promotedObject": {
                  "type": "object",
                  "description": "What the parent ad set promotes, carried down onto the ad row",
                  "additionalProperties": true,
                  "example": {
                    "pageId": "196684453527082",
                    "smartPseEnabled": false
                  }
                },
                "clicks": {
                  "type": "string",
                  "description": "Clicks",
                  "example": "32"
                },
                "cpc": {
                  "type": "string",
                  "description": "Cost per click",
                  "example": "0.03625"
                },
                "ctr": {
                  "type": "string",
                  "description": "Click-through rate as a percentage",
                  "example": "1.440792"
                },
                "impressions": {
                  "type": "string",
                  "description": "Impressions",
                  "example": "2221"
                },
                "spend": {
                  "type": "string",
                  "description": "Spend",
                  "example": "1.16"
                },
                "reach": {
                  "type": "string",
                  "description": "Unique people reached",
                  "example": "2214"
                },
                "frequency": {
                  "type": "string",
                  "description": "Average impressions per person reached",
                  "example": "1.003162"
                },
                "dateStart": {
                  "type": "string",
                  "description": "First day of the reported window",
                  "example": "2025-08-01"
                },
                "dateStop": {
                  "type": "string",
                  "description": "Last day of the reported window",
                  "example": "2026-08-19"
                },
                "results": {
                  "type": "object",
                  "description": "Counts per Meta action type, as strings",
                  "additionalProperties": {
                    "type": "string"
                  },
                  "example": {
                    "lead": "5",
                    "linkClick": "22"
                  }
                },
                "revenue": {
                  "type": "string",
                  "description": "Attributed revenue from the CDP, matched to this ad by NAME rather than id. Two ads sharing a name within a campaign cannot be told apart.",
                  "example": "0.00"
                },
                "sales": {
                  "type": "string",
                  "description": "Attributed opportunities",
                  "example": "0"
                },
                "leads": {
                  "type": "string",
                  "description": "Attributed contacts",
                  "example": "4"
                },
                "averageRevenue": {
                  "type": "string",
                  "description": "Revenue per opportunity, or `\"0.00\"` when there are none",
                  "example": "0.00"
                }
              },
              "required": [
                "adId",
                "name",
                "adAccountId",
                "locationId",
                "revenue",
                "sales",
                "leads",
                "averageRevenue"
              ],
              "title": "FacebookReportingListAdDTO"
            }
          ]
        }
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
      },
      "InternalServerErrorDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "description": "HTTP status code for an unexpected server error",
            "example": 500
          },
          "message": {
            "type": "string",
            "description": "Error message describing the server failure",
            "example": "Internal Server Error"
          }
        },
        "title": "InternalServerErrorDTO"
      }
    }
  }
}
```

## Code Examples

**cURL**

```bash
curl -L -X GET 'https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3'
```

**Node.js**

```javascript
const options = {
  method: 'GET',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: 'v3'
  }
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

params = {
    "locationId": "<LOCATIONID>",
    "listType": "<LISTTYPE>",
    "startDate": "<STARTDATE>",
    "endDate": "<ENDDATE>",
    "type": "<TYPE>"
}

response = requests.get(url, params=params, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'GET',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
  ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .get("https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .asString();
```

**Go**

```go
package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  url := "https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>"
  req, _ := http.NewRequest("GET", url, nil)
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

url = URI("https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Get.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"

response = http.request(request)
puts response.read_body
```

**PowerShell**

```powershell
$headers = @{
  "Authorization" = "Bearer <TOKEN>"
  "Version" = "v3"
}

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/ad-publishing/facebook/reporting/list?locationId=<LOCATIONID>&listType=<LISTTYPE>&startDate=<STARTDATE>&endDate=<ENDDATE>&type=<TYPE>' -Method 'GET' -Headers $headers
$response | ConvertTo-Json
```
