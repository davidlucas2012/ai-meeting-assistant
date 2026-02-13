#!/bin/bash

echo "🔍 Firebase Push Notification Diagnostic Tool"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: google-services.json exists
echo "📋 Check 1: google-services.json files"
if [ -f "google-services.json" ]; then
    echo -e "${GREEN}✓${NC} Root google-services.json exists"
else
    echo -e "${RED}✗${NC} Missing root google-services.json"
fi

if [ -f "android/app/google-services.json" ]; then
    echo -e "${GREEN}✓${NC} android/app/google-services.json exists"
else
    echo -e "${RED}✗${NC} Missing android/app/google-services.json"
fi
echo ""

# Check 2: Verify package name matches
echo "📦 Check 2: Package name verification"
PACKAGE_NAME=$(grep '"package_name"' google-services.json 2>/dev/null | head -1 | sed 's/.*"package_name": "\(.*\)".*/\1/')
APP_JSON_PACKAGE=$(grep '"package"' app.json | sed 's/.*"package": "\(.*\)".*/\1/')
echo "  google-services.json: $PACKAGE_NAME"
echo "  app.json: $APP_JSON_PACKAGE"
if [ "$PACKAGE_NAME" = "$APP_JSON_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} Package names match"
else
    echo -e "${RED}✗${NC} Package name mismatch!"
fi
echo ""

# Check 3: Google Services plugin
echo "🔌 Check 3: Google Services plugin"
if grep -q "com.google.gms.google-services" android/build.gradle 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Google Services classpath found in android/build.gradle"
else
    echo -e "${RED}✗${NC} Missing Google Services classpath in android/build.gradle"
fi

if grep -q "apply plugin: 'com.google.gms.google-services'" android/app/build.gradle 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Google Services plugin applied in android/app/build.gradle"
else
    echo -e "${RED}✗${NC} Missing Google Services plugin in android/app/build.gradle"
fi
echo ""

# Check 4: Device connection
echo "📱 Check 4: Device connection"
if adb devices | grep -q "device$"; then
    echo -e "${GREEN}✓${NC} Android device connected"
    DEVICE_ID=$(adb devices | grep "device$" | head -1 | awk '{print $1}')
    echo "  Device: $DEVICE_ID"
else
    echo -e "${YELLOW}⚠${NC} No Android device connected"
fi
echo ""

# Check 5: App installed
echo "📲 Check 5: App installation"
if adb shell pm list packages | grep -q "com.anonymous.aimeetingtemp"; then
    echo -e "${GREEN}✓${NC} App is installed on device"

    # Check for Firebase files
    echo ""
    echo "🔥 Check 6: Firebase files on device"
    if adb shell "run-as com.anonymous.aimeetingtemp ls -la files 2>/dev/null" | grep -q "PersistedInstallation"; then
        echo -e "${GREEN}✓${NC} Firebase PersistedInstallation file exists"
        echo "  This means Firebase IS configured in the app"
    else
        echo -e "${RED}✗${NC} No Firebase PersistedInstallation file found"
        echo "  This means Firebase is NOT properly initialized"
    fi
else
    echo -e "${YELLOW}⚠${NC} App not installed on device"
fi
echo ""

# Check 7: Extract SHA fingerprints from google-services.json
echo "🔑 Check 7: SHA Fingerprints in Firebase Console"
echo "  The following fingerprints should be in Firebase Console:"
echo "  (Firebase Console → Project Settings → Your apps → SHA certificate fingerprints)"
echo ""
echo "  From the screenshot you provided, you have:"
echo -e "  ${GREEN}SHA-1:${NC}   9c:b5:ab:b4:96:06:15:c1:dd:5b:ba:93:ea:cf:18:47:da:ad:e9:b7"
echo -e "  ${GREEN}SHA-256:${NC} 2b:97:69:f0:75:07:3c:e2:3e:21:ee:4d:90:4a:93:6d:c3:f5:1a:26:74:16:aa:fd:f6:55:26:46:cd:0e:ab:ef"
echo ""

# Most important check
echo "=============================================="
echo "⚠️  MOST IMPORTANT CHECK ⚠️"
echo "=============================================="
echo ""
echo "🔥 Firebase Installations API Status"
echo ""
echo "Go to: https://console.cloud.google.com/apis/library?project=ai-meeting-assistant-db2b0"
echo ""
echo "Make sure these APIs are ENABLED:"
echo "  [ ] Firebase Installations API"
echo "  [ ] Firebase Cloud Messaging API"
echo "  [ ] Cloud Messaging"
echo ""
echo "If any are disabled, enable them and wait 5-10 minutes for propagation."
echo ""
echo "=============================================="
echo ""

# Check 8: App Check
echo "🛡️  Check 8: App Check Status"
echo ""
echo "Go to: https://console.firebase.google.com/project/ai-meeting-assistant-db2b0/appcheck"
echo ""
echo "If App Check is ENABLED for your Android app:"
echo "  → This can block Firebase Installations Service"
echo "  → DISABLE it for testing, or add a debug token"
echo ""
echo "=============================================="
echo ""

echo "📝 Next Steps:"
echo ""
echo "1. ✅ App data has been cleared (already done)"
echo "2. 🔍 Enable Firebase Installations API in Google Cloud Console"
echo "3. 🛡️  Check if App Check is blocking (disable for testing)"
echo "4. 🔄 Rebuild and reinstall the app:"
echo "     eas build --profile development --platform android"
echo "5. 📲 Install and test again"
echo ""
echo "If the error persists after enabling APIs, wait 1-2 hours for Firebase propagation."
echo ""
