# 🔔 Firebase Cloud Messaging (FCM) — Frontend Integration Guide

> **Project:** Hasibha — Intelligent Personal Budgeting App  
> **Backend Base URL:** `http://localhost:5001` (production URL TBD)  
> **Firebase Project ID:** `hasibha-notificatio`  
> **Prepared by:** Backend Team  
> **Last updated:** May 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Firebase Project Setup](#2-firebase-project-setup)
3. [Flutter Integration (Recommended)](#3-flutter-integration-recommended)
4. [React Native Integration](#4-react-native-integration)
5. [Backend API Reference](#5-backend-api-reference)
6. [Notification Types & Payloads](#6-notification-types--payloads)
7. [Full Integration Flow](#7-full-integration-flow)
8. [Testing](#8-testing)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The backend uses **Firebase Admin SDK** to send push notifications to users' devices.  
Your responsibility as the frontend developer is:

1. Add the `google-services.json` / `GoogleService-Info.plist` to the app
2. Request notification permissions from the user
3. Obtain the **FCM token** for the device
4. Send that token to the backend via `POST /api/notifications/register-token`
5. Handle incoming notifications (foreground + background)
6. Unregister the token on logout

The backend handles **everything else** — storing tokens, sending pushes, cleaning up expired tokens automatically.

---

## 2. Firebase Project Setup

### Step 1 — Add Your App to the Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open project: **`hasibha-ai`**
3. Click **"Add app"** → choose Android or iOS
4. Register your app with its package name / bundle ID

### Step 2 — Download Config Files

| Platform | File | Location in project |
|---|---|---|
| Android | `google-services.json` | `android/app/google-services.json` |
| iOS | `GoogleService-Info.plist` | `ios/Runner/GoogleService-Info.plist` |

> ⚠️ **Never commit these files to a public repository.**  
> Add them to `.gitignore`.

---

## 3. Flutter Integration (Recommended)

### 3.1 — Install Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  firebase_core: ^3.x.x
  firebase_messaging: ^15.x.x
  flutter_local_notifications: ^17.x.x   # for custom foreground banners
```

Then run:

```bash
flutter pub get
```

### 3.2 — Android Setup

In `android/build.gradle`:
```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
}
```

In `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3.3 — iOS Setup

In `ios/Runner/AppDelegate.swift`:
```swift
import UIKit
import Flutter
import Firebase

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FirebaseApp.configure()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

Enable **Push Notifications** and **Background Modes → Remote notifications** in Xcode Signing & Capabilities.

### 3.4 — Initialize Firebase & FCM

Create a `services/notification_service.dart` file:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

// Background message handler — MUST be a top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('[FCM Background] ${message.notification?.title}: ${message.notification?.body}');
  // TODO: update local state / badge count if needed
}

class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const String _backendBaseUrl = 'http://localhost:5001'; // Change for production

  /// Call this once in main() before runApp()
  static Future<void> init() async {
    await Firebase.initializeApp();

    // Register background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Request permissions (iOS + Android 13+)
    await _requestPermissions();

    // Set up local notifications for foreground display
    await _initLocalNotifications();

    // Listen for foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Listen for notification taps when app is in background (not terminated)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app was launched from a notification tap (terminated state)
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  // ────────────────────────────────────────────────────────
  //  Register token with the Hasibha backend
  // ────────────────────────────────────────────────────────

  /// Call this after the user logs in successfully.
  static Future<void> registerTokenWithBackend(String accessToken) async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;

      print('[FCM] Device token: $token');

      final response = await http.post(
        Uri.parse('$_backendBaseUrl/api/notifications/register-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
        body: jsonEncode({
          'fcmToken': token,
          'deviceType': _getDeviceType(),   // 'android' | 'ios'
          'deviceName': 'My Device',        // optionally use device_info_plus
        }),
      );

      if (response.statusCode == 200) {
        print('[FCM] Token registered successfully with backend');
      } else {
        print('[FCM] Token registration failed: ${response.body}');
      }

      // Listen for token refreshes automatically
      _messaging.onTokenRefresh.listen((newToken) {
        registerTokenWithBackend(accessToken);
      });
    } catch (e) {
      print('[FCM] Error registering token: $e');
    }
  }

  /// Call this when the user logs out.
  static Future<void> unregisterTokenFromBackend(String accessToken) async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;

      await http.delete(
        Uri.parse('$_backendBaseUrl/api/notifications/unregister-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
        body: jsonEncode({'fcmToken': token}),
      );

      print('[FCM] Token unregistered from backend');
    } catch (e) {
      print('[FCM] Error unregistering token: $e');
    }
  }

  // ────────────────────────────────────────────────────────
  //  Message Handlers
  // ────────────────────────────────────────────────────────

  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    print('[FCM Foreground] ${message.notification?.title}');
    final notification = message.notification;
    if (notification == null) return;

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'hasibha_channel',
          'Hasibha Notifications',
          channelDescription: 'Budget & savings alerts from Hasibha',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  static void _handleNotificationTap(RemoteMessage message) {
    final type = message.data['type'] ?? '';
    print('[FCM Tap] type=$type data=${message.data}');

    // Navigate based on notification type
    switch (type) {
      case 'budget_alert':
      case 'budget_exceeded':
        // TODO: Navigate to Budgets screen
        // NavigationService.navigateTo('/budgets');
        break;
      case 'goal_completed':
      case 'goal_milestone':
        // TODO: Navigate to Savings Goals screen
        // NavigationService.navigateTo('/savings');
        break;
      case 'large_expense':
        // TODO: Navigate to Transactions screen
        // NavigationService.navigateTo('/transactions');
        break;
      default:
        // TODO: Navigate to Home/Dashboard
        break;
    }
  }

  // ────────────────────────────────────────────────────────
  //  Helpers
  // ────────────────────────────────────────────────────────

  static Future<void> _requestPermissions() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    print('[FCM] Permission status: ${settings.authorizationStatus}');
  }

  static Future<void> _initLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    const settings = InitializationSettings(android: android, iOS: ios);
    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (details) {
        // Handle tap on local notification
      },
    );
  }

  static String _getDeviceType() {
    // Use device_info_plus for accurate detection if needed
    return 'android'; // or 'ios'
  }
}
```

### 3.5 — Wire it up in `main.dart`

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.init();
  runApp(const MyApp());
}
```

### 3.6 — After Login

```dart
// In your AuthController / login function, after receiving accessToken:
await NotificationService.registerTokenWithBackend(accessToken);
```

### 3.7 — On Logout

```dart
// Before clearing the session:
await NotificationService.unregisterTokenFromBackend(accessToken);
// Then clear tokens / navigate to login
```

---

## 4. React Native Integration

### 4.1 — Install Dependencies

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
# or
yarn add @react-native-firebase/app @react-native-firebase/messaging
```

### 4.2 — Android Setup

Place `google-services.json` in `android/app/`.

In `android/build.gradle`:
```gradle
classpath 'com.google.gms:google-services:4.4.0'
```

In `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 4.3 — iOS Setup

Place `GoogleService-Info.plist` in `ios/<AppName>/`.

```bash
cd ios && pod install
```

### 4.4 — Usage

```javascript
import messaging from '@react-native-firebase/messaging';

// Request permissions (iOS)
async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

// Register token with backend
async function registerToken(accessToken) {
  const token = await messaging().getToken();
  
  await fetch('http://localhost:5001/api/notifications/register-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      fcmToken: token,
      deviceType: Platform.OS, // 'android' or 'ios'
      deviceName: 'My Device',
    }),
  });
}

// Unregister on logout
async function unregisterToken(accessToken) {
  const token = await messaging().getToken();
  await fetch('http://localhost:5001/api/notifications/unregister-token', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fcmToken: token }),
  });
}

// Background handler (outside component)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message:', remoteMessage);
});

// Foreground handler (inside component/hook)
useEffect(() => {
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('Foreground message:', remoteMessage);
    // Show in-app toast or local notification
  });
  return unsubscribe;
}, []);
```

---

## 5. Backend API Reference

> **Base URL:** `http://localhost:5001`  
> All routes require `Authorization: Bearer <accessToken>` header.

### 5.1 — Register Device Token

**`POST /api/notifications/register-token`**

Call this **after every login** (or whenever the FCM token refreshes).

**Request Body:**
```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_here...",
  "deviceType": "android",
  "deviceName": "Samsung Galaxy S23"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `fcmToken` | `string` | ✅ Yes | FCM registration token from Firebase SDK |
| `deviceType` | `string` | No | `android` / `ios` / `web` / `unknown` |
| `deviceName` | `string` | No | Human-readable device name |

**Success Response `200`:**
```json
{
  "message": "Device token registered successfully",
  "deviceId": "664a1f..."
}
```

---

### 5.2 — Unregister Device Token

**`DELETE /api/notifications/unregister-token`**

Call this **before logout** to stop notifications on this device.

**Request Body:**
```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_here..."
}
```

**Success Response `200`:**
```json
{
  "message": "Device token unregistered successfully"
}
```

---

### 5.3 — List Registered Devices

**`GET /api/notifications/devices`**

Returns all devices registered for the current user.

**Success Response `200`:**
```json
{
  "devices": [
    {
      "_id": "664a1f...",
      "userId": "663b2a...",
      "fcmToken": "eXAMPle...",
      "deviceType": "android",
      "deviceName": "Samsung Galaxy S23",
      "active": true,
      "lastSeen": "2026-05-02T00:00:00.000Z"
    }
  ]
}
```

---

### 5.4 — Send a Test Notification to Yourself

**`POST /api/notifications/test`**

No body required. Sends a test push to all your registered devices.

**Success Response `200`:**
```json
{
  "message": "Test notification sent",
  "sent": 1,
  "failed": 0
}
```

---

### 5.5 — Send Custom Notification (Admin/Debug)

**`POST /api/notifications/send`**

**Request Body:**
```json
{
  "title": "Hello!",
  "body": "This is a custom notification.",
  "data": {
    "screen": "dashboard"
  }
}
```

---

## 6. Notification Types & Payloads

The backend sends these notification types automatically. Handle them in your `onMessageOpenedApp` / tap handler to navigate correctly.

### 6.1 — Budget Alert ⚠️

Triggered when spending reaches the budget's alert threshold (default 80%).

```json
{
  "notification": {
    "title": "⚠️ Budget Alert",
    "body": "You've used 83% of your \"Food\" budget (Food)."
  },
  "data": {
    "type": "budget_alert",
    "category": "Food",
    "percent": "83"
  }
}
```
➡️ **Navigate to:** Budgets screen

---

### 6.2 — Budget Exceeded 🚨

Triggered when spending goes over 100% of the budget limit.

```json
{
  "notification": {
    "title": "🚨 Budget Exceeded!",
    "body": "Your \"Food\" budget for Food has been exceeded!"
  },
  "data": {
    "type": "budget_exceeded",
    "category": "Food"
  }
}
```
➡️ **Navigate to:** Budgets screen

---

### 6.3 — Large Expense 💸

Triggered when an expense ≥ 500 EGP is recorded.

```json
{
  "notification": {
    "title": "💸 Large Expense Recorded",
    "body": "A EGP 750.00 expense was added in \"Electronics\"."
  },
  "data": {
    "type": "large_expense",
    "amount": "750.0",
    "currency": "EGP",
    "category": "Electronics"
  }
}
```
➡️ **Navigate to:** Transactions screen

---

### 6.4 — Savings Milestone 💰

Triggered at 25%, 50%, or 75% of a savings goal.

```json
{
  "notification": {
    "title": "💰 Savings Milestone!",
    "body": "You're 50% of the way to your \"New Phone\" goal. Keep it up!"
  },
  "data": {
    "type": "goal_milestone",
    "goalName": "New Phone",
    "percent": "50"
  }
}
```
➡️ **Navigate to:** Savings Goals screen

---

### 6.5 — Savings Goal Completed 🎉

Triggered when `savedAmount >= targetAmount`.

```json
{
  "notification": {
    "title": "🎉 Savings Goal Reached!",
    "body": "Congratulations! You've completed your savings goal: \"New Phone\"."
  },
  "data": {
    "type": "goal_completed",
    "goalName": "New Phone"
  }
}
```
➡️ **Navigate to:** Savings Goals screen

---

## 7. Full Integration Flow

```
App Launch
    │
    ▼
NotificationService.init()
    │  ├─ Firebase.initializeApp()
    │  ├─ requestPermission()
    │  └─ register background/foreground handlers
    │
    ▼
User Logs In  ──► API: POST /api/auth/login  ──► receives { accessToken }
    │
    ▼
NotificationService.registerTokenWithBackend(accessToken)
    │  ├─ getToken() from Firebase SDK
    │  └─ POST /api/notifications/register-token  { fcmToken, deviceType }
    │
    ▼
App Running Normally
    │  ├─ Backend fires budget alerts automatically on transactions
    │  ├─ Backend fires savings milestones automatically on contributions
    │  └─ FCM delivers pushes to device
    │
    ▼
User Logs Out
    │
    ▼
NotificationService.unregisterTokenFromBackend(accessToken)
    │  └─ DELETE /api/notifications/unregister-token  { fcmToken }
    │
    ▼
Clear session & navigate to Login
```

---

## 8. Testing

### Step 1 — Register Your Device

1. Log in to the app
2. Verify the app calls `POST /api/notifications/register-token` — check the backend console for:
   ```
   ✅ [FCM] Token registered for user <userId> (android)
   ```

### Step 2 — Send a Test Notification

Use Thunder Client / Postman:

```
POST http://localhost:5001/api/notifications/test
Authorization: Bearer <your_access_token>
```

You should receive a push on your device within seconds.

### Step 3 — Trigger Automatic Notifications

| Test | How to trigger |
|---|---|
| Budget alert | Create an expense in a category that has an active budget, pushing it past 80% |
| Budget exceeded | Push spending over 100% of a budget |
| Large expense | Create any expense with `amount >= 500` |
| Savings milestone | Contribute to a savings goal until it hits 25/50/75% |
| Goal completed | Contribute until `savedAmount >= targetAmount` |

### Step 4 — Verify Token Cleanup on Logout

After logout, call `GET /api/notifications/devices` — the token should show `"active": false`.

---

## 9. Troubleshooting

| Problem | Solution |
|---|---|
| Token not received from Firebase | Ensure `google-services.json` / `GoogleService-Info.plist` is correctly placed and the app is registered in Firebase Console |
| Push not delivered | Check that `registerToken` was called after login and returned `200` |
| iOS permission denied | Make sure Push Notifications capability is enabled in Xcode and the user accepted the permission dialog |
| Notifications not showing in foreground | Implement `flutter_local_notifications` — FCM does not auto-display in foreground on Flutter |
| `401 Unauthorized` from backend | Access token is expired or missing — re-login and use the fresh token |
| Backend logs `No active devices for user` | The token was never registered, or was deactivated by logout |
| Token expired / invalid | Firebase automatically refreshes tokens — listen to `onTokenRefresh` and re-register |

---

## Need Help?

Contact the backend team and provide:
1. The FCM token your device is generating
2. The `userId` from your login response
3. The exact API response you're seeing

The backend team can check token status directly in the database and Firebase console.
