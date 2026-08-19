# OneSignal notification setup

Joylogue identifies OneSignal users with the anonymous Supabase user ID. The
client calls `OneSignal.login(user.id)`, and friend notification API routes send
to the same value through `include_aliases.external_id`.

## Required configuration

1. In OneSignal, configure Apple Push Notifications with an APNs `.p8` key,
   Key ID, Team ID, and the Joylogue bundle identifier.
2. Create an App API key under **Settings > Keys & IDs**. This is not the
   organization API key.
3. Add these variables to the EAS environment used by API routes:

   ```bash
   ONESIGNAL_APP_ID=your_app_id
   ONESIGNAL_REST_API_KEY=your_app_api_key
   ```

4. Keep `EXPO_PUBLIC_ONESIGNAL_APP_ID` in the mobile build environment. The App
   ID is public; the REST API key must never use the `EXPO_PUBLIC_` prefix.
5. Set `EXPO_PUBLIC_API_URL` in the mobile build to the EAS Hosting origin that
   contains the Expo Router API routes.
6. Test on a native development build or TestFlight build. OneSignal does not
   work in Expo Go.

## Implemented events

- `friend_request`: opens the Shared tab, where the request can be accepted or
  declined.
- `friend_request_accepted`: opens the accepting friend's detail screen.
- `onboarding_notifications_enabled`: enters onboarding recovery.
- `onboarding_completed`: exits onboarding recovery.
- `game_completed`: enters the rating reminder when the game has no rating.
- `game_rated`: exits the rating reminder.
- `game_completion_reverted`: exits the rating reminder when completion is
  undone.
- `playing_activity`: starts or resets the inactive-playing timer.
- `playing_stopped`: exits the inactive-playing reminder.

The app also records the broader onboarding and library funnel in PostHog. Only
the events listed above are mirrored to OneSignal as Custom Events.

## Journey configuration

### Finish onboarding

1. Enter on `onboarding_notifications_enabled`.
2. Wait 24 hours.
3. Exit immediately on `onboarding_completed`.
4. Send one push: `Finish building your backlog`.
5. Add notification data `notificationType=onboarding_reminder`.
6. Disable re-entry so this reminder can only be received once.

### Rate a completed game

1. Enter on `game_completed`.
2. Wait 45 minutes.
3. Exit on `game_rated` or `game_completion_reverted`.
4. Send: `How was {{ journey.first_event.properties.game_name }}?`
5. Add notification data:
   - `notificationType=rating_reminder`
   - `gameId={{ journey.first_event.properties.game_id }}`
6. Allow re-entry so separate completed games can create reminders, while
   keeping OneSignal's frequency cap conservative.

### Update an inactive game

1. Enter on `playing_activity`.
2. Also use `playing_activity` as an exit rule. OneSignal exits the current
   instance and immediately starts a fresh one, resetting the inactivity timer.
3. Exit on `playing_stopped`.
4. Wait seven days, then send:
   `Still playing {{ journey.first_event.properties.game_name }}?`
5. Add notification data:
   - `notificationType=progress_reminder`
   - `gameId={{ journey.first_event.properties.game_id }}`

Custom Events require `react-native-onesignal` 5.3.0 or newer. Joylogue uses
5.5.6. Verify incoming events in **Data > Custom Events** before activating the
Journeys.

Push delivery is best-effort. Friend mutations still succeed when OneSignal is
not configured, when the recipient declined permission, or when delivery fails.

## Test procedure

1. Install the same development/TestFlight build on two devices or use one
   physical device and one simulator that supports push.
2. Complete onboarding and grant notification permission on both clients.
3. Confirm both users appear in the OneSignal dashboard with an External ID and
   an active push subscription.
4. Send an invite from user A and accept it as user B.
5. Verify user A receives the acceptance notification and that tapping it opens
   user B's friend detail screen.
