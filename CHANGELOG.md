# Changelog

## 1.0.5 — unreleased (2026-10-29)

**The catalogue is built from GHL's live API docs**, not the GitHub docs repo, which stopped moving in June.

- **Rebuild 2026-11-06 (delta on the 2026-10-29 build; no version bump, nothing published).** 1,614 actions (was 1,603).
  - **Added, 11:** Wallet v3 (9: balance, transactions, billing and usage summaries, usage records, complimentary
    credits) and Count Contacts in both trees (`contacts-v3__count-contacts`, `contacts__count-contacts`).
  - **Deprecated by GHL, 4:** the Saas v3 wallet operations that get or update a location's wallet balance and
    list location or agency wallet transactions. `describe_action` shows GHL's replacement note.
  - **Scope added, 4:** the create-association and add-remove-contact-from-business operations (both trees) now list
    `contacts.write`.
  - **Text and metadata updated, 70:** GHL changed descriptions, summaries, parameter or request-body metadata on
    these operations. No operation was removed.
  - **Checked, not in the catalogue: `companyName` on `PUT /contacts/{contactId}`.** The 2026-11-03 GHL changelog calls
    it a new request property. The live spec does not: `companyName` appears once, in the 200 response
    (`UpdateContactsSuccessfulResponseDtoV3`, `contact`), and the PUT request body has no such field. The catalogue
    stores request bodies, parameters and scopes only, so no entry changes. The `POST /contacts/search` response media
    type addition is response-side for the same reason. The build's cached copy matches the live page, so the source
    does not lag. Whether the catalogue should model response fields is open (bl-781).

- **Coverage.** Every operation in the live v3 docs (812) and the dated 2021-07-28 tree (740), as twins: 1,603 actions,
  396 new. New coverage includes Courses, Projects, Client Portal AI, Affiliates, Workflows, countdown timers,
  brand-board design kits, Conversation AI working hours and managed agents. Every previous action id still works.
- **Nothing removed.** 33 actions GHL no longer documents stay in the catalogue. They are listed in
  `data/undocumented.json` and noted in `describe_action`. Query parameters GHL stopped documenting on
  existing actions (37) are kept as optional and noted.
- **Version headers fixed.** 30 operations (store, marketplace, funnels, conversations, phone-system) sent no `Version`
  header and failed with 401 on every call. They now send `v3`, checked live.
- **GHL's own marks reach the agent.** `describe_action` shows `deprecated` (with the replacement GHL names) and notes
  such as "private beta" (the Workflows API is allow-listed by GHL). Search prefers a twin that isn't deprecated.
- **Fixes.**
  - 11 operations whose path placeholders GHL never declared can be called now.
  - Path parameters GHL renamed still accept their old names.
- **Proven rules survive a rebuild.** The pipeline rules are applied on top of GHL's docs:
  - stage `position` is required;
  - give every stage a probability;
  - on update, `locationId` goes in the query.
- **Confirmation gates.** Payouts and commissions, managed-agent execution, client-portal app apply and builds,
  location permission changes, and liking social comments now ask for confirmation.
- **Rate limits as GHL documents them.**
  - Each sub-account gets its own budget from GHL's `X-RateLimit-*` headers: 100 requests per 10 s, plus the daily
    quota. This replaces a flat 60 per minute shared by every account.
  - A rate-limited call waits once and retries once, and only when GHL's gateway sent the 429 or GHL says it is
    retryable.
  - A spent daily quota is reported with its reset time.
- **Instructions** state the current operation count instead of a typed one.
