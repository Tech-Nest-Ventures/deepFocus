# Multiple accounts, one calendar view

Deep Focus reads the calendars configured in Apple Calendar on each device through EventKit. You can select calendars from several Google accounts and see their events together, with account and calendar labels. Nothing is selected initially. Choosing no calendars reads no events.

You can continue using Notion Calendar: connect the **same underlying Google accounts** in Notion Calendar and Apple Calendar. Notion supports multiple calendar accounts; this integration does not read the Notion Calendar application's private data or Notion database items. [Notion account setup](https://www.notion.com/help/create-a-notion-calendar-account), [Google calendars in Apple Calendar](https://support.google.com/calendar/answer/99358?co=GENIE.Platform%3DDesktop&hl=en).

## Set up each device

1. On Mac, open Apple Calendar → Add Account and add each Google account you want available. Enable Calendars for each account. Shared or subscribed calendars must appear in Apple Calendar before Deep Focus can select them. If needed, check the account provider's calendar settings. [Apple's account instructions](https://support.apple.com/en-gb/guide/calendar/icl4308d6701/mac).
2. On iPhone, add the same accounts under Settings → Apps → Calendar → Calendar Accounts (on older iOS versions: Settings → Calendar → Accounts), and enable Calendars. Follow Google's instructions for your iOS version. [Google's iPhone instructions](https://support.google.com/calendar/answer/99358?co=GENIE.Platform%3DiOS&hl=en).
3. In Deep Focus, choose **Connect calendars** and allow full Calendar access. EventKit requires read access to show and compare your plans; write-only access is insufficient. Deep Focus requests permission only from this button. [Apple EventKit authorization](https://developer.apple.com/documentation/eventkit/accessing-the-event-store).
4. Select individual calendars across your accounts. Accounts with similar names can be given a local alias; an alias does not rename the Google account. Selection and aliases are local to each device.
5. Use Refresh after changing an account or event if the update is not visible yet. The app also refreshes on its configured foreground/store-change paths. Disconnect removes this device's connected-calendar evidence from Deep Focus; it does not delete your provider events.

The OS may authorize access to the entire calendar store, but Deep Focus queries events only from your selected calendars. Google authentication stays in the system account setup. No credentials are entered into or stored by Deep Focus. Account sync depends on Apple Calendar and the calendar provider, so updates are not guaranteed to be immediate.

## Plans and confirmed activities are separate

The combined agenda is a view of intentions. Simultaneous events remain separate records, even when they share a name. Calendar events do not create tracked human hours or confirm that an activity happened. All-day events retain their dates and time zone; they are not offered as timed gap suggestions.

A successful refresh replaces only this device's connected-calendar evidence for the queried date range. Deleted events disappear, deselected calendars are removed, and manual calendar imports and other-device evidence remain separate. Closing access clears cached connected intentions. Recurring occurrences use their own identity; titles are never keys.

Manual activity entries support multiple activities over one elapsed interval—for example, Walking + Communication. The activity totals can overlap; elapsed time is counted once.

## Optional publication to Notion Calendar through Google

Create a separate **Deep Focus — Actuals** calendar in the desired Google account and make it visible in Apple Calendar and Notion Calendar. If Apple Calendar cannot create a calendar for the account, create it in Google Calendar. [Apple's calendar creation instructions](https://support.apple.com/en-euro/guide/calendar/icl1005/mac).

In Deep Focus, review the confirmed activities, select the writable Actuals calendar, and explicitly publish the preview. The preview shows event titles and intervals rounded to whole seconds (without changing your local ledger). This sends those selected activity names and times to the calendar provider; everyone with access to that destination calendar may be able to see them. No observed app names, browser URLs, location coordinates, attendees, or routes are included. Unknown and unconfirmed periods are not published.

Each published interval has an app ownership marker. Repeating publication checks existing owned records and device-local identifier receipts; changed or deleted published entries are rejected, not overwritten. Use one publishing device until cross-device publication reconciliation exists. Reinstalling or removing local settings loses those receipts, so review existing output before publishing again. Ordinary planned events are never updated. Actuals calendars and recognized Deep Focus output records are excluded from intention suggestions so completed activity does not turn into a new plan.

Publication is user initiated, not continuous two-way synchronization. It does not automatically delete previously published events when you edit or delete a local activity. Overlapping previously published intervals cause a conflict rather than creating double-counted copies. Reconcile changes in the Actuals calendar manually; this increment does not offer a replacement/delete flow. Google-provider events can appear in Notion Calendar because both clients use the same account. Notion database items require a separate integration and are not included here.

## What still needs live verification

Policy tests and adapter probes use synthetic calendars, not personal accounts. Real Calendar permission, multiple Google account synchronization, shared/read-only calendar visibility, recurrence editing, iPhone behavior, and publication appearing in Notion Calendar require a live device/account check. A simulator build alone does not prove these integrations.

This calendar connection does **not** add automatic phone–Mac transfer of Deep Focus's activity tags or location evidence. That remains the existing explicit file exchange. Connecting the same Google accounts gives both apps the same provider calendars, not a shared Deep Focus database.
