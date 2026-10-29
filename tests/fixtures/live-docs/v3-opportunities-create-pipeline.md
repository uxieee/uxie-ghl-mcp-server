# Create Pipeline

POST https://services.leadconnectorhq.com/opportunities/pipelines

Creates a new pipeline with at least one stage for a given location. Pipeline names must be unique per location (case-insensitive), and stage names must be unique within the pipeline. To enable manual win probability, set `useOpportunityProbability` to `true` and provide a `stageWinProbability` (0–100) on every stage — if any stage is missing a value, the system falls back to auto-computed probabilities based on stage position.

## Authentication

Send `Authorization: Bearer <token>` using:

- **Sub-Account token: OAuth access token or Private Integration Token.** Scopes: `pipelines.create`

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version |

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
    "/opportunities/pipelines": {
      "post": {
        "summary": "Create Pipeline",
        "operationId": "createPipeline",
        "description": "Creates a new pipeline with at least one stage for a given location. Pipeline names must be unique per location (case-insensitive), and stage names must be unique within the pipeline. To enable manual win probability, set `useOpportunityProbability` to `true` and provide a `stageWinProbability` (0–100) on every stage — if any stage is missing a value, the system falls back to auto-computed probabilities based on stage position.",
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
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreatePipelineDto"
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
                  "$ref": "#/components/schemas/PipelinesResponseSchema"
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
          }
        },
        "security": [
          {
            "bearer": [
              "pipelines.create"
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
      "CreatePipelineDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Name of the pipeline",
            "example": "pipeline"
          },
          "stages": {
            "description": "List of stages belonging to this pipeline",
            "example": [
              {
                "name": "stage 1",
                "position": 1,
                "showInFunnel": true
              }
            ],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "showInFunnel": {
            "type": "boolean",
            "description": "Whether the pipeline is shown in the funnel view",
            "example": false
          },
          "showInPieChart": {
            "type": "boolean",
            "description": "Whether the pipeline is shown in the pie chart view",
            "example": true
          },
          "useOpportunityProbability": {
            "type": "boolean",
            "description": "Whether stage-level win probability is enabled for this pipeline",
            "example": true
          },
          "locationId": {
            "type": "string",
            "description": "Identifier of the location (sub-account) this pipeline belongs to",
            "example": "ve9EPM428h8vShlRW1KT"
          },
          "colorRenderMode": {
            "type": "string",
            "enum": [
              "dot",
              "bg-tint",
              "none"
            ],
            "description": "How pipeline/stage colors are rendered",
            "example": "dot"
          }
        },
        "required": [
          "name",
          "stages",
          "locationId"
        ],
        "title": "CreatePipelineDto"
      },
      "PipelinesResponseSchema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier of the pipeline",
            "example": "aWdODOBVOlH1RUFKWQke"
          },
          "name": {
            "type": "string",
            "description": "Name of the pipeline",
            "example": "new pipeline"
          },
          "stages": {
            "description": "Stages belonging to this pipeline",
            "example": [],
            "type": "array",
            "items": {
              "type": "array"
            }
          },
          "showInFunnel": {
            "type": "boolean",
            "description": "Whether the pipeline is shown in the funnel view",
            "example": false
          },
          "showInPieChart": {
            "type": "boolean",
            "description": "Whether the pipeline is shown in the pie chart view",
            "example": true
          },
          "locationId": {
            "type": "string",
            "description": "Identifier of the location (sub-account) this pipeline belongs to",
            "example": "VeMHYX28Satp2p7XVKbb"
          },
          "useOpportunityProbability": {
            "type": "boolean",
            "description": "Whether stage-level win probability is enabled for this pipeline",
            "example": true
          },
          "colorRenderMode": {
            "type": "string",
            "enum": [
              "dot",
              "bg-tint",
              "none"
            ],
            "description": "How pipeline/stage colors are rendered",
            "example": "dot"
          },
          "position": {
            "type": "string",
            "example": "a0V",
            "description": "Fractional-index key used to sort pipelines. Updated when the user reorders pipelines (via drag-and-drop or the reorder modal)."
          }
        },
        "title": "PipelinesResponseSchema"
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
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
};

const response = await ghl.opportunities.createPipeline(body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "name": "pipeline",
    "stages": [
        {
            "name": "stage 1",
            "position": 1,
            "showInFunnel": true
        }
    ],
    "showInFunnel": false,
    "showInPieChart": true,
    "useOpportunityProbability": true,
    "locationId": "ve9EPM428h8vShlRW1KT",
    "colorRenderMode": "dot"
}

response = await client.opportunities.create_pipeline(body=body)
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
    'name' => 'pipeline',
    'stages' => [
        [
            'name' => 'stage 1',
            'position' => 1,
            'showInFunnel' => true
        ]
    ],
    'showInFunnel' => false,
    'showInPieChart' => true,
    'useOpportunityProbability' => true,
    'locationId' => 've9EPM428h8vShlRW1KT',
    'colorRenderMode' => 'dot'
];

$response = $ghl->opportunities->createPipeline($body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X POST 'https://services.leadconnectorhq.com/opportunities/pipelines' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
}'
```

**Node.js**

```javascript
const options = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: 'v3',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "name": "pipeline",
      "stages": [
        {
          "name": "stage 1",
          "position": 1,
          "showInFunnel": true
        }
      ],
      "showInFunnel": false,
      "showInPieChart": true,
      "useOpportunityProbability": true,
      "locationId": "ve9EPM428h8vShlRW1KT",
      "colorRenderMode": "dot"
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/opportunities/pipelines', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/opportunities/pipelines"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

payload = {
    "name": "pipeline",
    "stages": [
        {
            "name": "stage 1",
            "position": 1,
            "showInFunnel": true
        }
    ],
    "showInFunnel": false,
    "showInPieChart": true,
    "useOpportunityProbability": true,
    "locationId": "ve9EPM428h8vShlRW1KT",
    "colorRenderMode": "dot"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/opportunities/pipelines',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .post("https://services.leadconnectorhq.com/opportunities/pipelines")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .header("Content-Type", "application/json")
  .body("{\"name\":\"pipeline\",\"stages\":[{\"name\":\"stage 1\",\"position\":1,\"showInFunnel\":true}],\"showInFunnel\":false,\"showInPieChart\":true,\"useOpportunityProbability\":true,\"locationId\":\"ve9EPM428h8vShlRW1KT\",\"colorRenderMode\":\"dot\"}")
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
  url := "https://services.leadconnectorhq.com/opportunities/pipelines"
  payload := strings.NewReader(`{
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
}`)
  req, _ := http.NewRequest("POST", url, payload)
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

url = URI("https://services.leadconnectorhq.com/opportunities/pipelines")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"
request["Content-Type"] = "application/json"
request.body = '{
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
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
  "name": "pipeline",
  "stages": [
    {
      "name": "stage 1",
      "position": 1,
      "showInFunnel": true
    }
  ],
  "showInFunnel": false,
  "showInPieChart": true,
  "useOpportunityProbability": true,
  "locationId": "ve9EPM428h8vShlRW1KT",
  "colorRenderMode": "dot"
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/opportunities/pipelines' -Method 'POST' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```
