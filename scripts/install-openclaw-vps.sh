#!/bin/bash
# OpenClaw VPS Installer — Ubuntu 20.04/22.04/24.04
# Untuk video tutorial OpenClaw Academy
# Usage: bash install-openclaw-vps.sh

set -e

echo "========================================"
echo "  OpenClaw VPS Installer"
echo "  Ubuntu + Node.js + OpenClaw + Gemini"
echo "========================================"
echo ""

# ---- 1. Update system ----
echo "▶ [1/6] Updating system..."
sudo apt update && sudo apt upgrade -y

# ---- 2. Install Node.js 22 LTS ----
echo "▶ [2/6] Installing Node.js 22..."
if command -v node &> /dev/null; then
    echo "  Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "  ✓ Node.js $(node --version) installed"
fi

# ---- 3. Install OpenClaw ----
echo "▶ [3/6] Installing OpenClaw..."
if command -v openclaw &> /dev/null; then
    echo "  OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
    npm install -g openclaw@2026.4.12
    echo "  ✓ OpenClaw installed (v2026.4.12 stable)"
fi

# ---- 4. Setup workspace ----
echo "▶ [4/6] Setting up workspace..."
mkdir -p ~/.openclaw/workspace
cd ~/.openclaw/workspace

if [ ! -f openclaw.json ]; then
    echo "  Creating openclaw.json..."
    cat > openclaw.json << 'EOF'
{
  "version": "2026.4.12",
  "workspace": "~/.openclaw/workspace",
  "models": {
    "providers": {
      "google": {
        "type": "google-genai",
        "apiKey": "${GEMINI_API_KEY}"
      }
    },
    "defaults": {
      "primary": "google/gemini-2.5-flash"
    }
  }
}
EOF
    echo "  ✓ openclaw.json created"
else
    echo "  openclaw.json already exists, skipping"
fi

# ---- 5. Ask for API key ----
echo "▶ [5/6] Gemini API Key setup..."
echo ""
echo "  Get your free API key: https://aistudio.google.com/apikey"
echo ""

if [ -z "$GEMINI_API_KEY" ]; then
    read -p "  Paste your Gemini API key: " API_KEY
    if [ -n "$API_KEY" ]; then
        sed -i "s|\${GEMINI_API_KEY}|${API_KEY}|g" ~/.openclaw/workspace/openclaw.json
        export GEMINI_API_KEY="$API_KEY"
        echo "  ✓ API key saved"
    else
        echo "  ⚠ No API key provided. You can add it later:"
        echo "    Edit ~/.openclaw/workspace/openclaw.json"
    fi
else
    echo "  ✓ GEMINI_API_KEY found in environment"
fi

# ---- 6. Start OpenClaw gateway ----
echo "▶ [6/6] Starting OpenClaw gateway..."
openclaw gateway start --daemon 2>/dev/null || openclaw gateway start &
sleep 3

echo ""
echo "========================================"
echo "  ✅ Installation Complete!"
echo "========================================"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Test your agent:"
echo "     openclaw chat"
echo ""
echo "  2. Setup Telegram channel (optional):"
echo "     https://docs.openclaw.ai/channels/telegram"
echo ""
echo "  3. Your workspace:"
echo "     ~/.openclaw/workspace/"
echo ""
echo "  4. Config file:"
echo "     ~/.openclaw/workspace/openclaw.json"
echo ""
echo "========================================"
