#!/bin/bash
# Start Local Development Stack
# This script starts all Bond Math services in separate terminal windows

set -e

echo "🚀 Starting Bond Math Local Development Stack"
echo ""

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if .dev.vars exists
if [ ! -f "$ROOT_DIR/iac/workers/.dev.vars" ]; then
    echo "❌ ERROR: .dev.vars not found!"
    echo "Please run: cp iac/workers/.dev.vars.example iac/workers/.dev.vars"
    echo "See LOCAL_DEV_GUIDE.md for setup instructions"
    exit 1
fi

echo "✅ Found .dev.vars"
echo ""

# Detect terminal emulator
if command -v gnome-terminal &> /dev/null; then
    TERM_CMD="gnome-terminal --"
elif command -v xterm &> /dev/null; then
    TERM_CMD="xterm -e"
elif command -v konsole &> /dev/null; then
    TERM_CMD="konsole -e"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TERM_CMD="osascript -e 'tell application \"Terminal\" to do script"
else
    echo "⚠️  Could not detect terminal emulator"
    echo "Please start services manually. See LOCAL_DEV_GUIDE.md"
    exit 1
fi

echo "📦 Starting services in dependency order..."
echo ""

# Function to start a service
start_service() {
    local name=$1
    local path=$2
    local command=$3

    echo "Starting $name..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT_DIR/$path' && echo '========== $name ==========' && $command\""
    else
        # Linux
        $TERM_CMD bash -c "cd '$ROOT_DIR/$path' && echo '========== $name ==========' && $command; exec bash"
    fi

    sleep 2
}

# Start services
start_service "Day-Count Service" "services/daycount" "npm run dev"
start_service "Bond Valuation Service" "services/bond-valuation" "wrangler dev --config ../../iac/workers/valuation.toml --port 8788"
start_service "Metrics Service" "services/metrics" "wrangler dev --config ../../iac/workers/metrics.toml --port 8789"
start_service "Pricing Service" "services/pricing" "wrangler dev --config ../../iac/workers/pricing.toml --port 8790"
start_service "Gateway Service" "services/gateway" "npm run dev -- --port 8791"

# Ask about UI
read -p "Start UI? (y/n): " start_ui
if [[ "$start_ui" == "y" || "$start_ui" == "Y" ]]; then
    start_service "UI (Astro)" "ui" "npm run dev"
fi

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Service URLs:"
echo "  Day-Count:      http://localhost:8787"
echo "  Valuation:      http://localhost:8788"
echo "  Metrics:        http://localhost:8789"
echo "  Pricing:        http://localhost:8790"
echo "  Gateway:        http://localhost:8791"
if [[ "$start_ui" == "y" || "$start_ui" == "Y" ]]; then
    echo "  UI:             http://localhost:4321"
fi
echo ""
echo "💡 Tips:"
echo "  - Each service runs in its own window"
echo "  - Close windows or Ctrl+C to stop services"
echo "  - Check LOCAL_DEV_GUIDE.md for testing commands"
echo "  - Services will auto-reload on code changes"
echo ""
