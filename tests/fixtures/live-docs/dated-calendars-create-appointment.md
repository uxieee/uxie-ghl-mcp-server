# Create appointment

POST https://services.leadconnectorhq.com/calendars/events/appointments

Create appointment

## Authentication

Send `Authorization: Bearer <token>` using:

- **Sub-Account token: OAuth access token or Private Integration Token.** Scopes: `calendars/events.write`

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
    "version": "2021-07-28"
  },
  "servers": [
    {
      "url": "https://services.leadconnectorhq.com"
    }
  ],
  "paths": {
    "/calendars/events/appointments": {
      "post": {
        "summary": "Create appointment",
        "operationId": "createAppointment",
        "description": "Create appointment",
        "parameters": [
          {
            "name": "Version",
            "in": "header",
            "description": "API Version",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "2021-07-28"
              ]
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AppointmentCreateSchema"
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
                  "$ref": "#/components/schemas/AppointmentSchemaResponse"
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
              "calendars/events.write"
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
      "AppointmentCreateSchema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "Title",
            "example": "Test Event"
          },
          "meetingLocationType": {
            "type": "string",
            "description": "Meeting location type. \n- If `address` is provided in the request body, the `meetingLocationType` defaults to **custom**.",
            "example": "custom",
            "enum": [
              "custom",
              "zoom",
              "gmeet",
              "phone",
              "address",
              "ms_teams",
              "google"
            ]
          },
          "meetingLocationId": {
            "type": "string",
            "description": "The unique identifier for the meeting location.\n- This value can be found in `calendar.locationConfigurations`or `calendar.teamMembers[].locationConfigurations`",
            "example": "custom_0",
            "default": "default"
          },
          "overrideLocationConfig": {
            "type": "boolean",
            "description": "Flag to override location config\n- **false** - If only `meetingLocationId` is provided\n- **true** - If only `meetingLocationType` is provided\n",
            "example": true
          },
          "appointmentStatus": {
            "type": "string",
            "example": "confirmed",
            "enum": [
              "new",
              "confirmed",
              "cancelled",
              "showed",
              "noshow",
              "invalid",
              "completed",
              "active"
            ],
            "description": "Appointment status"
          },
          "assignedUserId": {
            "type": "string",
            "description": "Assigned User Id",
            "example": "0007BWpSzSwfiuSl0tR2"
          },
          "description": {
            "type": "string",
            "description": "Appointment Description",
            "example": "Booking a call to discuss the project"
          },
          "address": {
            "type": "string",
            "description": "Appointment Address",
            "example": "Zoom"
          },
          "ignoreDateRange": {
            "type": "boolean",
            "description": "If set to true, the minimum scheduling notice and date range would be ignored",
            "example": false
          },
          "toNotify": {
            "type": "boolean",
            "description": "If set to false, the automations will not run. Defaults to true",
            "example": false,
            "default": true
          },
          "ignoreFreeSlotValidation": {
            "type": "boolean",
            "description": "If true the time slot validation would be avoided for any appointment creation (even the ignoreDateRange)",
            "example": true
          },
          "rrule": {
            "type": "string",
            "description": "RRULE as per the iCalendar (RFC 5545) specification for recurring events. DTSTART is not required, instance ids are calculated on the basis of startTime of the event. The rrule only be applied if ignoreFreeSlotValidation is true.",
            "examples": [
              "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
              "RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20210623T043000Z\nEXDATE:20211105T040000Z,20211105T040000Z"
            ],
            "example": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5"
          },
          "calendarId": {
            "type": "string",
            "description": "Calendar Id",
            "example": "CVokAlI8fgw4WYWoCtQz"
          },
          "locationId": {
            "type": "string",
            "description": "Location Id",
            "example": "C2QujeCh8ZnC7al2InWR"
          },
          "contactId": {
            "type": "string",
            "description": "Contact Id",
            "example": "0007BWpSzSwfiuSl0tR2"
          },
          "startTime": {
            "type": "string",
            "description": "Start Time",
            "example": "2021-06-23T03:30:00+05:30"
          },
          "endTime": {
            "type": "string",
            "description": "End Time",
            "example": "2021-06-23T04:30:00+05:30"
          }
        },
        "required": [
          "calendarId",
          "locationId",
          "contactId",
          "startTime"
        ],
        "title": "AppointmentCreateSchema"
      },
      "AppointmentSchemaResponse": {
        "type": "object",
        "properties": {
          "calendarId": {
            "type": "string",
            "description": "Calendar Id",
            "example": "CVokAlI8fgw4WYWoCtQz"
          },
          "locationId": {
            "type": "string",
            "description": "Location Id",
            "example": "C2QujeCh8ZnC7al2InWR"
          },
          "contactId": {
            "type": "string",
            "description": "Contact Id",
            "example": "0007BWpSzSwfiuSl0tR2"
          },
          "startTime": {
            "type": "string",
            "description": "Start Time",
            "example": "2021-06-23T03:30:00+05:30"
          },
          "endTime": {
            "type": "string",
            "description": "End Time",
            "example": "2021-06-23T04:30:00+05:30"
          },
          "title": {
            "type": "string",
            "description": "Title",
            "example": "Test Event"
          },
          "meetingLocationType": {
            "type": "string",
            "description": "Meeting Location Type",
            "example": "custom",
            "default": "default"
          },
          "appointmentStatus": {
            "type": "string",
            "example": "confirmed",
            "enum": [
              "new",
              "confirmed",
              "cancelled",
              "showed",
              "noshow",
              "invalid",
              "active",
              "completed"
            ],
            "description": "Appointment status"
          },
          "assignedUserId": {
            "type": "string",
            "description": "Assigned User Id",
            "example": "0007BWpSzSwfiuSl0tR2"
          },
          "address": {
            "type": "string",
            "description": "Appointment Address",
            "example": "Zoom"
          },
          "isRecurring": {
            "type": "boolean",
            "description": "true if the event is recurring otherwise false",
            "example": "true"
          },
          "rrule": {
            "type": "string",
            "description": "RRULE as per the iCalendar (RFC 5545) specification for recurring events",
            "examples": [
              "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
              "RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20210623T043000Z\nEXDATE:20211105T040000Z,20211105T040000Z"
            ],
            "example": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5"
          },
          "dateAdded": {
            "type": "string",
            "description": "Date Added",
            "example": "2021-06-23T03:30:00+05:30"
          },
          "dateUpdated": {
            "type": "string",
            "description": "Date Updated",
            "example": "2021-06-23T04:30:00+05:30"
          },
          "id": {
            "type": "string",
            "description": "Id",
            "example": "0TkCdp9PfvLeWKYRRvIz"
          }
        },
        "required": [
          "calendarId",
          "locationId",
          "contactId",
          "id",
          "dateAdded",
          "dateUpdated"
        ],
        "title": "AppointmentSchemaResponse"
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
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
};

const response = await ghl.calendars.createAppointment(body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "title": "Test Event",
    "meetingLocationType": "custom",
    "meetingLocationId": "custom_0",
    "overrideLocationConfig": true,
    "appointmentStatus": "confirmed",
    "assignedUserId": "0007BWpSzSwfiuSl0tR2",
    "description": "Booking a call to discuss the project",
    "address": "Zoom",
    "ignoreDateRange": false,
    "toNotify": false,
    "ignoreFreeSlotValidation": true,
    "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
    "calendarId": "CVokAlI8fgw4WYWoCtQz",
    "locationId": "C2QujeCh8ZnC7al2InWR",
    "contactId": "0007BWpSzSwfiuSl0tR2",
    "startTime": "2021-06-23T03:30:00+05:30",
    "endTime": "2021-06-23T04:30:00+05:30"
}

response = await client.calendars.create_appointment(body=body)
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
    'title' => 'Test Event',
    'meetingLocationType' => 'custom',
    'meetingLocationId' => 'custom_0',
    'overrideLocationConfig' => true,
    'appointmentStatus' => 'confirmed',
    'assignedUserId' => '0007BWpSzSwfiuSl0tR2',
    'description' => 'Booking a call to discuss the project',
    'address' => 'Zoom',
    'ignoreDateRange' => false,
    'toNotify' => false,
    'ignoreFreeSlotValidation' => true,
    'rrule' => 'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5',
    'calendarId' => 'CVokAlI8fgw4WYWoCtQz',
    'locationId' => 'C2QujeCh8ZnC7al2InWR',
    'contactId' => '0007BWpSzSwfiuSl0tR2',
    'startTime' => '2021-06-23T03:30:00+05:30',
    'endTime' => '2021-06-23T04:30:00+05:30'
];

$response = $ghl->calendars->createAppointment($body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X POST 'https://services.leadconnectorhq.com/calendars/events/appointments' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
}'
```

**Node.js**

```javascript
const options = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: '2021-07-28',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "title": "Test Event",
      "meetingLocationType": "custom",
      "meetingLocationId": "custom_0",
      "overrideLocationConfig": true,
      "appointmentStatus": "confirmed",
      "assignedUserId": "0007BWpSzSwfiuSl0tR2",
      "description": "Booking a call to discuss the project",
      "address": "Zoom",
      "ignoreDateRange": false,
      "toNotify": false,
      "ignoreFreeSlotValidation": true,
      "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
      "calendarId": "CVokAlI8fgw4WYWoCtQz",
      "locationId": "C2QujeCh8ZnC7al2InWR",
      "contactId": "0007BWpSzSwfiuSl0tR2",
      "startTime": "2021-06-23T03:30:00+05:30",
      "endTime": "2021-06-23T04:30:00+05:30"
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/calendars/events/appointments', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/calendars/events/appointments"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "2021-07-28"
}

payload = {
    "title": "Test Event",
    "meetingLocationType": "custom",
    "meetingLocationId": "custom_0",
    "overrideLocationConfig": true,
    "appointmentStatus": "confirmed",
    "assignedUserId": "0007BWpSzSwfiuSl0tR2",
    "description": "Booking a call to discuss the project",
    "address": "Zoom",
    "ignoreDateRange": false,
    "toNotify": false,
    "ignoreFreeSlotValidation": true,
    "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
    "calendarId": "CVokAlI8fgw4WYWoCtQz",
    "locationId": "C2QujeCh8ZnC7al2InWR",
    "contactId": "0007BWpSzSwfiuSl0tR2",
    "startTime": "2021-06-23T03:30:00+05:30",
    "endTime": "2021-06-23T04:30:00+05:30"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/calendars/events/appointments',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: 2021-07-28',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .post("https://services.leadconnectorhq.com/calendars/events/appointments")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "2021-07-28")
  .header("Content-Type", "application/json")
  .body("{\"title\":\"Test Event\",\"meetingLocationType\":\"custom\",\"meetingLocationId\":\"custom_0\",\"overrideLocationConfig\":true,\"appointmentStatus\":\"confirmed\",\"assignedUserId\":\"0007BWpSzSwfiuSl0tR2\",\"description\":\"Booking a call to discuss the project\",\"address\":\"Zoom\",\"ignoreDateRange\":false,\"toNotify\":false,\"ignoreFreeSlotValidation\":true,\"rrule\":\"RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5\",\"calendarId\":\"CVokAlI8fgw4WYWoCtQz\",\"locationId\":\"C2QujeCh8ZnC7al2InWR\",\"contactId\":\"0007BWpSzSwfiuSl0tR2\",\"startTime\":\"2021-06-23T03:30:00+05:30\",\"endTime\":\"2021-06-23T04:30:00+05:30\"}")
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
  url := "https://services.leadconnectorhq.com/calendars/events/appointments"
  payload := strings.NewReader(`{
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
}`)
  req, _ := http.NewRequest("POST", url, payload)
  req.Header.Add("Authorization", "Bearer <TOKEN>")
  req.Header.Add("Version", "2021-07-28")

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

url = URI("https://services.leadconnectorhq.com/calendars/events/appointments")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "2021-07-28"
request["Content-Type"] = "application/json"
request.body = '{
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
}'

response = http.request(request)
puts response.read_body
```

**PowerShell**

```powershell
$headers = @{
  "Authorization" = "Bearer <TOKEN>"
  "Version" = "2021-07-28"
}

$body = '{
  "title": "Test Event",
  "meetingLocationType": "custom",
  "meetingLocationId": "custom_0",
  "overrideLocationConfig": true,
  "appointmentStatus": "confirmed",
  "assignedUserId": "0007BWpSzSwfiuSl0tR2",
  "description": "Booking a call to discuss the project",
  "address": "Zoom",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": true,
  "rrule": "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
  "calendarId": "CVokAlI8fgw4WYWoCtQz",
  "locationId": "C2QujeCh8ZnC7al2InWR",
  "contactId": "0007BWpSzSwfiuSl0tR2",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30"
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/calendars/events/appointments' -Method 'POST' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```
