#pragma once

#include <json/json.h>

#include <string>
#include <vector>

namespace DiffUtils {

enum class Operation { Equal, Insert, Delete };

struct Segment {
    Operation op;
    std::string text;
};

/**
 * 计算基于行的 diff，返回操作序列。
 * 默认最多支持 4000 行，超过则返回提示段。
 */
std::vector<Segment> computeLineDiff(const std::string& baseText, const std::string& targetText,
                                     size_t maxLines = 4000);

/**
 * 将 diff 结果转换为 JSON 数组。
 */
Json::Value segmentsToJson(const std::vector<Segment>& segments);

/**
 * 将 Operation 枚举转换为字符串。
 */
std::string operationToString(Operation op);

}  // namespace DiffUtils



