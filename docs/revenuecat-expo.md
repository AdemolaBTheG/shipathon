# RevenueCat Expo Setup

This app now includes a native RevenueCat integration for `Joylogue Pro` using:

- `react-native-purchases`
- `react-native-purchases-ui`
- RevenueCat Paywalls
- RevenueCat Customer Center

## 1. Install SDKs with `npx`

Use the Expo-aware install command:

```bash
npx expo install react-native-purchases react-native-purchases-ui
```

This was run in the project so the native modules match Expo SDK 57.

## 2. Configure API keys

RevenueCat requires platform-specific public SDK keys for React Native production apps.

As of Sunday, August 9, 2026, RevenueCat’s docs say:

- React Native should use separate iOS and Android public SDK keys in production
- Test Store keys are valid for development and testing only
- Test Store keys must not ship to the App Store or Google Play

The app now reads these build-time variables in `app.config.ts`:

```bash
REVENUECAT_API_KEY=
REVENUECAT_IOS_API_KEY=
REVENUECAT_ANDROID_API_KEY=
```

Current fallback for development:

```text
test_KplaxJwWoInFuOAssDllswxcqDE
```

Recommended:

- Use `REVENUECAT_API_KEY` only for local Test Store development
- Use `REVENUECAT_IOS_API_KEY` and `REVENUECAT_ANDROID_API_KEY` for release builds

## 3. RevenueCat dashboard setup

Create the following RevenueCat objects:

### Entitlement

- Entitlement ID: `savepoint_pro`

### Packages inside your current offering

- Monthly package identifier: `monthly`
- Yearly package identifier: `yearly`
- Lifetime package identifier: `lifetime`

### Products

Create store products in App Store Connect / Google Play, then attach them in RevenueCat.

Recommended mapping:

- Product: Joylogue Monthly
  - RevenueCat package: `monthly`
- Product: Joylogue Yearly
  - RevenueCat package: `yearly`
- Product: Joylogue Lifetime
  - RevenueCat package: `lifetime`

Attach all three products to the `savepoint_pro` entitlement.

### Offering

Create one current offering and attach:

- `monthly`
- `yearly`
- `lifetime`

The app reads `offerings.current`.

## 4. Paywall

Create a RevenueCat Paywall for the current offering in the RevenueCat dashboard.

The app presents it with:

```ts
await RevenueCatUI.presentPaywallIfNeeded({
  requiredEntitlementIdentifier: "savepoint_pro",
  offering,
  displayCloseButton: true,
});
```

Use Paywalls for:

- remote copy and pricing updates
- experiments
- without app releases

## 5. Customer Center

Customer Center is enabled from the Shared tab subscription card.

It is appropriate here because Joylogue already has a settings/account-like surface and Customer Center gives users:

- restore purchases
- manage plans
- request refunds where supported
- manage subscriptions without support tickets

## 6. Customer identity

The provider:

1. Configures RevenueCat immediately
2. Fetches `CustomerInfo`
3. Attempts to identify the customer with the app’s Supabase-backed anonymous user ID
4. Falls back to anonymous RevenueCat identity if cloud identity is unavailable

This is a practical compromise:

- app startup is not blocked
- RevenueCat still works offline/early
- stable user IDs are used when available

## 7. Runtime APIs used

The integration is built around:

```ts
Purchases.configure(...)
Purchases.getCustomerInfo()
Purchases.getOfferings()
Purchases.purchasePackage(...)
Purchases.restorePurchases()
Purchases.addCustomerInfoUpdateListener(...)
RevenueCatUI.presentPaywallIfNeeded(...)
RevenueCatUI.presentCustomerCenter(...)
```

## 8. What the UI does

The Shared tab now includes a `Joylogue Pro` card that:

- checks the `savepoint_pro` entitlement
- lists current offering packages
- presents the RevenueCat paywall
- restores purchases
- opens Customer Center
- opens the store management URL when RevenueCat provides one
- supports a direct package purchase path for the preferred package

## 9. Testing

RevenueCat native modules require a development build, not Expo Go.

Recommended test flow:

```bash
npx expo start
```

Then use a native/dev build for iOS or Android.

For RevenueCat Test Store:

1. Keep the `test_...` key active locally
2. Configure products, entitlement, and current offering in the Test Store
3. Make simulated purchases
4. Confirm `savepoint_pro` appears in `customerInfo.entitlements.active`

## 10. Release checklist

Before shipping:

1. Replace the test key with platform-specific RevenueCat public SDK keys
2. Verify the current offering is configured for both stores
3. Verify the `savepoint_pro` entitlement is attached to all purchase options
4. Confirm Customer Center is configured in RevenueCat
5. Test purchase, restore, cancellation flow, and management URL on device
