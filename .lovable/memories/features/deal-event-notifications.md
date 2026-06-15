---
name: Deal event notifications
description: Browser Notification + toast + chime on deal state transitions
type: feature
---
- `useDealEventNotifications(deals, address)` diffs prior snapshots of LiveDeal by dealId.
- Mounted globally via `DealNotificationsHost` in App.tsx.
- Fires on: new deal (ad accepted), buyer marked paid (status 1), released (2), refunded (3), disputed (4), resolved (5).
- Uses existing NotificationPermission prompt; degrades to toast when permission denied.
- Native FCM push (Android) NOT implemented — would require Firebase project setup, google-services.json, and @capacitor/push-notifications plugin install by the user.
