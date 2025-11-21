#include "DiffUtils.h"

#include <algorithm>
#include <sstream>

namespace DiffUtils {
namespace {
std::vector<std::string> splitLines(const std::string& text) {
    std::vector<std::string> lines;
    std::stringstream ss(text);
    std::string line;
    while (std::getline(ss, line)) {
        lines.push_back(line);
    }
    // 保留结尾空行
    if (!text.empty() && text.back() == '\n') {
        lines.push_back("");
    }
    return lines;
}

void appendSegment(std::vector<Segment>& segments, Operation op, const std::string& line) {
    if (!segments.empty() && segments.back().op == op) {
        segments.back().text.append(line).append("\n");
    } else {
        Segment seg{op, line + "\n"};
        segments.push_back(seg);
    }
}
}  // namespace

std::vector<Segment> computeLineDiff(const std::string& baseText, const std::string& targetText, size_t maxLines) {
    auto baseLines = splitLines(baseText);
    auto targetLines = splitLines(targetText);

    if (baseLines.size() > maxLines || targetLines.size() > maxLines) {
        return {Segment{Operation::Equal, "[Diff truncated: content too large]\n"}};
    }

    size_t n = baseLines.size();
    size_t m = targetLines.size();
    if (n == 0 && m == 0) return {};

    std::vector<std::vector<int>> dp(n + 1, std::vector<int>(m + 1, 0));
    for (size_t i = n; i-- > 0;) {
        for (size_t j = m; j-- > 0;) {
            if (baseLines[i] == targetLines[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1;
            } else {
                dp[i][j] = std::max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    size_t i = 0, j = 0;
    std::vector<Segment> segments;
    while (i < n && j < m) {
        if (baseLines[i] == targetLines[j]) {
            appendSegment(segments, Operation::Equal, baseLines[i]);
            ++i;
            ++j;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            appendSegment(segments, Operation::Delete, baseLines[i]);
            ++i;
        } else {
            appendSegment(segments, Operation::Insert, targetLines[j]);
            ++j;
        }
    }
    while (i < n) {
        appendSegment(segments, Operation::Delete, baseLines[i]);
        ++i;
    }
    while (j < m) {
        appendSegment(segments, Operation::Insert, targetLines[j]);
        ++j;
    }

    if (!segments.empty() && !segments.back().text.empty() && segments.back().text.back() == '\n') {
        // 去掉最后一段多余的换行
        segments.back().text.pop_back();
    }
    return segments;
}

Json::Value segmentsToJson(const std::vector<Segment>& segments) {
    Json::Value arr(Json::arrayValue);
    for (const auto& seg : segments) {
        Json::Value item;
        item["op"] = operationToString(seg.op);
        item["text"] = seg.text;
        arr.append(item);
    }
    return arr;
}

std::string operationToString(Operation op) {
    switch (op) {
        case Operation::Equal:
            return "equal";
        case Operation::Insert:
            return "insert";
        case Operation::Delete:
            return "delete";
    }
    return "equal";
}

}  // namespace DiffUtils



