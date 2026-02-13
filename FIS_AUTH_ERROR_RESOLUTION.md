# FIS_AUTH_ERROR Resolution Summary

This document summarizes the troubleshooting journey for resolving the `FIS_AUTH_ERROR` push notification issue.

## Problem Statement

**Error:** `java.io.IOException: FIS_AUTH_ERROR`
**Full Error:** `Firebase Installations Service is unavailable. Please try again later.`

Push token generation was failing after 3+ hours of troubleshooting.

---

## Root Cause (What We Found)

**Primary Issue: DNS/Network Blocking of Firebase Domains**

The device/network was resolving `firebaseinstallations.googleapis.com` to `127.0.0.1` (localhost) instead of Google's actual servers, causing all Firebase Installations API calls to fail.

**Diagnosis Command:**
```bash
adb shell "ping -c 2 firebaseinstallations.googleapis.com"
```

**Problem (before fix):**
```
PING firebaseinstallations.googleapis.com (127.0.0.1)  ← Resolving to localhost
64 bytes from localhost (127.0.0.1)
```

**Fixed (after fix):**
```
PING firebaseinstallations.googleapis.com (142.251.220.202)  ← Real Google IP
64 bytes from mnl07s03-in-f10.1e100.net (142.251.220.202)
```

---

## Contributing Factors (Red Herrings)

### 1. ✅ App Check (Initially Suspected)
- **Status:** App had Play Integrity enabled, which was suspected of blocking Firebase
- **Action Taken:** Generated debug token, but ultimately unregistered app from App Check
- **Outcome:** Was NOT the root cause (DNS blocking was the real issue)

### 2. ✅ Firebase APIs (Correctly Enabled)
- Firebase Installations API: **Enabled** ✓
- Firebase Cloud Messaging API: **Enabled** ✓
- These were already enabled, so not the issue

### 3. ✅ SHA Fingerprints (Correctly Configured)
- SHA-1: `9c:b5:ab:b4:96:06:15:c1:dd:5b:ba:93:ea:cf:18:47:da:ad:e9:b7`
- SHA-256: `2b:97:69:f0:75:07:3c:e2:3e:21:ee:4d:90:4a:93:6d:c3:f5:1a:26:74:16:aa:fd:f6:55:26:46:cd:0e:ab:ef`
- Correctly configured in Firebase Console for EAS builds

---

## Solution Applied

### Fix: Disabled DNS Blocking

**Most likely cause:** Private DNS setting with ad-blocking DNS server or VPN

**Actions that resolved the issue:**
1. Disabled Private DNS (Settings → Private DNS → Off)
2. OR changed DNS to Google DNS (8.8.8.8 / 8.8.4.4)
3. OR disabled VPN/ad blocker app

**Result:** Firebase domains now resolve correctly to Google's servers

---

## Verification Steps

### 1. Verify DNS Resolution
```bash
adb shell "ping -c 2 firebaseinstallations.googleapis.com"
```
Should show Google IP (142.251.x.x), not 127.0.0.1

### 2. Check Firebase Files on Device
```bash
adb shell "run-as com.anonymous.aimeetingtemp ls -la files" | grep PersistedInstallation
```
Should show `PersistedInstallation.*.json` file

### 3. Check Push Token Registration
```bash
adb logcat -d | grep -i "push token registered"
```
Should show: `'Push token registered:', 'ExponentPushToken[...]'`

---

## Final Working Configuration

✅ **DNS:** Firebase domains resolve to Google IPs (not localhost)
✅ **Firebase APIs:** Installations API + FCM API enabled
✅ **App Check:** Unregistered/disabled for development builds
✅ **SHA Fingerprints:** EAS build fingerprints added to Firebase Console
✅ **google-services.json:** Present in `android/app/` and processed by build
✅ **Google Services Plugin:** Applied in `android/app/build.gradle`

**Result:**
```javascript
'Push token registered:', 'ExponentPushToken[tuiqpBHY17-yJjvy8Ok6pz]'
Push token saved to database
```

---

## Common FIS_AUTH_ERROR Causes (Ranked by Likelihood)

### 1. 🔥 DNS/Network Blocking (MOST COMMON - This was our issue)
- Private DNS with ad blocker
- VPN or proxy redirecting Firebase domains
- Corporate network filtering
- **Fix:** Disable Private DNS or use Google DNS (8.8.8.8)

### 2. ⚠️ Firebase Installations API Not Enabled
- API not enabled in Google Cloud Console
- **Fix:** Enable at console.cloud.google.com/apis/library

### 3. ⚠️ App Check Blocking Development Builds
- Play Integrity enabled for app in Firebase App Check
- **Fix:** Unregister app from App Check, or use debug token

### 4. ⚠️ SHA Fingerprint Mismatch
- Fingerprints don't match signing key
- **Fix:** Get fingerprints from EAS credentials, add to Firebase Console

### 5. ⚠️ google-services.json Missing or Incorrect
- File not in `android/app/` directory
- Package name mismatch
- **Fix:** Download correct file from Firebase Console

---

## Diagnostic Tool

Created: `check-firebase-setup.sh` - Automated diagnostic script

**Usage:**
```bash
chmod +x check-firebase-setup.sh
./check-firebase-setup.sh
```

**Checks:**
- google-services.json files exist
- Package name matches
- Google Services plugin applied
- Device connection
- Firebase PersistedInstallation file
- SHA fingerprints configured

---

## Timeline

- **Started:** FIS_AUTH_ERROR after 3 hours of troubleshooting
- **Investigated:** Firebase APIs, App Check, SHA fingerprints
- **Discovered:** DNS blocking (ping showed 127.0.0.1)
- **Fixed:** Disabled Private DNS / Changed DNS settings
- **Verified:** Push tokens now working
- **Total time:** ~3.5 hours

---

## Key Takeaways

1. **Always check DNS first** - `ping firebaseinstallations.googleapis.com` should NOT resolve to 127.0.0.1
2. **Private DNS with ad blockers blocks Firebase** - Disable for development
3. **App Check blocks debug builds** - Unregister or use debug tokens
4. **Firebase APIs must be enabled** - Don't assume they're enabled by default
5. **Test on mobile data** - Bypasses network restrictions for quick testing

---

## References

- [Firebase Console](https://console.firebase.google.com/project/ai-meeting-assistant-db2b0)
- [Google Cloud Console APIs](https://console.cloud.google.com/apis/library?project=ai-meeting-assistant-db2b0)
- [Firebase App Check](https://console.firebase.google.com/project/ai-meeting-assistant-db2b0/appcheck)
- [EAS Credentials](https://expo.dev/accounts/[account]/projects/ai-meeting-assistant/credentials/android)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

---

**Status:** ✅ **RESOLVED**
**Date:** 2026-02-13
**Push Token:** `ExponentPushToken[tuiqpBHY17-yJjvy8Ok6pz]`
