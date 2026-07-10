# Full endpoint-level diff: GHL API v3 (2026-06-19 specs) vs v2 catalog (2026-06-14)

> Generated 2026-07-11 by comparing apps/v3/*.json against the v2 catalog, per category.
> 'version: X -> v3' means the endpoint now takes the `Version: v3` header in its v3 variant.

v3 total actions: 627 across 42 categories
v2 total actions: 576 across 41 categories
v3 version headers: {"2021-07-28":94,"v3":503,"(none)":30}

## ad-publishing-v3  (v3: 95 actions | v2 "ad-manager": 94)
NEW in v3 (6):
  DELETE /ad-publishing/facebook/adsets/{adSetId}
  GET /ad-publishing/facebook/campaigns/{campaignId}/publishing-progress
  POST /ad-publishing/facebook/adsets/{adSetId}/duplicate
  POST /ad-publishing/facebook/adsets/{adSetId}/pause
  POST /ad-publishing/facebook/adsets/{adSetId}/resume
  PUT /ad-publishing/facebook/ads
v2-only / not in v3 (5):
  DELETE /ad-publishing/facebook/adsets/{adsetId}
  POST /ad-publishing/facebook/adsets/{adsetId}/duplicate
  POST /ad-publishing/facebook/adsets/{adsetId}/pause
  POST /ad-publishing/facebook/adsets/{adsetId}/resume
  PUT /ad-publishing/facebook/ads-v2
CHANGED (same method+path, 37):
  GET /ad-publishing/facebook/reporting/list
    params: [query:campaignId*,query:endDate*,query:listType*,query:locationId*,query:startDate*,query:type*] -> [query:campaignId,query:endDate*,query:listType*,query:locationId*,query:startDate*,query:type*]
  GET /ad-publishing/facebook/me
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/facebook/page/{pageId}/forms
    params: [path:pageId*,query:locationId*] -> [path:pageId*,query:isDraft,query:locationId*]
  POST /ad-publishing/facebook/page/{pageId}/forms
    body schema changed
  GET /ad-publishing/facebook/ad-accounts/{adAccountId}
    params: [path:adAccountId*,query:locationId*] -> [path:adAccountId*,query:isDraft,query:locationId*]
  GET /ad-publishing/facebook/conversation-forms
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/facebook/integration
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/facebook/targeting/search
    params: [query:query*,query:searchType,query:type*] -> [query:locationId,query:query*,query:searchType,query:type*]
  DELETE /ad-publishing/facebook/custom-audience/{audienceId}
    params: [path:audienceId*,query:locationId*] -> [path:audienceId*,query:isDraft,query:locationId*]
  PUT /ad-publishing/facebook/custom-audience/{audienceId}
    body schema changed
  GET /ad-publishing/facebook/custom-audience/{audienceId}
    params: [path:audienceId*,query:locationId*] -> [path:audienceId*,query:isDraft,query:locationId*]
  PUT /ad-publishing/facebook/page/default
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/facebook/lead-form/{leadFormId}
    params: [path:leadFormId*,query:locationId*] -> [path:leadFormId*,query:isDraft,query:locationId*]
  PUT /ad-publishing/facebook/campaigns
    body schema changed
  PUT /ad-publishing/facebook/adsets
    body schema changed
  GET /ad-publishing/google/conversions/{conversionId}
    params: [path:conversionId*,query:locationId*] -> [path:conversionId*,query:isDraft,query:locationId*]
  DELETE /ad-publishing/google/conversions/{conversionId}
    params: [path:conversionId*,query:locationId*] -> [path:conversionId*,query:isDraft,query:locationId*]
  GET /ad-publishing/google/integration
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/google/me
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/google/ad-accounts/{adAccountId}
    params: [path:adAccountId*,query:locationId*] -> [path:adAccountId*,query:isDraft,query:locationId*]
  POST /ad-publishing/google/keyword-ideas
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  POST /ad-publishing/google/assets
    body schema changed
  PUT /ad-publishing/google/segments
    body schema changed
  PUT /ad-publishing/google/audiences
    body schema changed
  GET /ad-publishing/google/audiences
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/google/audiences/{audienceId}
    params: [path:audienceId*,query:locationId*] -> [path:audienceId*,query:isDraft,query:locationId*]
  PUT /ad-publishing/google/ads
    body schema changed
  GET /ad-publishing/google/ads/{adId}
    params: [path:adId*,query:locationId*] -> [path:adId*,query:isDraft,query:locationId*]
  GET /ad-publishing/google/conversion-goals
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/linkedin/integration
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/linkedin/ad-accounts
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/linkedin/me
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
  GET /ad-publishing/linkedin/ads/{adId}
    params: [path:adId*,query:locationId*] -> [path:adId*,query:isDraft,query:locationId*]
  PUT /ad-publishing/linkedin/ads
    body schema changed
  GET /ad-publishing/linkedin/{accountId}/forms
    params: [path:accountId*,query:locationId*] -> [path:accountId*,query:isDraft,query:locationId*]
  POST /ad-publishing/linkedin/{accountId}/form
    params: [query:locationId*] -> [query:isDraft,query:locationId*]
    body schema changed
  PATCH /ad-publishing/linkedin/{adId}/status
    params: [path:adId*,query:locationId*] -> [path:adId*,query:isDraft,query:locationId*]

## affiliate-manager-v3  (v3: 4 actions | v2 "affiliate-manager": 4)
CHANGED (same method+path, 4):
  GET /affiliate-manager/{locationId}/affiliates
    version: 2021-07-28 -> v3
  GET /affiliate-manager/{locationId}/affiliates/{affiliateId}
    version: 2021-07-28 -> v3
  GET /affiliate-manager/{locationId}/payouts
    version: 2021-07-28 -> v3
  GET /affiliate-manager/{locationId}/commissions
    version: 2021-07-28 -> v3

## agent-studio-v3  (v3: 11 actions | v2 "agent-studio": 11)
CHANGED (same method+path, 11):
  POST /agent-studio/agent
    version: 2021-04-15 -> v3
  GET /agent-studio/agent
    version: 2021-04-15 -> v3
  PATCH /agent-studio/agent/versions/{versionId}
    version: 2021-04-15 -> v3
  PATCH /agent-studio/agent/{agentId}
    version: 2021-04-15 -> v3
  DELETE /agent-studio/agent/{agentId}
    version: 2021-04-15 -> v3
  GET /agent-studio/agent/{agentId}
    version: 2021-04-15 -> v3
  POST /agent-studio/agent/versions/{versionId}/publish
    version: 2021-04-15 -> v3
  POST /agent-studio/agent/{agentId}/execute
    version: 2021-04-15 -> v3
  GET /agent-studio/public-api/agents
    version: 2021-04-15 -> v3
  GET /agent-studio/public-api/agents/{agentId}
    version: 2021-04-15 -> v3
  POST /agent-studio/public-api/agents/{agentId}/execute
    version: 2021-04-15 -> v3

## associations-v3  (v3: 10 actions | v2 "associations": 10)
CHANGED (same method+path, 10):
  POST /associations/relations
    version: 2021-07-28 -> v3
  GET /associations/relations/{recordId}
    version: 2021-07-28 -> v3
  DELETE /associations/relations/{relationId}
    version: 2021-07-28 -> v3
  GET /associations/key/{key_name}
    version: 2021-07-28 -> v3
  GET /associations/objectKey/{objectKey}
    version: 2021-07-28 -> v3
  PUT /associations/{associationId}
    version: 2021-07-28 -> v3
  DELETE /associations/{associationId}
    version: 2021-07-28 -> v3
  GET /associations/{associationId}
    version: 2021-07-28 -> v3
  POST /associations/
    version: 2021-07-28 -> v3
  GET /associations/
    version: 2021-07-28 -> v3

## blogs-v3  (v3: 7 actions | v2 "blogs": 7)
CHANGED (same method+path, 7):
  GET /blogs/posts/url-slug-exists
    version: 2021-07-28 -> v3
  PUT /blogs/posts/{postId}
    version: 2021-07-28 -> v3
    body schema changed
  POST /blogs/posts
    version: 2021-07-28 -> v3
  GET /blogs/authors
    version: 2021-07-28 -> v3
  GET /blogs/categories
    version: 2021-07-28 -> v3
  GET /blogs/posts/all
    version: 2021-07-28 -> v3
  GET /blogs/site/all
    version: 2021-07-28 -> v3

## brand-boards-v3  (v3: 11 actions | v2 "brand-boards": 5)
NEW in v3 (6):
  DELETE /brand-boards/locations/{locationId}/brand-voices/{brandVoiceId}
  GET /brand-boards/locations/{locationId}/brand-voices
  GET /brand-boards/locations/{locationId}/brand-voices/{brandVoiceId}
  PATCH /brand-boards/locations/{locationId}/brand-voices/{brandVoiceId}
  POST /brand-boards/locations/{locationId}/brand-voices
  POST /brand-boards/locations/{locationId}/brand-voices/{brandVoiceId}/default
CHANGED (same method+path, 5):
  GET /brand-boards/{locationId}
    version: 2021-07-28 -> v3
  GET /brand-boards/{locationId}/{id}
    version: 2021-07-28 -> v3
  PATCH /brand-boards/{locationId}/{id}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /brand-boards/{locationId}/{id}
    version: 2021-07-28 -> v3
  POST /brand-boards/
    version: 2021-07-28 -> v3
    body schema changed

## businesses-v3  (v3: 5 actions | v2 "businesses": 5)
CHANGED (same method+path, 5):
  PUT /businesses/{businessId}
    version: 2021-07-28 -> v3
  DELETE /businesses/{businessId}
    version: 2021-07-28 -> v3
  GET /businesses/{businessId}
    version: 2021-07-28 -> v3
  GET /businesses/
    version: 2021-07-28 -> v3
  POST /businesses/
    version: 2021-07-28 -> v3

## calendars-v3  (v3: 59 actions | v2 "calendars": 41)
NEW in v3 (18):
  DELETE /calendars/services/bookings/{bookingId}
  DELETE /calendars/services/catalog/{serviceId}
  DELETE /calendars/services/locations/{serviceLocationId}
  GET /calendars/schedules/event-calendar/{calendarId}
  GET /calendars/services/bookings
  GET /calendars/services/bookings/{bookingId}
  GET /calendars/services/catalog
  GET /calendars/services/catalog/{serviceId}
  GET /calendars/services/locations
  GET /calendars/services/locations/{serviceLocationId}
  POST /calendars/schedules/event-calendar/{calendarId}
  POST /calendars/services/bookings
  POST /calendars/services/catalog
  POST /calendars/services/locations
  PUT /calendars/schedules/event-calendar/{calendarId}
  PUT /calendars/services/bookings/{bookingId}
  PUT /calendars/services/catalog/{serviceId}
  PUT /calendars/services/locations/{serviceLocationId}
CHANGED (same method+path, 41):
  GET /calendars/groups
    version: 2021-04-15 -> v3
  POST /calendars/groups
    version: 2021-04-15 -> v3
  POST /calendars/groups/validate-slug
    version: 2021-04-15 -> v3
  DELETE /calendars/groups/{groupId}
    version: 2021-04-15 -> v3
  PUT /calendars/groups/{groupId}
    version: 2021-04-15 -> v3
  PUT /calendars/groups/{groupId}/status
    version: 2021-04-15 -> v3
  POST /calendars/events/appointments
    version: 2021-04-15 -> v3
    body schema changed
  PUT /calendars/events/appointments/{eventId}
    version: 2021-04-15 -> v3
    body schema changed
  GET /calendars/events/appointments/{eventId}
    version: 2021-04-15 -> v3
  GET /calendars/events
    version: 2021-04-15 -> v3
  GET /calendars/blocked-slots
    version: 2021-04-15 -> v3
  POST /calendars/events/block-slots
    version: 2021-04-15 -> v3
  PUT /calendars/events/block-slots/{eventId}
    version: 2021-04-15 -> v3
  GET /calendars/{calendarId}/free-slots
    version: 2021-04-15 -> v3
  PUT /calendars/{calendarId}
    version: 2021-04-15 -> v3
    body schema changed
  GET /calendars/{calendarId}
    version: 2021-04-15 -> v3
  DELETE /calendars/{calendarId}
    version: 2021-04-15 -> v3
  DELETE /calendars/events/{eventId}
    version: 2021-04-15 -> v3
  GET /calendars/appointments/{appointmentId}/notes
    version: 2021-04-15 -> v3
  POST /calendars/appointments/{appointmentId}/notes
    version: 2021-04-15 -> v3
  PUT /calendars/appointments/{appointmentId}/notes/{noteId}
    version: 2021-04-15 -> v3
  DELETE /calendars/appointments/{appointmentId}/notes/{noteId}
    version: 2021-04-15 -> v3
  GET /calendars/resources/{resourceType}/{id}
    version: 2021-04-15 -> v3
  PUT /calendars/resources/{resourceType}/{id}
    version: 2021-04-15 -> v3
  DELETE /calendars/resources/{resourceType}/{id}
    version: 2021-04-15 -> v3
  GET /calendars/resources/{resourceType}
    version: 2021-04-15 -> v3
  POST /calendars/resources/{resourceType}
    version: 2021-04-15 -> v3
  GET /calendars/{calendarId}/notifications
    version: 2021-04-15 -> v3
  POST /calendars/{calendarId}/notifications
    version: 2021-04-15 -> v3
  GET /calendars/{calendarId}/notifications/{notificationId}
    version: 2021-04-15 -> v3
  PUT /calendars/{calendarId}/notifications/{notificationId}
    version: 2021-04-15 -> v3
  DELETE /calendars/{calendarId}/notifications/{notificationId}
    version: 2021-04-15 -> v3
  GET /calendars/schedules/search
    version: 2021-04-15 -> v3
  GET /calendars/schedules/{id}
    version: 2021-04-15 -> v3
  PUT /calendars/schedules/{id}
    version: 2021-04-15 -> v3
  DELETE /calendars/schedules/{id}
    version: 2021-04-15 -> v3
  POST /calendars/schedules
    version: 2021-04-15 -> v3
  PUT /calendars/schedules/{id}/associations/{calendarId}
    version: 2021-04-15 -> v3
  DELETE /calendars/schedules/{id}/associations/{calendarId}
    version: 2021-04-15 -> v3
  GET /calendars/
    version: 2021-04-15 -> v3
  POST /calendars/
    version: 2021-04-15 -> v3
    body schema changed

## campaigns-v3  (v3: 1 actions | v2 "campaigns": 1)
CHANGED (same method+path, 1):
  GET /campaigns/
    version: 2021-07-28 -> v3

## chat-widget-v3  (v3: 8 actions | v2 "—": 0)
NEW in v3 (8):
  DELETE /chat-widget/{locationId}/{id}
  GET /chat-widget/data/{locationId}/{id}
  GET /chat-widget/list
  GET /chat-widget/public/config/{id}
  PATCH /chat-widget/data/{locationId}/{id}
  POST /chat-widget/
  POST /chat-widget/clone
  PUT /chat-widget/data/{locationId}/{id}

## companies-v3  (v3: 1 actions | v2 "companies": 1)
CHANGED (same method+path, 1):
  GET /companies/{companyId}
    version: 2021-07-28 -> v3

## contacts-v3  (v3: 31 actions | v2 "contacts": 32)
NEW in v3 (1):
  DELETE /contacts/{contactId}/campaigns/remove-all
v2-only / not in v3 (2):
  DELETE /contacts/{contactId}/campaigns/removeAll
  GET /contacts/
CHANGED (same method+path, 30):
  POST /contacts/search
    version: 2021-07-28 -> v3
  GET /contacts/search/duplicate
    version: 2021-07-28 -> v3
  GET /contacts/{contactId}/tasks
    version: 2021-07-28 -> v3
  POST /contacts/{contactId}/tasks
    version: 2021-07-28 -> v3
    body schema changed
  GET /contacts/{contactId}/tasks/{taskId}
    version: 2021-07-28 -> v3
  PUT /contacts/{contactId}/tasks/{taskId}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}/tasks/{taskId}
    version: 2021-07-28 -> v3
  PUT /contacts/{contactId}/tasks/{taskId}/completed
    version: 2021-07-28 -> v3
    body schema changed
  GET /contacts/{contactId}/appointments
    version: 2021-07-28 -> v3
  POST /contacts/{contactId}/tags
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}/tags
    version: 2021-07-28 -> v3
    body schema changed
  GET /contacts/{contactId}/notes
    version: 2021-07-28 -> v3
  POST /contacts/{contactId}/notes
    version: 2021-07-28 -> v3
    body schema changed
  GET /contacts/{contactId}/notes/{id}
    version: 2021-07-28 -> v3
  PUT /contacts/{contactId}/notes/{id}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}/notes/{id}
    version: 2021-07-28 -> v3
  POST /contacts/bulk/tags/update/{type}
    version: 2021-07-28 -> v3
  POST /contacts/bulk/business
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}
    version: 2021-07-28 -> v3
  GET /contacts/{contactId}
    version: 2021-07-28 -> v3
  PUT /contacts/{contactId}
    version: 2021-07-28 -> v3
    body schema changed
  POST /contacts/upsert
    version: 2021-07-28 -> v3
    body schema changed
  GET /contacts/business/{businessId}
    params: [path:businessId*,query:limit,query:locationId*,query:query,query:skip] -> [path:businessId*,query:limit,query:locationId*,query:query,query:skip,query:startAfter]
    version: 2021-07-28 -> v3
  POST /contacts/{contactId}/followers
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}/followers
    version: 2021-07-28 -> v3
    body schema changed
  POST /contacts/{contactId}/campaigns/{campaignId}
    version: 2021-07-28 -> v3
  DELETE /contacts/{contactId}/campaigns/{campaignId}
    version: 2021-07-28 -> v3
  POST /contacts/{contactId}/workflow/{workflowId}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /contacts/{contactId}/workflow/{workflowId}
    version: 2021-07-28 -> v3
    body schema changed
  POST /contacts/
    version: 2021-07-28 -> v3
    body schema changed

## conversation-ai-v3  (v3: 12 actions | v2 "conversation-ai": 12)
CHANGED (same method+path, 12):
  POST /conversation-ai/agents/{agentId}/actions
    version: 2021-04-15 -> v3
  GET /conversation-ai/agents/{agentId}/actions/list
    version: 2021-04-15 -> v3
  GET /conversation-ai/agents/{agentId}/actions/{actionId}
    version: 2021-04-15 -> v3
  PUT /conversation-ai/agents/{agentId}/actions/{actionId}
    version: 2021-04-15 -> v3
  DELETE /conversation-ai/agents/{agentId}/actions/{actionId}
    version: 2021-04-15 -> v3
  PATCH /conversation-ai/agents/{agentId}/followup-settings
    version: 2021-04-15 -> v3
  POST /conversation-ai/agents
    version: 2021-04-15 -> v3
  GET /conversation-ai/agents/search
    version: 2021-04-15 -> v3
  PUT /conversation-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  GET /conversation-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  DELETE /conversation-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  GET /conversation-ai/generations
    version: 2021-04-15 -> v3

## conversations-v3  (v3: 25 actions | v2 "conversations": 29)
NEW in v3 (1):
  PUT /conversations/messages/email/{id}/status
v2-only / not in v3 (5):
  GET /conversations/preferences/custom-subtypes
  GET /conversations/preferences/unsubscriptions/status
  POST /conversations/preferences/custom-subtypes
  POST /conversations/preferences/unsubscriptions/user-change
  PUT /conversations/preferences/custom-subtypes/{id}
CHANGED (same method+path, 22):
  GET /conversations/search
    version: 2021-04-15 -> v3
  GET /conversations/{conversationId}
    version: 2021-04-15 -> v3
  PUT /conversations/{conversationId}
    version: 2021-04-15 -> v3
    body schema changed
  DELETE /conversations/{conversationId}
    version: 2021-04-15 -> v3
  GET /conversations/messages/export
    version: 2021-04-15 -> v3
  GET /conversations/messages/{id}
    version: 2021-04-15 -> v3
  GET /conversations/{conversationId}/messages
    version: 2021-04-15 -> v3
  POST /conversations/messages
    version: 2021-04-15 -> v3
  POST /conversations/messages/inbound
    version: 2021-04-15 -> v3
    body schema changed
  POST /conversations/messages/outbound
    version: 2021-04-15 -> v3
    body schema changed
  DELETE /conversations/messages/{messageId}/schedule
    version: 2021-04-15 -> v3
  POST /conversations/messages/upload
    version: 2021-04-15 -> v3
    body schema changed
  PUT /conversations/messages/{messageId}/status
    version: 2021-04-15 -> v3
    body schema changed
  PUT /conversations/messages/{messageId}/attachments
    version: 2021-04-15 -> v3
  GET /conversations/messages/{messageId}/locations/{locationId}/recording
    version: 2021-04-15 -> v3
  GET /conversations/locations/{locationId}/messages/{messageId}/transcription
    version: 2021-04-15 -> v3
  GET /conversations/locations/{locationId}/messages/{messageId}/transcription/download
    version: 2021-04-15 -> v3
  POST /conversations/providers/live-chat/typing
    version: 2021-04-15 -> v3
    body schema changed
  POST /conversations/
    version: 2021-04-15 -> v3
  POST /conversations/messages/review-reply
    version: 2021-04-15 -> v3
  POST /conversations/messages/upload/initiate
    version: 2021-04-15 -> v3
  POST /conversations/messages/upload/complete
    version: 2021-04-15 -> v3

## courses-v3  (v3: 1 actions | v2 "courses": 1)
CHANGED (same method+path, 1):
  POST /courses/courses-exporter/public/import
    version: 2021-07-28 -> v3

## custom-fields-v3  (v3: 8 actions | v2 "custom-fields": 8)
CHANGED (same method+path, 8):
  GET /custom-fields/{id}
    version: 2021-07-28 -> v3
  PUT /custom-fields/{id}
    version: 2021-07-28 -> v3
  DELETE /custom-fields/{id}
    version: 2021-07-28 -> v3
  GET /custom-fields/object-key/{objectKey}
    version: 2021-07-28 -> v3
  POST /custom-fields/folder
    version: 2021-07-28 -> v3
  PUT /custom-fields/folder/{id}
    version: 2021-07-28 -> v3
  DELETE /custom-fields/folder/{id}
    version: 2021-07-28 -> v3
  POST /custom-fields/
    version: 2021-07-28 -> v3

## custom-menus-v3  (v3: 5 actions | v2 "custom-menus": 5)
CHANGED (same method+path, 5):
  GET /custom-menus/{customMenuId}
    version: 2021-07-28 -> v3
  DELETE /custom-menus/{customMenuId}
    version: 2021-07-28 -> v3
  PUT /custom-menus/{customMenuId}
    version: 2021-07-28 -> v3
  GET /custom-menus/
    version: 2021-07-28 -> v3
  POST /custom-menus/
    version: 2021-07-28 -> v3

## email-isv-v3  (v3: 1 actions | v2 "email-isv": 1)
CHANGED (same method+path, 1):
  POST /email/verify
    version: 2021-07-28 -> v3

## emails-v3  (v3: 18 actions | v2 "emails": 5)
NEW in v3 (18):
  DELETE /emails/locations/{locationId}/campaigns/emails/{campaignId}
  DELETE /emails/locations/{locationId}/templates/{templateId}
  GET /emails/locations/{locationId}/campaigns/bulk-actions
  GET /emails/locations/{locationId}/campaigns/bulk-actions/{campaignId}
  GET /emails/locations/{locationId}/campaigns/emails
  GET /emails/locations/{locationId}/campaigns/emails/{campaignId}
  GET /emails/locations/{locationId}/campaigns/stats/{source}/{sourceId}
  GET /emails/locations/{locationId}/campaigns/workflows
  GET /emails/locations/{locationId}/campaigns/workflows/{campaignId}
  GET /emails/locations/{locationId}/templates
  GET /emails/locations/{locationId}/templates/{templateId}
  PATCH /emails/locations/{locationId}/campaigns/emails/{campaignId}
  PATCH /emails/locations/{locationId}/templates/{templateId}
  POST /emails/locations/{locationId}/campaigns/emails
  POST /emails/locations/{locationId}/campaigns/emails/{campaignId}/schedule
  POST /emails/locations/{locationId}/templates
  POST /emails/locations/{locationId}/templates/folders
  POST /emails/locations/{locationId}/templates/import
v2-only / not in v3 (5):
  DELETE /emails/builder/{locationId}/{templateId}
  GET /emails/builder
  GET /emails/schedule
  POST /emails/builder
  POST /emails/builder/data

## forms-v3  (v3: 3 actions | v2 "forms": 3)
CHANGED (same method+path, 3):
  GET /forms/submissions
    version: 2021-07-28 -> v3
  POST /forms/upload-custom-files
    version: 2021-07-28 -> v3
  GET /forms/
    version: 2021-07-28 -> v3

## funnels-v3  (v3: 7 actions | v2 "funnels": 7)
CHANGED (same method+path, 4):
  POST /funnels/lookup/redirect
    version: 2021-07-28 -> v3
  PATCH /funnels/lookup/redirect/{id}
    version: 2021-07-28 -> v3
  DELETE /funnels/lookup/redirect/{id}
    version: 2021-07-28 -> v3
  GET /funnels/lookup/redirect/list
    version: 2021-07-28 -> v3

## invoices-v3  (v3: 42 actions | v2 "invoices": 42)
CHANGED (same method+path, 42):
  POST /invoices/template
    version: 2021-07-28 -> v3
  GET /invoices/template
    version: 2021-07-28 -> v3
  GET /invoices/template/{templateId}
    version: 2021-07-28 -> v3
  PUT /invoices/template/{templateId}
    version: 2021-07-28 -> v3
  DELETE /invoices/template/{templateId}
    version: 2021-07-28 -> v3
  PATCH /invoices/template/{templateId}/late-fees-configuration
    version: 2021-07-28 -> v3
  PATCH /invoices/template/{templateId}/payment-methods-configuration
    version: 2021-07-28 -> v3
  POST /invoices/schedule
    version: 2021-07-28 -> v3
  GET /invoices/schedule
    version: 2021-07-28 -> v3
  GET /invoices/schedule/{scheduleId}
    version: 2021-07-28 -> v3
  PUT /invoices/schedule/{scheduleId}
    version: 2021-07-28 -> v3
  DELETE /invoices/schedule/{scheduleId}
    version: 2021-07-28 -> v3
  POST /invoices/schedule/{scheduleId}/updateAndSchedule
    version: 2021-07-28 -> v3
  POST /invoices/schedule/{scheduleId}/schedule
    version: 2021-07-28 -> v3
  POST /invoices/schedule/{scheduleId}/auto-payment
    version: 2021-07-28 -> v3
  POST /invoices/schedule/{scheduleId}/cancel
    version: 2021-07-28 -> v3
  POST /invoices/text2pay
    version: 2021-07-28 -> v3
  GET /invoices/generate-invoice-number
    version: 2021-07-28 -> v3
  GET /invoices/settings
    version: 2021-07-28 -> v3
  GET /invoices/{invoiceId}
    version: 2021-07-28 -> v3
  PUT /invoices/{invoiceId}
    version: 2021-07-28 -> v3
  DELETE /invoices/{invoiceId}
    version: 2021-07-28 -> v3
  PATCH /invoices/{invoiceId}/late-fees-configuration
    version: 2021-07-28 -> v3
  POST /invoices/{invoiceId}/void
    version: 2021-07-28 -> v3
  POST /invoices/{invoiceId}/send
    version: 2021-07-28 -> v3
  POST /invoices/{invoiceId}/record-payment
    version: 2021-07-28 -> v3
  PATCH /invoices/stats/last-visited-at
    version: 2021-07-28 -> v3
  POST /invoices/estimate
    version: 2021-07-28 -> v3
  PUT /invoices/estimate/{estimateId}
    version: 2021-07-28 -> v3
  DELETE /invoices/estimate/{estimateId}
    version: 2021-07-28 -> v3
  GET /invoices/estimate/number/generate
    version: 2021-07-28 -> v3
  POST /invoices/estimate/{estimateId}/send
    version: 2021-07-28 -> v3
  POST /invoices/estimate/{estimateId}/invoice
    version: 2021-07-28 -> v3
  GET /invoices/estimate/list
    version: 2021-07-28 -> v3
  PATCH /invoices/estimate/stats/last-visited-at
    version: 2021-07-28 -> v3
  GET /invoices/estimate/template
    version: 2021-07-28 -> v3
  POST /invoices/estimate/template
    version: 2021-07-28 -> v3
  PUT /invoices/estimate/template/{templateId}
    version: 2021-07-28 -> v3
  DELETE /invoices/estimate/template/{templateId}
    version: 2021-07-28 -> v3
  GET /invoices/estimate/template/preview
    version: 2021-07-28 -> v3
  POST /invoices/
    version: 2021-07-28 -> v3
  GET /invoices/
    version: 2021-07-28 -> v3

## knowledge-base-v3  (v3: 14 actions | v2 "knowledge-base": 14)
CHANGED (same method+path, 14):
  GET /knowledge-bases/faqs
    version: 2021-04-15 -> v3
  POST /knowledge-bases/faqs
    version: 2021-04-15 -> v3
  PUT /knowledge-bases/faqs/{id}
    version: 2021-04-15 -> v3
  DELETE /knowledge-bases/faqs/{id}
    version: 2021-04-15 -> v3
  GET /knowledge-bases/crawler
    version: 2021-04-15 -> v3
  POST /knowledge-bases/crawler
    version: 2021-04-15 -> v3
  DELETE /knowledge-bases/crawler
    version: 2021-04-15 -> v3
  GET /knowledge-bases/crawler/status
    version: 2021-04-15 -> v3
  POST /knowledge-bases/crawler/train
    version: 2021-04-15 -> v3
  GET /knowledge-bases/{knowledgeBaseId}
    version: 2021-04-15 -> v3
  DELETE /knowledge-bases/{knowledgeBaseId}
    version: 2021-04-15 -> v3
  PUT /knowledge-bases/{id}
    version: 2021-04-15 -> v3
  GET /knowledge-bases/
    version: 2021-04-15 -> v3
  POST /knowledge-bases/
    version: 2021-04-15 -> v3

## links-v3  (v3: 6 actions | v2 "links": 6)
CHANGED (same method+path, 6):
  GET /links/id/{linkId}
    version: 2021-07-28 -> v3
  PUT /links/{linkId}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /links/{linkId}
    version: 2021-07-28 -> v3
  GET /links/search
    version: 2021-04-15 -> v3
  GET /links/
    version: 2021-07-28 -> v3
  POST /links/
    version: 2021-07-28 -> v3
    body schema changed

## locations-v3  (v3: 32 actions | v2 "locations": 29)
NEW in v3 (3):
  GET /locations/{locationId}/conversationChannels/{type}
  GET /locations/{locationId}/permissions
  PUT /locations/{locationId}/permissions
CHANGED (same method+path, 29):
  GET /locations/search
    version: 2021-07-28 -> v3
  GET /locations/{locationId}
    version: 2021-07-28 -> v3
  PUT /locations/{locationId}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /locations/{locationId}
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/tags
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/tags
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/tags/{tagId}
    version: 2021-07-28 -> v3
  PUT /locations/{locationId}/tags/{tagId}
    version: 2021-07-28 -> v3
  DELETE /locations/{locationId}/tags/{tagId}
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/tasks/search
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/recurring-tasks/{id}
    version: 2021-07-28 -> v3
  PUT /locations/{locationId}/recurring-tasks/{id}
    version: 2021-07-28 -> v3
  DELETE /locations/{locationId}/recurring-tasks/{id}
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/recurring-tasks
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/customFields
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/customFields
    version: 2021-07-28 -> v3
    body schema changed
  GET /locations/{locationId}/customFields/{id}
    version: 2021-07-28 -> v3
  PUT /locations/{locationId}/customFields/{id}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /locations/{locationId}/customFields/{id}
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/customFields/upload
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/customValues
    version: 2021-07-28 -> v3
  POST /locations/{locationId}/customValues
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/customValues/{id}
    version: 2021-07-28 -> v3
  PUT /locations/{locationId}/customValues/{id}
    version: 2021-07-28 -> v3
  DELETE /locations/{locationId}/customValues/{id}
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/timezones
    version: 2021-07-28 -> v3
  GET /locations/{locationId}/templates
    version: 2021-07-28 -> v3
  DELETE /locations/{locationId}/templates/{id}
    version: 2021-07-28 -> v3
  POST /locations/
    version: 2021-07-28 -> v3
    body schema changed

## marketplace-v3  (v3: 9 actions | v2 "marketplace": 9)
CHANGED (same method+path, 4):
  DELETE /marketplace/app/{appId}/installations
    version: 2021-07-28 -> v3
  GET /marketplace/app/{appId}/installations
    version: 2021-07-28 -> v3
  GET /marketplace/app/{appId}/rebilling-config/location/{locationId}
    version: 2021-07-28 -> v3
  POST /marketplace/external-auth/migration
    version: 2021-07-28 -> v3

## medias-v3  (v3: 7 actions | v2 "medias": 7)
CHANGED (same method+path, 7):
  GET /medias/files
    version: 2021-07-28 -> v3
  POST /medias/upload-file
    version: 2021-07-28 -> v3
  DELETE /medias/{id}
    version: 2021-07-28 -> v3
  POST /medias/{id}
    version: 2021-07-28 -> v3
  POST /medias/folder
    version: 2021-07-28 -> v3
  PUT /medias/update-files
    version: 2021-07-28 -> v3
  PUT /medias/delete-files
    version: 2021-07-28 -> v3

## oauth-v3  (v3: 3 actions | v2 "oauth": 3)
NEW in v3 (2):
  GET /oauth/installed-locations
  POST /oauth/location-token
v2-only / not in v3 (2):
  GET /oauth/installedLocations
  POST /oauth/locationToken
CHANGED (same method+path, 1):
  POST /oauth/token
    version: null -> v3
    body schema changed

## objects-v3  (v3: 9 actions | v2 "objects": 9)
CHANGED (same method+path, 9):
  GET /objects/{key}
    version: 2021-07-28 -> v3
  PUT /objects/{key}
    version: 2021-07-28 -> v3
  GET /objects/{schemaKey}/records/{id}
    version: 2021-07-28 -> v3
  PUT /objects/{schemaKey}/records/{id}
    version: 2021-07-28 -> v3
  DELETE /objects/{schemaKey}/records/{id}
    version: 2021-07-28 -> v3
  POST /objects/{schemaKey}/records
    version: 2021-07-28 -> v3
  POST /objects/{schemaKey}/records/search
    version: 2021-07-28 -> v3
  GET /objects/
    version: 2021-07-28 -> v3
  POST /objects/
    version: 2021-07-28 -> v3

## opportunities-v3  (v3: 12 actions | v2 "opportunities": 12)
CHANGED (same method+path, 12):
  GET /opportunities/lost-reason
    version: 2021-07-28 -> v3
  GET /opportunities/search
    params: [query:assigned_to,query:campaignId,query:contact_id,query:country,query:date,query:endDate,query:getCalendarEvents,query:getNotes,query:getTasks,query:id,query:limit,query:location_id*,query:order,query:page,query:pipeline_id,query:pipeline_stage_id,query:q,query:startAfter,query:startAfterId,query:status] -> [query:assignedTo,query:campaignId,query:contactId,query:country,query:date,query:endDate,query:getCalendarEvents,query:getNotes,query:getTasks,query:id,query:limit,query:locationId*,query:order,query:page,query:pipelineId,query:pipelineStageId,query:q,query:startAfter,query:startAfterId,query:status]
    version: 2021-07-28 -> v3
  POST /opportunities/search
    version: 2021-07-28 -> v3
    body schema changed
  GET /opportunities/pipelines
    version: 2021-07-28 -> v3
  GET /opportunities/{id}
    version: 2021-07-28 -> v3
  DELETE /opportunities/{id}
    version: 2021-07-28 -> v3
  PUT /opportunities/{id}
    version: 2021-07-28 -> v3
    body schema changed
  PUT /opportunities/{id}/status
    version: 2021-07-28 -> v3
    body schema changed
  POST /opportunities/upsert
    version: 2021-07-28 -> v3
    body schema changed
  POST /opportunities/{id}/followers
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /opportunities/{id}/followers
    version: 2021-07-28 -> v3
    body schema changed
  POST /opportunities/
    version: 2021-07-28 -> v3
    body schema changed

## payments-v3  (v3: 23 actions | v2 "payments": 23)
CHANGED (same method+path, 23):
  POST /payments/integrations/provider/whitelabel
    version: 2021-07-28 -> v3
  GET /payments/integrations/provider/whitelabel
    version: 2021-07-28 -> v3
  GET /payments/orders
    version: 2021-07-28 -> v3
  GET /payments/orders/{orderId}
    version: 2021-07-28 -> v3
  POST /payments/orders/{orderId}/record-payment
    version: 2021-07-28 -> v3
  POST /payments/orders/{orderId}/fulfillments
    version: 2021-07-28 -> v3
  GET /payments/orders/{orderId}/fulfillments
    version: 2021-07-28 -> v3
  GET /payments/orders/{orderId}/notes
    version: 2021-07-28 -> v3
  GET /payments/transactions
    version: 2021-07-28 -> v3
  GET /payments/transactions/{transactionId}
    version: 2021-07-28 -> v3
  GET /payments/subscriptions
    version: 2021-07-28 -> v3
  GET /payments/subscriptions/{subscriptionId}
    version: 2021-07-28 -> v3
  GET /payments/coupon/list
    version: 2021-07-28 -> v3
  POST /payments/coupon
    version: 2021-07-28 -> v3
    body schema changed
  PUT /payments/coupon
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /payments/coupon
    version: 2021-07-28 -> v3
  GET /payments/coupon
    version: 2021-07-28 -> v3
  POST /payments/custom-provider/provider
    version: 2021-07-28 -> v3
  DELETE /payments/custom-provider/provider
    version: 2021-07-28 -> v3
  GET /payments/custom-provider/connect
    version: 2021-07-28 -> v3
  POST /payments/custom-provider/connect
    version: 2021-07-28 -> v3
  POST /payments/custom-provider/disconnect
    version: 2021-07-28 -> v3
  PUT /payments/custom-provider/capabilities
    version: 2021-07-28 -> v3

## phone-system-v3  (v3: 4 actions | v2 "phone-system": 4)
CHANGED (same method+path, 4):
  GET /phone-system/number-pools
    params: [query:locationId] -> [query:locationId*]
    version: 2021-07-28 -> null
  GET /phone-system/numbers/location/{locationId}/available
    params: [path:locationId*,query:anywhere,query:countryCode*,query:firstPart,query:lastPart,query:mmsEnabled,query:numberTypes,query:smsEnabled,query:voiceEnabled] -> [path:locationId*,query:anywhere*,query:countryCode*,query:firstPart*,query:lastPart*,query:mmsEnabled*,query:numberTypes*,query:smsEnabled*,query:voiceEnabled*]
    version: 2021-07-28 -> null
  POST /phone-system/numbers/location/{locationId}/purchase
    version: 2021-07-28 -> v3
    body schema changed
  GET /phone-system/numbers/location/{locationId}
    params: [path:locationId*,query:page,query:pageSize,query:searchFilter,query:skipNumberPool] -> [path:locationId*,query:includeRcsSenderIds,query:page,query:pageSize,query:searchFilter,query:skipNumberPool]
    version: 2021-07-28 -> v3

## products-v3  (v3: 27 actions | v2 "products": 27)
CHANGED (same method+path, 27):
  POST /products/bulk-update
    version: 2021-07-28 -> v3
  POST /products/bulk-update/edit
    version: 2021-07-28 -> v3
  POST /products/{productId}/price
    version: 2021-07-28 -> v3
  GET /products/{productId}/price
    version: 2021-07-28 -> v3
  GET /products/inventory
    version: 2021-07-28 -> v3
  POST /products/inventory
    version: 2021-07-28 -> v3
  GET /products/{productId}/price/{priceId}
    version: 2021-07-28 -> v3
  PUT /products/{productId}/price/{priceId}
    version: 2021-07-28 -> v3
  DELETE /products/{productId}/price/{priceId}
    version: 2021-07-28 -> v3
  GET /products/store/{storeId}/stats
    version: 2021-07-28 -> v3
  POST /products/store/{storeId}
    version: 2021-07-28 -> v3
  POST /products/store/{storeId}/priority
    version: 2021-07-28 -> v3
  GET /products/collections
    version: 2021-07-28 -> v3
  POST /products/collections
    version: 2021-07-28 -> v3
  GET /products/collections/{collectionId}
    version: 2021-07-28 -> v3
  PUT /products/collections/{collectionId}
    version: 2021-07-28 -> v3
  DELETE /products/collections/{collectionId}
    version: 2021-07-28 -> v3
  GET /products/reviews
    version: 2021-07-28 -> v3
  GET /products/reviews/count
    version: 2021-07-28 -> v3
  PUT /products/reviews/{reviewId}
    version: 2021-07-28 -> v3
  DELETE /products/reviews/{reviewId}
    version: 2021-07-28 -> v3
  POST /products/reviews/bulk-update
    version: 2021-07-28 -> v3
  GET /products/{productId}
    version: 2021-07-28 -> v3
  DELETE /products/{productId}
    version: 2021-07-28 -> v3
  PUT /products/{productId}
    version: 2021-07-28 -> v3
  POST /products/
    version: 2021-07-28 -> v3
  GET /products/
    version: 2021-07-28 -> v3

## proposals-v3  (v3: 4 actions | v2 "proposals": 4)
CHANGED (same method+path, 4):
  GET /proposals/document
    params: [header:Authorization*,query:dateFrom,query:dateTo,query:limit,query:locationId*,query:paymentStatus,query:query,query:skip,query:status] -> [query:dateFrom,query:dateTo,query:limit,query:locationId*,query:paymentStatus,query:query,query:skip,query:status]
    version: 2021-07-28 -> v3
  POST /proposals/document/send
    params: [header:Authorization*] -> []
    version: 2021-07-28 -> v3
  GET /proposals/templates
    params: [header:Authorization*,query:dateFrom,query:dateTo,query:isPublicDocument,query:limit,query:locationId*,query:name,query:skip,query:type,query:userId] -> [query:dateFrom,query:dateTo,query:isPublicDocument,query:limit,query:locationId*,query:name,query:skip,query:type,query:userId]
    version: 2021-07-28 -> v3
  POST /proposals/templates/send
    params: [header:Authorization*] -> []
    version: 2021-07-28 -> v3

## saas-v3  (v3: 25 actions | v2 "saas-api": 22)
NEW in v3 (3):
  GET /saas-api/public-api/companies/{companyId}/locations/{locationId}/wallet-balance
  POST /saas-api/public-api/companies/{companyId}/locations/{locationId}/wallet-balance/complimentary-credits
  POST /saas/allow-attach-rebilling/{locationId}
CHANGED (same method+path, 22):
  GET /saas-api/public-api/locations
    version: 2021-04-15 -> v3
  PUT /saas-api/public-api/update-saas-subscription/{locationId}
    version: 2021-04-15 -> v3
  POST /saas-api/public-api/bulk-disable-saas/{companyId}
    version: 2021-04-15 -> v3
  POST /saas-api/public-api/enable-saas/{locationId}
    version: 2021-04-15 -> v3
  POST /saas-api/public-api/pause/{locationId}
    version: 2021-04-15 -> v3
  POST /saas-api/public-api/update-rebilling/{companyId}
    version: 2021-04-15 -> v3
  GET /saas-api/public-api/agency-plans/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  GET /saas-api/public-api/get-saas-subscription/{locationId}
    params: [header:Authorization*,path:locationId*,query:companyId*] -> [path:locationId*,query:companyId*]
    version: 2021-04-15 -> v3
  POST /saas-api/public-api/bulk-enable-saas/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  GET /saas-api/public-api/saas-locations/{companyId}
    params: [header:Authorization*,path:companyId*,query:page] -> [path:companyId*,query:page]
    version: 2021-04-15 -> v3
  GET /saas-api/public-api/saas-plan/{planId}
    params: [header:Authorization*,path:planId*,query:companyId*] -> [path:planId*,query:companyId*]
    version: 2021-04-15 -> v3
  GET /saas/locations
    params: [header:Authorization*,query:companyId*,query:customerId*,query:subscriptionId*] -> [query:companyId*,query:customerId*,query:subscriptionId*]
    version: 2021-04-15 -> v3
  PUT /saas/update-saas-subscription/{locationId}
    params: [header:Authorization*,path:locationId*] -> [path:locationId*]
    version: 2021-04-15 -> v3
  POST /saas/bulk-disable-saas/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  POST /saas/enable-saas/{locationId}
    params: [header:Authorization*,path:locationId*] -> [path:locationId*]
    version: 2021-04-15 -> v3
  POST /saas/pause/{locationId}
    params: [header:Authorization*,path:locationId*] -> [path:locationId*]
    version: 2021-04-15 -> v3
  POST /saas/update-rebilling/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  GET /saas/agency-plans/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  GET /saas/get-saas-subscription/{locationId}
    params: [header:Authorization*,path:locationId*,query:companyId*] -> [path:locationId*,query:companyId*]
    version: 2021-04-15 -> v3
  POST /saas/bulk-enable-saas/{companyId}
    params: [header:Authorization*,path:companyId*] -> [path:companyId*]
    version: 2021-04-15 -> v3
  GET /saas/saas-locations/{companyId}
    params: [header:Authorization*,path:companyId*,query:page*] -> [path:companyId*,query:page*]
    version: 2021-04-15 -> v3
  GET /saas/saas-plan/{planId}
    params: [header:Authorization*,path:planId*,query:companyId*] -> [path:planId*,query:companyId*]
    version: 2021-04-15 -> v3

## snapshots-v3  (v3: 4 actions | v2 "snapshots": 4)
CHANGED (same method+path, 4):
  GET /snapshots/
    version: 2021-07-28 -> v3
  POST /snapshots/share/link
    version: 2021-07-28 -> v3
  GET /snapshots/snapshot-status/{snapshotId}
    params: [path:snapshotId*,query:companyId*,query:from*,query:lastDoc*,query:limit*,query:to*] -> [path:snapshotId*,query:companyId*,query:from*,query:lastDoc*,query:limit,query:to*]
    version: 2021-07-28 -> v3
  GET /snapshots/snapshot-status/{snapshotId}/location/{locationId}
    version: 2021-07-28 -> v3

## social-planner-v3  (v3: 45 actions | v2 "social-media-posting": 40)
NEW in v3 (25):
  DELETE /social-media-posting/category/queues/{postId}/active-post
  DELETE /social-media-posting/category/queues/{queueId}/items/{itemId}
  DELETE /social-media-posting/comments/{platform}/{id}/like
  GET /social-media-posting/category/queues/available-categories
  GET /social-media-posting/category/queues/{queueId}
  GET /social-media-posting/oauth/{locationId}/{platform}/accounts/{accountId}
  GET /social-media-posting/oauth/{platform}/start
  POST /social-media-posting/category/queues
  POST /social-media-posting/category/queues/list
  POST /social-media-posting/category/queues/list/calendar
  POST /social-media-posting/category/queues/{queueId}/create/item
  POST /social-media-posting/category/queues/{queueId}/edit/calendar
  POST /social-media-posting/category/queues/{queueId}/edit/discard
  POST /social-media-posting/category/queues/{queueId}/edit/save
  POST /social-media-posting/category/queues/{queueId}/edit/start
  POST /social-media-posting/category/queues/{queueId}/items
  POST /social-media-posting/category/queues/{queueId}/items/{itemId}/clone
  POST /social-media-posting/category/queues/{queueId}/slots
  POST /social-media-posting/comments/{platform}
  POST /social-media-posting/comments/{platform}/list
  POST /social-media-posting/comments/{platform}/{id}/like
  POST /social-media-posting/oauth/{locationId}/{platform}/accounts/{accountId}
  PUT /social-media-posting/category/queues/{queueId}
  PUT /social-media-posting/category/queues/{queueId}/items/{itemId}
  PUT /social-media-posting/category/queues/{queueId}/items/{itemId}/reset
v2-only / not in v3 (20):
  GET /social-media-posting/oauth/facebook/start
  GET /social-media-posting/oauth/google/start
  GET /social-media-posting/oauth/instagram/start
  GET /social-media-posting/oauth/linkedin/start
  GET /social-media-posting/oauth/tiktok-business/start
  GET /social-media-posting/oauth/tiktok/start
  GET /social-media-posting/oauth/twitter/start
  GET /social-media-posting/oauth/{locationId}/facebook/accounts/{accountId}
  GET /social-media-posting/oauth/{locationId}/google/locations/{accountId}
  GET /social-media-posting/oauth/{locationId}/instagram/accounts/{accountId}
  GET /social-media-posting/oauth/{locationId}/linkedin/accounts/{accountId}
  GET /social-media-posting/oauth/{locationId}/tiktok-business/accounts/{accountId}
  GET /social-media-posting/oauth/{locationId}/tiktok/accounts/{accountId}
  GET /social-media-posting/oauth/{locationId}/twitter/accounts/{accountId}
  POST /social-media-posting/oauth/{locationId}/facebook/accounts/{accountId}
  POST /social-media-posting/oauth/{locationId}/google/locations/{accountId}
  POST /social-media-posting/oauth/{locationId}/instagram/accounts/{accountId}
  POST /social-media-posting/oauth/{locationId}/linkedin/accounts/{accountId}
  POST /social-media-posting/oauth/{locationId}/tiktok/accounts/{accountId}
  POST /social-media-posting/oauth/{locationId}/twitter/accounts/{accountId}
CHANGED (same method+path, 20):
  POST /social-media-posting/{locationId}/posts/list
    version: 2021-07-28 -> v3
    body schema changed
  POST /social-media-posting/{locationId}/posts
    version: 2021-07-28 -> v3
    body schema changed
  GET /social-media-posting/{locationId}/posts/{id}
    version: 2021-07-28 -> v3
  PUT /social-media-posting/{locationId}/posts/{id}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /social-media-posting/{locationId}/posts/{id}
    version: 2021-07-28 -> v3
  POST /social-media-posting/{locationId}/posts/bulk-delete
    version: 2021-07-28 -> v3
  GET /social-media-posting/{locationId}/accounts
    version: 2021-07-28 -> v3
  DELETE /social-media-posting/{locationId}/accounts/{id}
    version: 2021-07-28 -> v3
  POST /social-media-posting/{locationId}/csv
    version: 2021-07-28 -> v3
    body schema changed
  GET /social-media-posting/{locationId}/csv
    params: [path:locationId*,query:includeUsers,query:limit,query:skip,query:userId] -> [path:locationId*,query:includeUsers,query:isFromTemplate,query:limit,query:skip,query:userId*]
    version: 2021-07-28 -> v3
  POST /social-media-posting/{locationId}/set-accounts
    version: 2021-07-28 -> v3
    body schema changed
  GET /social-media-posting/{locationId}/csv/{id}
    version: 2021-07-28 -> v3
  PATCH /social-media-posting/{locationId}/csv/{id}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /social-media-posting/{locationId}/csv/{id}
    version: 2021-07-28 -> v3
  DELETE /social-media-posting/{locationId}/csv/{csvId}/post/{postId}
    version: 2021-07-28 -> v3
  GET /social-media-posting/{locationId}/categories
    version: 2021-07-28 -> v3
  GET /social-media-posting/{locationId}/categories/{id}
    version: 2021-07-28 -> v3
  GET /social-media-posting/{locationId}/tags
    version: 2021-07-28 -> v3
  POST /social-media-posting/{locationId}/tags/details
    version: 2021-07-28 -> v3
  POST /social-media-posting/statistics
    version: 2021-07-28 -> v3
    body schema changed

## store-v3  (v3: 18 actions | v2 "store": 18)
CHANGED (same method+path, 18):
  POST /store/shipping-zone
    params: [header:Authorization*] -> []
  GET /store/shipping-zone
    params: [header:Authorization*,query:altId*,query:altType*,query:limit,query:offset,query:withShippingRate] -> [query:altId*,query:altType*,query:limit,query:offset,query:withShippingRate]
  GET /store/shipping-zone/{shippingZoneId}
    params: [header:Authorization*,path:shippingZoneId*,query:altId*,query:altType*,query:withShippingRate] -> [path:shippingZoneId*,query:altId*,query:altType*,query:withShippingRate]
  PUT /store/shipping-zone/{shippingZoneId}
    params: [header:Authorization*,path:shippingZoneId*] -> [path:shippingZoneId*]
  DELETE /store/shipping-zone/{shippingZoneId}
    params: [header:Authorization*,path:shippingZoneId*,query:altId*,query:altType*] -> [path:shippingZoneId*,query:altId*,query:altType*]
  POST /store/shipping-zone/shipping-rates
    params: [header:Authorization*] -> []
  POST /store/shipping-zone/{shippingZoneId}/shipping-rate
    params: [header:Authorization*,path:shippingZoneId*] -> [path:shippingZoneId*]
  GET /store/shipping-zone/{shippingZoneId}/shipping-rate
    params: [header:Authorization*,path:shippingZoneId*,query:altId*,query:altType*,query:limit,query:offset] -> [path:shippingZoneId*,query:altId*,query:altType*,query:limit,query:offset]
  GET /store/shipping-zone/{shippingZoneId}/shipping-rate/{shippingRateId}
    params: [header:Authorization*,path:shippingRateId*,path:shippingZoneId*,query:altId*,query:altType*] -> [path:shippingRateId*,path:shippingZoneId*,query:altId*,query:altType*]
  PUT /store/shipping-zone/{shippingZoneId}/shipping-rate/{shippingRateId}
    params: [header:Authorization*,path:shippingRateId*,path:shippingZoneId*] -> [path:shippingRateId*,path:shippingZoneId*]
  DELETE /store/shipping-zone/{shippingZoneId}/shipping-rate/{shippingRateId}
    params: [header:Authorization*,path:shippingRateId*,path:shippingZoneId*,query:altId*,query:altType*] -> [path:shippingRateId*,path:shippingZoneId*,query:altId*,query:altType*]
  POST /store/shipping-carrier
    params: [header:Authorization*] -> []
    body schema changed
  GET /store/shipping-carrier
    params: [header:Authorization*,query:altId*,query:altType*] -> [query:altId*,query:altType*]
  GET /store/shipping-carrier/{shippingCarrierId}
    params: [header:Authorization*,path:shippingCarrierId*,query:altId*,query:altType*] -> [path:shippingCarrierId*,query:altId*,query:altType*]
  PUT /store/shipping-carrier/{shippingCarrierId}
    params: [header:Authorization*,path:shippingCarrierId*] -> [path:shippingCarrierId*]
    body schema changed
  DELETE /store/shipping-carrier/{shippingCarrierId}
    params: [header:Authorization*,path:shippingCarrierId*,query:altId*,query:altType*] -> [path:shippingCarrierId*,query:altId*,query:altType*]
  POST /store/store-setting
    params: [header:Authorization*] -> []
  GET /store/store-setting
    params: [header:Authorization*,query:altId*,query:altType*] -> [query:altId*,query:altType*]

## surveys-v3  (v3: 2 actions | v2 "surveys": 2)
CHANGED (same method+path, 2):
  GET /surveys/submissions
    version: 2021-07-28 -> v3
  GET /surveys/
    version: 2021-07-28 -> v3

## users-v3  (v3: 6 actions | v2 "users": 7)
v2-only / not in v3 (1):
  GET /users/
CHANGED (same method+path, 6):
  GET /users/search
    version: 2021-07-28 -> v3
  POST /users/search/filter-by-email
    version: 2021-07-28 -> v3
  GET /users/{userId}
    version: 2021-07-28 -> v3
  PUT /users/{userId}
    version: 2021-07-28 -> v3
    body schema changed
  DELETE /users/{userId}
    version: 2021-07-28 -> v3
  POST /users/
    version: 2021-07-28 -> v3
    body schema changed

## voice-ai-v3  (v3: 11 actions | v2 "voice-ai": 11)
CHANGED (same method+path, 11):
  POST /voice-ai/agents
    version: 2021-04-15 -> v3
  GET /voice-ai/agents
    version: 2021-04-15 -> v3
  PATCH /voice-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  GET /voice-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  DELETE /voice-ai/agents/{agentId}
    version: 2021-04-15 -> v3
  GET /voice-ai/dashboard/call-logs
    version: 2021-04-15 -> v3
  GET /voice-ai/dashboard/call-logs/{callId}
    version: 2021-04-15 -> v3
  POST /voice-ai/actions
    version: 2021-04-15 -> v3
  PUT /voice-ai/actions/{actionId}
    version: 2021-04-15 -> v3
  GET /voice-ai/actions/{actionId}
    version: 2021-04-15 -> v3
  DELETE /voice-ai/actions/{actionId}
    version: 2021-04-15 -> v3

## workflows-v3  (v3: 1 actions | v2 "workflows": 1)
CHANGED (same method+path, 1):
  GET /workflows/
    version: 2021-07-28 -> v3
