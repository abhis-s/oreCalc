#!/bin/bash

# Check if an HTML file is provided as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <html_file>"
  exit 1
fi

# Check if the file exists
if [ ! -f "$1" ]; then
  echo "Error: File not found: $1"
  exit 1
fi

# Use grep to isolate lines with data-i18n.
# Use sed to extract and format the key-value pairs.
# Use a final sed command to add the JSON braces and commas.
grep "data-i18n=" "$1" | sed -nE 's/.*data-i18n="([^"]*)".*[^>]*>([^<]*)<.*/"\1": "\2",/p' | sed '$s/,$//' | sed '1s/^/{/' | sed '$s/$/}/'
