#pragma once
#include <json/json.h>

#include <functional>
#include <string>

class SearchService {
public:
    // 索引文档
    static void indexDocument(int docId, const std::string &title, const std::string &content);
    // 删除文档索引
    static void deleteDocument(int docId);
    // 搜索文档
    static void search(const std::string &query, int page, int pageSize,
                       std::function<void(const Json::Value &)> callback,
                       std::function<void(const std::string &)> errorCallback);

private:
    static std::string getMeilisearchUrl();
    static std::string getMasterKey();
};