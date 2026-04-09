#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-5000}"
URL="http://${HOST}:${PORT}/health"
DETAILED_URL="http://${HOST}:${PORT}/health/detailed"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking AgentLabs health at $URL ..."
echo ""

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
RESPONSE=$(curl -s "$URL" 2>/dev/null || echo '{"error":"connection refused"}')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}[OK]${NC} Basic health check passed (HTTP $HTTP_CODE)"
    echo "  Response: $RESPONSE"
else
    echo -e "${RED}[FAIL]${NC} Basic health check failed (HTTP $HTTP_CODE)"
    echo "  Response: $RESPONSE"
fi

echo ""

DETAILED_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DETAILED_URL" 2>/dev/null || echo "000")
DETAILED_RESPONSE=$(curl -s "$DETAILED_URL" 2>/dev/null || echo '{"error":"connection refused"}')

if [ "$DETAILED_CODE" = "200" ]; then
    echo -e "${GREEN}[OK]${NC} Detailed health check passed (HTTP $DETAILED_CODE)"
elif [ "$DETAILED_CODE" = "503" ]; then
    echo -e "${RED}[DEGRADED]${NC} Detailed health check reports issues (HTTP $DETAILED_CODE)"
else
    echo -e "${YELLOW}[WARN]${NC} Detailed health check returned HTTP $DETAILED_CODE"
fi

if command -v jq &> /dev/null; then
    echo "$DETAILED_RESPONSE" | jq . 2>/dev/null || echo "  $DETAILED_RESPONSE"
else
    echo "  $DETAILED_RESPONSE"
    echo "  (Install jq for formatted output: sudo apt install jq)"
fi

echo ""

SYSTEMD_STATUS=$(systemctl is-active agentlabs 2>/dev/null || echo "unknown")
if [ "$SYSTEMD_STATUS" = "active" ]; then
    echo -e "${GREEN}[OK]${NC} Systemd service: $SYSTEMD_STATUS"
else
    echo -e "${RED}[FAIL]${NC} Systemd service: $SYSTEMD_STATUS"
fi

MEM=$(systemctl show agentlabs --property=MemoryCurrent 2>/dev/null | cut -d= -f2 || echo "N/A")
if [ "$MEM" != "N/A" ] && [ "$MEM" != "[not set]" ] && [ "$MEM" != "" ]; then
    MEM_MB=$((MEM / 1048576))
    echo "  Memory usage: ${MEM_MB}MB"
fi

echo ""
if [ "$HTTP_CODE" = "200" ]; then
    exit 0
else
    exit 1
fi
