#include "SearchController.h"

#include <drogon/utils/Utilities.h>  // 用于 urlDecode
#include <json/json.h>

#include <set>
#include <vector>

#include "../services/SearchService.h"
#include "../utils/ResponseUtils.h"

void SearchController::search(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取查询参数
    std::string query = req->getParameter("q");

    // 如果 getParameter 获取不到，尝试从 query string 手动解析
    if (query.empty()) {
        std::string queryString = req->query();
        if (!queryString.empty()) {
            // 解析查询字符串，查找 q= 参数
            size_t pos = queryString.find("q=");
            if (pos != std::string::npos) {
                size_t start = pos + 2;
                size_t end = queryString.find("&", start);
                if (end == std::string::npos) {
                    end = queryString.length();
                }
                query = queryString.substr(start, end - start);
                // URL 解码（Drogon 的 getParameter 会自动解码，但手动解析的需要手动解码）
                query = drogon::utils::urlDecode(query);
            }
        }
    }

    if (query.empty()) {
        ResponseUtils::sendError(callback, "Query parameter 'q' is required", k400BadRequest);
        return;
    }

    // 解析分页参数
    int page = 1;
    int pageSize = 20;
    std::string pageStr = req->getParameter("page");
    std::string pageSizeStr = req->getParameter("page_size");

    try {
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {
    }

    try {
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {
    }

    // 2.执行搜索
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    SearchService::search(
            query, page, pageSize,
            [=](const Json::Value& searchResult) {
                // 3.过滤结果(只返回用户有权限访问的文档)
                std::string userIdStr = req->getParameter("user_id");
                if (userIdStr.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "User ID not found", k401Unauthorized);
                    return;
                }

                // 获取搜索结果中的文档 ID
                Json::Value hits = searchResult["hits"];
                std::vector<int> docIds;
                for (const auto& hit : hits) {
                    docIds.push_back(hit["id"].asInt());
                }

                // 如果没有搜索结果，直接返回空结果
                if (docIds.empty()) {
                    Json::Value responseJson;
                    responseJson["hits"] = Json::arrayValue;
                    responseJson["query"] = query;
                    responseJson["page"] = page;
                    responseJson["page_size"] = pageSize;
                    responseJson["total_hits"] = 0;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                    return;
                }

                // 查询用户有权限访问的文档
                auto db = drogon::app().getDbClient();
                if (!db) {
                    ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                    return;
                }

                // 构建文档ID列表
                std::string docIdsStr;
                for (size_t i = 0; i < docIds.size(); i++) {
                    if (i > 0) docIdsStr += ",";
                    docIdsStr += std::to_string(docIds[i]);
                }
                db->execSqlAsync(
                        "SELECT DISTINCT d.id "
                        "FROM document d "
                        "LEFT JOIN doc_acl da ON d.id = da.doc_id "
                        "WHERE d.id IN (" +
                                docIdsStr +
                                ") "
                                "AND (d.owner_id = $1 OR da.user_id = $1)",
                        [=](const drogon::orm::Result& r) {
                            std::set<int> allowedDocsIds;
                            for (const auto& row : r) {
                                allowedDocsIds.insert(row["id"].as<int>());
                            }
                            // 过滤搜索结果
                            Json::Value filteredHits(Json::arrayValue);
                            for (const auto& hit : hits) {
                                int docId = hit["id"].asInt();
                                if (allowedDocsIds.find(docId) != allowedDocsIds.end()) {
                                    filteredHits.append(hit);
                                }
                            }

                            Json::Value responseJson;
                            responseJson["hits"] = filteredHits;
                            responseJson["query"] = query;
                            responseJson["page"] = page;
                            responseJson["page_size"] = pageSize;
                            responseJson["total_hits"] = static_cast<int>(filteredHits.size());

                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()));
                        },
                        userIdStr);
            },
            [=](const std::string& error) {
                ResponseUtils::sendError(*callbackPtr, "Search error:" + error, k500InternalServerError);
            });
}
