#!/usr/bin/env bash

# Write the GOOGLE_SERVICES_JSON environment variable to google-services.json
# This runs during EAS Build before dependencies are installed

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "$GOOGLE_SERVICES_JSON" > google-services.json
  echo "✓ google-services.json created from EAS secret"
else
  echo "⚠ GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
