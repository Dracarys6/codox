#!/bin/bash

# 测试用户搜索 API
# 使用方法: ./test_user_search.sh [token] [query]

TOKEN=${1:-""}
QUERY=${2:-"1"}

if [ -z "$TOKEN" ]; then
    echo "Usage: $0 <access_token> [query]"
    echo "Example: $0 'your_token_here' '1'"
    exit 1
fi

API_URL="http://localhost:8080/api/users/search"

echo "Testing user search API..."
echo "Query: $QUERY"
echo "URL: $API_URL?q=$QUERY"
echo ""

curl -X GET "$API_URL?q=$QUERY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "(< HTTP|users|total|error)"

echo ""
echo "Test completed."

