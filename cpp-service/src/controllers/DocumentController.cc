#include "DocumentController.h"

#include <drogon/HttpClient.h>
#include <drogon/MultiPart.h>
#include <drogon/drogon.h>
#include <json/json.h>

#include <cstdlib>
#include <ctime>
#include <fstream>
#include <limits>
#include <memory>
#include <numeric>
#include <regex>
#include <sstream>
#include <unordered_map>
#include <vector>

#include "../repositories/VersionRepository.h"
#include "../services/SearchService.h"
#include "../utils/DiffUtils.h"
#include "../utils/NotificationUtils.h"
#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"

static void queryDocumentWithTags(const drogon::orm::DbClientPtr& db, int docId,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr);
static void queryAclAndRespond(const drogon::orm::DbClientPtr& db, int docId, int ownerId,
                               std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr);
// 前向声明导出辅助函数
static void proceedWithWordExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                  const std::string& title, const std::string& content);
static void proceedWithPdfExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                 const std::string& title, const std::string& content);
static void proceedWithMarkdownExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                      const std::string& title, const std::string& content);

static std::string htmlToPlainText(const std::string& html) {
    if (html.empty()) {
        return "";
    }

    std::string text = html;
    text = std::regex_replace(text, std::regex("<script[\\s\\S]*?</script>", std::regex_constants::icase), "");
    text = std::regex_replace(text, std::regex("<style[\\s\\S]*?</style>", std::regex_constants::icase), "");
    text = std::regex_replace(text, std::regex("<\\s*/?\\s*p\\s*>", std::regex_constants::icase), "\n");
    text = std::regex_replace(text, std::regex("<\\s*br\\s*/?>", std::regex_constants::icase), "\n");
    text = std::regex_replace(text, std::regex("<[^>]+>"), " ");

    auto replaceAll = [](std::string& target, const std::string& from, const std::string& to) {
        size_t pos = 0;
        while ((pos = target.find(from, pos)) != std::string::npos) {
            target.replace(pos, from.length(), to);
            pos += to.length();
        }
    };

    replaceAll(text, "&nbsp;", " ");
    replaceAll(text, "&lt;", "<");
    replaceAll(text, "&gt;", ">");
    replaceAll(text, "&amp;", "&");
    replaceAll(text, "&quot;", "\"");
    replaceAll(text, "&#39;", "'");

    text = std::regex_replace(text, std::regex("[ \\t]+"), " ");
    text = std::regex_replace(text, std::regex("\\n{3,}"), "\n\n");

    return text;
}

static std::string ensurePlainText(const std::string& contentText, const std::string& contentHtml) {
    if (!contentText.empty()) {
        return contentText;
    }
    if (contentHtml.empty()) {
        return "";
    }
    return htmlToPlainText(contentHtml);
}
// 辅助函数：构建文档响应
static void buildDocumentResponse(const drogon::orm::Result& r,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    Json::Value responseJson;
    responseJson["id"] = r[0]["id"].as<int>();
    responseJson["title"] = r[0]["title"].as<std::string>();
    responseJson["owner_id"] = r[0]["owner_id"].as<int>();
    responseJson["is_locked"] = r[0]["is_locked"].as<bool>();

    // 添加 status 字段，如果不存在则使用默认值
    if (!r[0]["status"].isNull()) {
        responseJson["status"] = r[0]["status"].as<std::string>();
    } else {
        // 兼容旧数据：根据 is_locked 和 last_published_version_id 推断状态
        if (r[0]["is_locked"].as<bool>()) {
            responseJson["status"] = "locked";
        } else if (!r[0]["last_published_version_id"].isNull()) {
            responseJson["status"] = "published";
        } else {
            responseJson["status"] = "saved";
        }
    }

    if (!r[0]["last_published_version_id"].isNull()) {
        responseJson["last_published_version_id"] = r[0]["last_published_version_id"].as<int>();
    }

    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
    responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();

    // 解析标签 JSON
    std::string tagsJsonStr = r[0]["tags"].as<std::string>();
    Json::Reader reader;
    Json::Value tagsJson;
    if (reader.parse(tagsJsonStr, tagsJson) && tagsJson.isArray()) {
        responseJson["tags"] = tagsJson;
    } else {
        responseJson["tags"] = Json::Value(Json::arrayValue);
    }

    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
}

// 辅助函数:处理标签更新
static void handleUpdateTags(const drogon::orm::DbClientPtr& db, int docId, const Json::Value& json,
                             const drogon::orm::Result& docResult,
                             std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>> callbackPtr) {
    // 没有标签更新,直接查询文档（包括标签）并返回
    if (!json.isMember("tags")) {
        queryDocumentWithTags(db, docId, callbackPtr);
        return;
    }

    std::string docIdStr = std::to_string(docId);

    // 删除旧标签关联
    db->execSqlAsync(
            "DELETE FROM doc_tag WHERE doc_id = $1::integer",
            [=](const drogon::orm::Result& r) {
                Json::Value tagsJson = json["tags"];
                if (!tagsJson.isArray() || tagsJson.size() == 0) {
                    // 没有新标签,查询文档（包括标签）并返回
                    queryDocumentWithTags(db, docId, callbackPtr);
                    return;
                }

                // 处理新标签,逐个插入
                // 使用shared_ptr确保所有lambda共享同一个状态
                struct TagUpdaterState {
                    drogon::orm::DbClientPtr db;
                    int docId;
                    Json::Value tagsJson;
                    std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr;
                    int index = 0;
                };

                auto state = std::make_shared<TagUpdaterState>(TagUpdaterState{db, docId, tagsJson, callbackPtr});

                // 定义递归处理函数（使用shared_ptr包装function以支持递归）
                auto processNext = std::make_shared<std::function<void()>>();
                *processNext = [=]() mutable {
                    if (state->index >= int(state->tagsJson.size())) {
                        // 所有标签处理完成,查询文档（包括标签）并返回响应
                        queryDocumentWithTags(state->db, state->docId, state->callbackPtr);
                        return;
                    }
                    std::string tagName = state->tagsJson[state->index].asString();
                    state->index++;

                    // 查找或创建标签
                    state->db->execSqlAsync(
                            "INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 "
                            "RETURNING id, name",
                            [=](const drogon::orm::Result& tagResult) mutable {
                                if (!tagResult.empty()) {
                                    int tagId = tagResult[0]["id"].as<int>();

                                    // 关联文档和标签
                                    state->db->execSqlAsync(
                                            "INSERT INTO doc_tag (doc_id, tag_id) VALUES ($1::integer, "
                                            "$2::integer) ON CONFLICT DO NOTHING",
                                            [=](const drogon::orm::Result& r) mutable { (*processNext)(); },
                                            [=](const drogon::orm::DrogonDbException& e) {
                                                ResponseUtils::sendError(
                                                        *(state->callbackPtr),
                                                        "Database error: " + std::string(e.base().what()),
                                                        k500InternalServerError);
                                                return;
                                            },
                                            std::to_string(state->docId), std::to_string(tagId));
                                } else {
                                    (*processNext)();
                                }
                            },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*(state->callbackPtr),
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                                return;
                            },
                            tagName);
                };

                // 开始处理
                (*processNext)();
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
                return;
            },
            docIdStr);
}

// 辅助函数：查询文档（包括标签）并返回响应
static void queryDocumentWithTags(const drogon::orm::DbClientPtr& db, int docId,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    std::string docIdStr = std::to_string(docId);
    db->execSqlAsync(
            "SELECT d.id, d.title, d.owner_id, d.is_locked, d.status, d.last_published_version_id, "
            "       d.created_at, d.updated_at, "
            "       COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) "
            "                FILTER (WHERE t.id IS NOT NULL), '[]'::json) as tags "
            "FROM document d "
            "LEFT JOIN doc_tag dt ON d.id = dt.doc_id "
            "LEFT JOIN tag t ON dt.tag_id = t.id "
            "WHERE d.id = $1::integer "
            "GROUP BY d.id",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                    return;
                }
                buildDocumentResponse(r, callbackPtr);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

// 辅助函数：查询 ACL 列表并返回统一响应
static void queryAclAndRespond(const drogon::orm::DbClientPtr& db, int docId, int ownerId,
                               std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    if (!db) {
        ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
        return;
    }
    std::string docIdStr = std::to_string(docId);
    std::string ownerIdStr = std::to_string(ownerId);

    db->execSqlAsync(
            "SELECT da.user_id, da.permission, u.email, up.nickname "
            "FROM doc_acl da "
            "INNER JOIN \"user\" u ON da.user_id = u.id "
            "LEFT JOIN user_profile up ON u.id = up.user_id "
            "WHERE da.doc_id = $1::bigint "
            "ORDER BY da.user_id",
            [=](const drogon::orm::Result& aclResult) {
                Json::Value aclArray(Json::arrayValue);
                bool ownerIncluded = false;

                for (const auto& row : aclResult) {
                    Json::Value aclItem;
                    int aclUserId = row["user_id"].as<int>();
                    aclItem["user_id"] = aclUserId;
                    aclItem["permission"] = row["permission"].as<std::string>();
                    aclItem["email"] = row["email"].as<std::string>();
                    if (!row["nickname"].isNull()) {
                        aclItem["nickname"] = row["nickname"].as<std::string>();
                    }
                    if (aclUserId == ownerId && aclItem["permission"].asString() == "owner") {
                        ownerIncluded = true;
                    }
                    aclArray.append(aclItem);
                }

                auto sendSuccessResponse = [callbackPtr, docId](const Json::Value& finalAcl) {
                    Json::Value responseJson;
                    responseJson["doc_id"] = docId;
                    responseJson["acl"] = finalAcl;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                };

                if (ownerIncluded) {
                    sendSuccessResponse(aclArray);
                    return;
                }

                // 如果结果中缺少 owner 记录（理论上不应该发生），补充一条
                db->execSqlAsync(
                        "SELECT u.email, up.nickname FROM \"user\" u "
                        "LEFT JOIN user_profile up ON u.id = up.user_id "
                        "WHERE u.id = $1::bigint",
                        [=](const drogon::orm::Result& ownerResult) mutable {
                            Json::Value ownerItem;
                            ownerItem["user_id"] = ownerId;
                            ownerItem["permission"] = "owner";
                            if (!ownerResult.empty()) {
                                ownerItem["email"] = ownerResult[0]["email"].as<std::string>();
                                if (!ownerResult[0]["nickname"].isNull()) {
                                    ownerItem["nickname"] = ownerResult[0]["nickname"].as<std::string>();
                                }
                            }
                            aclArray.append(ownerItem);
                            sendSuccessResponse(aclArray);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        ownerIdStr);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

void DocumentController::create(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 验证 userId 是否为有效数字
    try {
        std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2.解析 JSON 请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    std::string title = json.get("title", "").asString();

    // 3.验证标题
    if (title.empty()) {
        ResponseUtils::sendError(callback, "Title is required", k400BadRequest);
        return;
    }
    if (title.size() > 255) {
        ResponseUtils::sendError(callback, "Title too long", k400BadRequest);
        return;
    }

    // 4.获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 shared_ptr 包装 callback 以支持嵌套异步调用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 5.插入文档
    db->execSqlAsync(
            "INSERT INTO document (owner_id, title, status) VALUES ($1::integer, $2, 'draft') "
            "RETURNING id, owner_id, title, is_locked, status, created_at, updated_at",
            [=](const drogon::orm::Result& r) mutable {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Failed to create document", k500InternalServerError);
                    return;
                }

                int docId = r[0]["id"].as<int>();
                std::string docIdStr = std::to_string(docId);  // 保存字符串版本，避免重复转换

                // 6.插入 owner ACL 记录
                db->execSqlAsync(
                        "INSERT INTO doc_acl (doc_id, user_id, permission) "
                        "VALUES($1::integer, $2::integer, 'owner') ON CONFLICT DO NOTHING",
                        [=](const drogon::orm::Result&) mutable {
                            // 7.索引文档到Meilisearch
                            std::string docTitle = r[0]["title"].as<std::string>();
                            SearchService::indexDocument(docId, docTitle, docTitle);  // 新文档先用title作为content

                            Json::Value responseJson;
                            responseJson["id"] = docId;
                            responseJson["title"] = docTitle;
                            responseJson["owner_id"] = r[0]["owner_id"].as<int>();
                            responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                            // 添加 status 字段
                            if (!r[0]["status"].isNull()) {
                                responseJson["status"] = r[0]["status"].as<std::string>();
                            } else {
                                responseJson["status"] = "draft";
                            }
                            responseJson["tags"] = Json::Value(Json::arrayValue);
                            responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                            responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, userIdStr);
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, title);
}

void DocumentController::list(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 2.解析查询参数
    // 通用的整数参数解析，保证边界合法
    auto parseIntParam = [&](const std::string& name, int minValue, int maxValue, int defaultValue) {
        std::string value = req->getParameter(name);
        if (value.empty()) return defaultValue;
        try {
            int parsed = std::stoi(value);
            return std::max(minValue, std::min(maxValue, parsed));
        } catch (...) {
            return defaultValue;
        }
    };

    int page = parseIntParam("page", 1, std::numeric_limits<int>::max(), 1);
    int pageSize = parseIntParam("pageSize", 1, 100, 20);
    int offset = (page - 1) * pageSize;

    // 获取状态筛选参数
    // 尝试多种方式获取参数
    std::string statusFilter = req->getParameter("status");

    // 如果 getParameter 获取不到，尝试从查询字符串手动解析
    if (statusFilter.empty()) {
        std::string queryString = req->query();
        if (!queryString.empty()) {
            // 手动解析查询字符串，查找 status 参数
            size_t statusPos = queryString.find("status=");
            if (statusPos != std::string::npos) {
                size_t start = statusPos + 7;  // "status=" 的长度
                size_t end = queryString.find("&", start);
                if (end == std::string::npos) {
                    end = queryString.length();
                }
                statusFilter = queryString.substr(start, end - start);
                // URL 解码
                statusFilter = drogon::utils::urlDecode(statusFilter);
            }
        }
    }

    bool hasStatusFilter = !statusFilter.empty() &&
                           (statusFilter == "draft" || statusFilter == "saved" || statusFilter == "published" ||
                            statusFilter == "archived" || statusFilter == "locked");

    // 3.查询文档
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 构建WHERE子句
    std::string baseWhere = "WHERE (d.owner_id = $1::integer OR a.user_id = $1::integer)";
    std::string statusWhere = "";
    if (hasStatusFilter) {
        // 使用文本类型进行字符串比较
        statusWhere = " AND d.status = $2::text";
    }

    // 查询总和和列表
    std::string countSql =
            "SELECT COUNT(DISTINCT d.id) as total "
            "FROM document d "
            "LEFT JOIN doc_acl a ON d.id = a.doc_id " +
            baseWhere + statusWhere;

    std::string listSql =
            "SELECT DISTINCT d.id, d.title, d.owner_id, d.is_locked, d.status, d.created_at, d.updated_at "
            "FROM document d "
            "LEFT JOIN doc_acl a ON d.id = a.doc_id " +
            baseWhere + statusWhere +
            " ORDER BY d.updated_at DESC "
            "LIMIT $" +
            std::to_string(hasStatusFilter ? 3 : 2) + "::integer OFFSET $" + std::to_string(hasStatusFilter ? 4 : 3) +
            "::integer";

    // 执行查询的回调函数
    auto processListResult = [=](const drogon::orm::Result& listResult, int total) {
        Json::Value responseJson;
        Json::Value docsArray(Json::arrayValue);
        for (const auto& row : listResult) {
            Json::Value docJson;
            docJson["id"] = row["id"].as<int>();
            docJson["title"] = row["title"].as<std::string>();
            docJson["owner_id"] = row["owner_id"].as<int>();
            docJson["is_locked"] = row["is_locked"].as<bool>();
            // 添加 status 字段，如果不存在则使用默认值
            if (!row["status"].isNull()) {
                docJson["status"] = row["status"].as<std::string>();
            } else {
                // 兼容旧数据
                docJson["status"] = row["is_locked"].as<bool>() ? "locked" : "saved";
            }
            docJson["created_at"] = row["created_at"].as<std::string>();
            docJson["updated_at"] = row["updated_at"].as<std::string>();
            docsArray.append(docJson);
        }

        responseJson["docs"] = docsArray;
        responseJson["total"] = total;
        responseJson["page"] = page;
        responseJson["pageSize"] = pageSize;

        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
    };

    auto errorCallback = [=](const drogon::orm::DrogonDbException& e) {
        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                 k500InternalServerError);
    };

    // 执行查询
    if (hasStatusFilter) {
        db->execSqlAsync(
                countSql,
                [=](const drogon::orm::Result& countResult) mutable {
                    int total = countResult.empty() ? 0 : countResult[0]["total"].as<int>();
                    db->execSqlAsync(
                            listSql,
                            [=](const drogon::orm::Result& listResult) mutable {
                                processListResult(listResult, total);
                            },
                            errorCallback, userIdStr, statusFilter, std::to_string(pageSize), std::to_string(offset));
                },
                errorCallback, userIdStr, statusFilter);
    } else {
        db->execSqlAsync(
                countSql,
                [=](const drogon::orm::Result& countResult) mutable {
                    int total = countResult.empty() ? 0 : countResult[0]["total"].as<int>();
                    db->execSqlAsync(
                            listSql,
                            [=](const drogon::orm::Result& listResult) mutable {
                                processListResult(listResult, total);
                            },
                            errorCallback, userIdStr, std::to_string(pageSize), std::to_string(offset));
                },
                errorCallback, userIdStr);
    }
}

void DocumentController::get(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取doc_id (路径参数)  /api/docs/{id}
    // 路径参数通过 getRoutingParameters() 获取，返回 vector
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    // 验证 docId 是否为有效数字
    try {
        std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 验证 userId 是否为有效数字（用于后续比较）
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.查询文档详情
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT d.id, d.title, d.owner_id, d.is_locked, d.status, d.last_published_version_id, "
            "       d.created_at, d.updated_at, "
            "       COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) "
            "                FILTER (WHERE t.id IS NOT NULL), '[]'::json) as tags "
            "FROM document d "
            "LEFT JOIN doc_tag dt ON d.id = dt.doc_id "
            "LEFT JOIN tag t ON dt.tag_id = t.id "
            "WHERE d.id = $1::integer "
            "GROUP BY d.id",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                    return;
                }

                // 检查权限（简单检查：owner 或 ACL 中存在）
                int ownerId = r[0]["owner_id"].as<int>();
                if (ownerId != userId) {
                    // 检查 ACL
                    db->execSqlAsync(
                            "SELECT 1 FROM doc_acl WHERE doc_id = $1::integer AND user_id = $2::integer",
                            [=](const drogon::orm::Result& aclResult) {
                                if (aclResult.empty()) {
                                    ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                                    return;
                                }
                                buildDocumentResponse(r, callbackPtr);
                            },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            docIdStr, userIdStr);
                } else {
                    buildDocumentResponse(r, callbackPtr);
                }
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

void DocumentController::update(const drogon::HttpRequestPtr& req,
                                std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取doc_id (路径参数)  /api/docs/{id}
    // 路径参数通过 getRoutingParameters() 获取，返回 vector
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];

    // 验证 docId 是否为有效数字
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.检查权限(必须是 owner 或 editor)
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(std::move(callback));

    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.解析JSON请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        // 5.检查要更新的字段
        bool hasTitle = json.isMember("title");
        bool hasIsLocked = json.isMember("is_locked");
        bool hasStatus = json.isMember("status");
        bool hasTags = json.isMember("tags");

        if (!hasTitle && !hasIsLocked && !hasStatus && !hasTags) {
            ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
            return;
        }

        // 6.验证和提取字段值
        std::string title;
        bool isLocked = false;
        std::string status;

        if (hasTitle) {
            title = json["title"].asString();
            if (title.length() > 255) {
                ResponseUtils::sendError(*callbackPtr, "Title too long", k400BadRequest);
                return;
            }
        }
        if (hasIsLocked) {
            isLocked = json["is_locked"].asBool();
        }
        if (hasStatus) {
            status = json["status"].asString();
            // 验证状态值
            if (status != "draft" && status != "saved" && status != "published" && status != "archived" &&
                status != "locked") {
                ResponseUtils::sendError(*callbackPtr, "Invalid status value", k400BadRequest);
                return;
            }
        }

        // 7.获取数据库客户端
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        // 如果只更新tags，不需要更新document表，直接处理标签
        if (!hasTitle && !hasIsLocked && !hasStatus && hasTags) {
            // 先查询文档是否存在
            db->execSqlAsync(
                    "SELECT * FROM document WHERE id = $1::integer",
                    [=](const drogon::orm::Result& r) {
                        if (r.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                            return;
                        }
                        handleUpdateTags(db, docId, json, r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                 k500InternalServerError);
                    },
                    std::to_string(docId));
            return;
        }

        // 8.构造SQL和参数（更新title、is_locked或status）
        std::string sql;
        std::string docIdStr = std::to_string(docId);
        std::string isLockedStr = isLocked ? "true" : "false";

        // 定义统一的成功和错误回调
        auto successCallback = [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                return;
            }
            // 如果更新了title，更新搜索索引
            if (hasTitle) {
                std::string updatedTitle = r[0]["title"].as<std::string>();
                SearchService::indexDocument(docId, updatedTitle, updatedTitle);  // 暂时用title作为content
            }
            handleUpdateTags(db, docId, json, r, callbackPtr);
        };

        auto errorCallback = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        // 9.执行更新（根据字段组合调用不同的SQL）
        // 构建动态SQL
        std::vector<std::string> updateParts;
        std::vector<std::string> params;
        int paramIndex = 1;

        if (hasTitle) {
            updateParts.push_back("title = $" + std::to_string(paramIndex++));
            params.push_back(title);
        }
        if (hasIsLocked) {
            updateParts.push_back("is_locked = $" + std::to_string(paramIndex++));
            params.push_back(isLockedStr);
        }
        if (hasStatus) {
            updateParts.push_back("status = $" + std::to_string(paramIndex++));
            params.push_back(status);
        }

        if (updateParts.empty()) {
            // 只有tags更新，已经在上面处理了
            return;
        }

        sql = "UPDATE document SET " +
              std::accumulate(updateParts.begin(), updateParts.end(), std::string(),
                              [](const std::string& a, const std::string& b) { return a.empty() ? b : a + ", " + b; }) +
              ", updated_at = NOW() WHERE id = $" + std::to_string(paramIndex) + "::integer RETURNING *";
        params.push_back(docIdStr);

        // 执行SQL（需要根据参数数量调用不同的重载）
        if (params.size() == 1) {
            db->execSqlAsync(sql, successCallback, errorCallback, params[0]);
        } else if (params.size() == 2) {
            db->execSqlAsync(sql, successCallback, errorCallback, params[0], params[1]);
        } else if (params.size() == 3) {
            db->execSqlAsync(sql, successCallback, errorCallback, params[0], params[1], params[2]);
        } else if (params.size() == 4) {
            db->execSqlAsync(sql, successCallback, errorCallback, params[0], params[1], params[2], params[3]);
        }
    });
}

void DocumentController::deleteDoc(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数 {id}
    std::vector<std::string> routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }

    std::string docIdStr = routingParams[0];

    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.检查权限(必须是owner)
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only owner can delete document", k403Forbidden);
            return;
        }

        // 4.删除文档
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        db->execSqlAsync(
                "DELETE FROM document WHERE id = $1::integer AND owner_id = $2::integer",
                [=](const drogon::orm::Result& r) {
                    // 检查是否真的删除了文档
                    if (r.affectedRows() == 0) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found or you are not the owner",
                                                 k404NotFound);
                        return;
                    }
                    // 从搜索索引中删除文档
                    SearchService::deleteDocument(docId);
                    // 返回成功删除的响应
                    Json::Value responseJson;
                    responseJson["message"] = "Document deleted successfully";
                    responseJson["id"] = docId;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                docIdStr, userIdStr);
    });
}

void DocumentController::getAcl(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 3.验证用户是文档owner
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Only document owner can view ACL", k403Forbidden);
            return;
        }
        queryAclAndRespond(db, docId, userId, callbackPtr);
    });
}

void DocumentController::updateAcl(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }
    std::string docIdStr = std::to_string(docId);

    // 2.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    if (!json.isMember("acl") || !json["acl"].isArray()) {
        ResponseUtils::sendError(callback, "acl array is required", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 4.验证当前用户是 owner
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Only document owner can update ACL", k403Forbidden);
            return;
        }

        Json::Value aclArray = json["acl"];
        std::vector<std::pair<int, std::string>> aclItems;
        aclItems.reserve(aclArray.size());
        std::unordered_map<int, std::string> newAclMap;

        for (const auto& item : aclArray) {
            if (!item.isMember("user_id") || !item.isMember("permission")) {
                ResponseUtils::sendError(*callbackPtr, "Invalid ACL item: user_id and permission are required",
                                         k400BadRequest);
                return;
            }
            int aclUserId;
            try {
                aclUserId = item["user_id"].asInt();
            } catch (...) {
                ResponseUtils::sendError(*callbackPtr, "Invalid user_id in ACL item", k400BadRequest);
                return;
            }
            if (aclUserId == userId) {
                ResponseUtils::sendError(*callbackPtr, "Owner permission cannot be modified", k400BadRequest);
                return;
            }
            std::string permission = item["permission"].asString();
            if (permission != "viewer" && permission != "editor") {
                ResponseUtils::sendError(*callbackPtr, "Invalid permission: must be 'viewer' or 'editor'",
                                         k400BadRequest);
                return;
            }
            aclItems.emplace_back(aclUserId, permission);
            newAclMap[aclUserId] = permission;
        }

        auto errorHandler = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        auto fetchAcl = [=]() { queryAclAndRespond(db, docId, userId, callbackPtr); };

        auto previousAclMapPtr = std::make_shared<std::unordered_map<int, std::string>>();
        auto newAclMapPtr = std::make_shared<std::unordered_map<int, std::string>>(std::move(newAclMap));

        auto notifyPermissionChanges = [=](const std::unordered_map<int, std::string>& previousAcl) {
            for (const auto& entry : *newAclMapPtr) {
                auto it = previousAcl.find(entry.first);
                if (it == previousAcl.end() || it->second != entry.second) {
                    NotificationUtils::createPermissionChangeNotification(docId, entry.first, entry.second);
                }
            }
        };

        auto applyAclChanges = [=](const std::shared_ptr<std::unordered_map<int, std::string>>& previousAcl) {
            db->execSqlAsync(
                    "DELETE FROM doc_acl WHERE doc_id = $1::bigint AND permission != 'owner'",
                    [=](const drogon::orm::Result&) {
                        if (aclItems.empty()) {
                            fetchAcl();
                            return;
                        }

                        auto buildIntArray = [](const std::vector<std::pair<int, std::string>>& items) {
                            std::ostringstream oss;
                            oss << "{";
                            for (size_t i = 0; i < items.size(); ++i) {
                                if (i > 0) {
                                    oss << ",";
                                }
                                oss << items[i].first;
                            }
                            oss << "}";
                            return oss.str();
                        };

                        auto buildTextArray = [](const std::vector<std::pair<int, std::string>>& items) {
                            std::ostringstream oss;
                            oss << "{";
                            for (size_t i = 0; i < items.size(); ++i) {
                                if (i > 0) {
                                    oss << ",";
                                }
                                oss << "\"" << items[i].second << "\"";
                            }
                            oss << "}";
                            return oss.str();
                        };

                        std::string userIdArray = buildIntArray(aclItems);
                        std::string permissionArray = buildTextArray(aclItems);

                        db->execSqlAsync(
                                "INSERT INTO doc_acl (doc_id, user_id, permission) "
                                "SELECT $1::bigint, unnest($2::bigint[]), unnest($3::varchar[])",
                                [=](const drogon::orm::Result&) {
                                    notifyPermissionChanges(*previousAcl);
                                    fetchAcl();
                                },
                                errorHandler, docIdStr, userIdArray, permissionArray);
                    },
                    errorHandler, docIdStr);
        };

        db->execSqlAsync(
                "SELECT user_id, permission FROM doc_acl WHERE doc_id = $1::bigint AND permission != 'owner'",
                [=](const drogon::orm::Result& currentAcl) {
                    for (const auto& row : currentAcl) {
                        (*previousAclMapPtr)[row["user_id"].as<int>()] = row["permission"].as<std::string>();
                    }
                    applyAclChanges(previousAclMapPtr);
                },
                [=](const drogon::orm::DrogonDbException& e) { errorHandler(e); }, docIdStr);
    });
}

// 获取文档版本列表
void DocumentController::getVersions(const HttpRequestPtr& req,
                                     std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3. 检查权限（至少需要 viewer 权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4. 解析查询参数
        std::string startDate = req->getParameter("start_date");
        std::string endDate = req->getParameter("end_date");
        std::string createdByStr = req->getParameter("created_by");
        int createdBy = 0;
        if (!createdByStr.empty()) {
            try {
                createdBy = std::stoi(createdByStr);
            } catch (...) {
            }
        }

        // 5. 构建查询
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        // 构建 SQL 和参数
        std::string sql =
                "SELECT dv.id, dv.doc_id, dv.version_number, dv.snapshot_url, dv.snapshot_sha256, "
                "dv.size_bytes, dv.created_by, dv.change_summary, dv.source, dv.content_text, "
                "dv.content_html, dv.created_at, "
                "u.email, up.nickname "
                "FROM document_version dv "
                "INNER JOIN \"user\" u ON dv.created_by = u.id "
                "LEFT JOIN user_profile up ON u.id = up.user_id "
                "WHERE dv.doc_id = $1::bigint";

        std::string docIdStr = std::to_string(docId);

        // 提取公共的响应处理逻辑
        auto buildVersionResponse = [=](const drogon::orm::Result& r) {
            Json::Value responseJson;
            Json::Value versionsArray(Json::arrayValue);

            for (const auto& row : r) {
                Json::Value versionJson;
                versionJson["id"] = row["id"].as<int>();
                versionJson["doc_id"] = row["doc_id"].as<int>();
                versionJson["version_number"] = row["version_number"].as<int>();
                versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                versionJson["created_by"] = row["created_by"].as<int>();
                if (!row["change_summary"].isNull()) {
                    versionJson["change_summary"] = row["change_summary"].as<std::string>();
                }
                versionJson["source"] = row["source"].as<std::string>();
                if (!row["content_text"].isNull()) {
                    versionJson["content_text"] = row["content_text"].as<std::string>();
                }
                if (!row["content_html"].isNull()) {
                    versionJson["content_html"] = row["content_html"].as<std::string>();
                }
                versionJson["created_at"] = row["created_at"].as<std::string>();
                versionJson["creator_email"] = row["email"].as<std::string>();
                if (!row["nickname"].isNull()) {
                    versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                }
                versionsArray.append(versionJson);
            }

            responseJson["versions"] = versionsArray;
            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
        };

        auto handleError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        // 根据过滤条件动态构建 SQL 和参数
        if (!startDate.empty() && !endDate.empty()) {
            sql += " AND dv.created_at BETWEEN $2::timestamp AND $3::timestamp";
            if (createdBy > 0) {
                sql += " AND dv.created_by = $4::bigint";
            }
            sql += " ORDER BY dv.version_number DESC";
            if (createdBy > 0) {
                db->execSqlAsync(sql, buildVersionResponse, handleError, docIdStr, startDate, endDate,
                                 std::to_string(createdBy));
            } else {
                db->execSqlAsync(sql, buildVersionResponse, handleError, docIdStr, startDate, endDate);
            }
        } else if (!startDate.empty()) {
            sql += " AND dv.created_at >= $2::timestamp";
            if (createdBy > 0) {
                sql += " AND dv.created_by = $3::bigint";
                sql += " ORDER BY dv.version_number DESC";
                db->execSqlAsync(
                        sql,
                        [=](const drogon::orm::Result& r) {
                            Json::Value responseJson;
                            Json::Value versionsArray(Json::arrayValue);

                            for (const auto& row : r) {
                                Json::Value versionJson;
                                versionJson["id"] = row["id"].as<int>();
                                versionJson["doc_id"] = row["doc_id"].as<int>();
                                versionJson["version_number"] = row["version_number"].as<int>();
                                versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                                versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                                versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                                versionJson["created_by"] = row["created_by"].as<int>();
                                if (!row["change_summary"].isNull()) {
                                    versionJson["change_summary"] = row["change_summary"].as<std::string>();
                                }
                                versionJson["source"] = row["source"].as<std::string>();
                                if (!row["content_text"].isNull()) {
                                    versionJson["content_text"] = row["content_text"].as<std::string>();
                                }
                                if (!row["content_html"].isNull()) {
                                    versionJson["content_html"] = row["content_html"].as<std::string>();
                                }
                                versionJson["created_at"] = row["created_at"].as<std::string>();
                                versionJson["creator_email"] = row["email"].as<std::string>();
                                if (!row["nickname"].isNull()) {
                                    versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                                }
                                versionsArray.append(versionJson);
                            }

                            responseJson["versions"] = versionsArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, startDate, std::to_string(createdBy));
            } else {
                sql += " ORDER BY dv.version_number DESC";
                db->execSqlAsync(
                        sql,
                        [=](const drogon::orm::Result& r) {
                            Json::Value responseJson;
                            Json::Value versionsArray(Json::arrayValue);

                            for (const auto& row : r) {
                                Json::Value versionJson;
                                versionJson["id"] = row["id"].as<int>();
                                versionJson["doc_id"] = row["doc_id"].as<int>();
                                versionJson["version_number"] = row["version_number"].as<int>();
                                versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                                versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                                versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                                versionJson["created_by"] = row["created_by"].as<int>();
                                if (!row["change_summary"].isNull()) {
                                    versionJson["change_summary"] = row["change_summary"].as<std::string>();
                                }
                                versionJson["source"] = row["source"].as<std::string>();
                                if (!row["content_text"].isNull()) {
                                    versionJson["content_text"] = row["content_text"].as<std::string>();
                                }
                                if (!row["content_html"].isNull()) {
                                    versionJson["content_html"] = row["content_html"].as<std::string>();
                                }
                                versionJson["created_at"] = row["created_at"].as<std::string>();
                                versionJson["creator_email"] = row["email"].as<std::string>();
                                if (!row["nickname"].isNull()) {
                                    versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                                }
                                versionsArray.append(versionJson);
                            }

                            responseJson["versions"] = versionsArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, startDate);
            }
        } else if (!endDate.empty()) {
            sql += " AND dv.created_at <= $2::timestamp";
            if (createdBy > 0) {
                sql += " AND dv.created_by = $3::bigint";
                sql += " ORDER BY dv.version_number DESC";
                db->execSqlAsync(
                        sql,
                        [=](const drogon::orm::Result& r) {
                            Json::Value responseJson;
                            Json::Value versionsArray(Json::arrayValue);

                            for (const auto& row : r) {
                                Json::Value versionJson;
                                versionJson["id"] = row["id"].as<int>();
                                versionJson["doc_id"] = row["doc_id"].as<int>();
                                versionJson["version_number"] = row["version_number"].as<int>();
                                versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                                versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                                versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                                versionJson["created_by"] = row["created_by"].as<int>();
                                if (!row["change_summary"].isNull()) {
                                    versionJson["change_summary"] = row["change_summary"].as<std::string>();
                                }
                                versionJson["source"] = row["source"].as<std::string>();
                                if (!row["content_text"].isNull()) {
                                    versionJson["content_text"] = row["content_text"].as<std::string>();
                                }
                                if (!row["content_html"].isNull()) {
                                    versionJson["content_html"] = row["content_html"].as<std::string>();
                                }
                                versionJson["created_at"] = row["created_at"].as<std::string>();
                                versionJson["creator_email"] = row["email"].as<std::string>();
                                if (!row["nickname"].isNull()) {
                                    versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                                }
                                versionsArray.append(versionJson);
                            }

                            responseJson["versions"] = versionsArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, endDate, std::to_string(createdBy));
            } else {
                sql += " ORDER BY dv.version_number DESC";
                db->execSqlAsync(
                        sql,
                        [=](const drogon::orm::Result& r) {
                            Json::Value responseJson;
                            Json::Value versionsArray(Json::arrayValue);

                            for (const auto& row : r) {
                                Json::Value versionJson;
                                versionJson["id"] = row["id"].as<int>();
                                versionJson["doc_id"] = row["doc_id"].as<int>();
                                versionJson["version_number"] = row["version_number"].as<int>();
                                versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                                versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                                versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                                versionJson["created_by"] = row["created_by"].as<int>();
                                if (!row["change_summary"].isNull()) {
                                    versionJson["change_summary"] = row["change_summary"].as<std::string>();
                                }
                                versionJson["source"] = row["source"].as<std::string>();
                                if (!row["content_text"].isNull()) {
                                    versionJson["content_text"] = row["content_text"].as<std::string>();
                                }
                                if (!row["content_html"].isNull()) {
                                    versionJson["content_html"] = row["content_html"].as<std::string>();
                                }
                                versionJson["created_at"] = row["created_at"].as<std::string>();
                                versionJson["creator_email"] = row["email"].as<std::string>();
                                if (!row["nickname"].isNull()) {
                                    versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                                }
                                versionsArray.append(versionJson);
                            }

                            responseJson["versions"] = versionsArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, endDate);
            }
        } else {
            if (createdBy > 0) {
                sql += " AND dv.created_by = $2::bigint";
            }
            sql += " ORDER BY dv.version_number DESC";

            // 提取公共的响应处理逻辑
            auto handleResult = [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value versionsArray(Json::arrayValue);

                for (const auto& row : r) {
                    Json::Value versionJson;
                    versionJson["id"] = row["id"].as<int>();
                    versionJson["doc_id"] = row["doc_id"].as<int>();
                    versionJson["version_number"] = row["version_number"].as<int>();
                    versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                    versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                    versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                    versionJson["created_by"] = row["created_by"].as<int>();
                    if (!row["change_summary"].isNull()) {
                        versionJson["change_summary"] = row["change_summary"].as<std::string>();
                    }
                    versionJson["source"] = row["source"].as<std::string>();
                    if (!row["content_text"].isNull()) {
                        versionJson["content_text"] = row["content_text"].as<std::string>();
                    }
                    if (!row["content_html"].isNull()) {
                        versionJson["content_html"] = row["content_html"].as<std::string>();
                    }
                    versionJson["created_at"] = row["created_at"].as<std::string>();
                    versionJson["creator_email"] = row["email"].as<std::string>();
                    if (!row["nickname"].isNull()) {
                        versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                    }
                    versionsArray.append(versionJson);
                }

                responseJson["versions"] = versionsArray;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            };

            auto handleError = [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            };

            if (createdBy > 0) {
                db->execSqlAsync(sql, handleResult, handleError, docIdStr, std::to_string(createdBy));
            } else {
                db->execSqlAsync(sql, handleResult, handleError, docIdStr);
            }
        }
    });
}

// 获取单个版本详情
void DocumentController::getVersion(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.size() < 2) {
        ResponseUtils::sendError(callback, "Document ID and Version ID are required", k400BadRequest);
        return;
    }
    int docId, versionId;
    try {
        docId = std::stoi(routingParams[0]);
        versionId = std::stoi(routingParams[1]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID or version ID", k400BadRequest);
        return;
    }

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4. 查询版本详情
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT dv.id, dv.doc_id, dv.version_number, dv.snapshot_url, dv.snapshot_sha256, "
                "dv.size_bytes, dv.created_by, dv.change_summary, dv.source, dv.content_text, "
                "dv.content_html, dv.created_at, "
                "u.email, up.nickname "
                "FROM document_version dv "
                "INNER JOIN \"user\" u ON dv.created_by = u.id "
                "LEFT JOIN user_profile up ON u.id = up.user_id "
                "WHERE dv.id = $1::bigint AND dv.doc_id = $2::bigint",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Version not found", k404NotFound);
                        return;
                    }

                    const auto& row = r[0];
                    Json::Value versionJson;
                    versionJson["id"] = row["id"].as<int>();
                    versionJson["doc_id"] = row["doc_id"].as<int>();
                    versionJson["version_number"] = row["version_number"].as<int>();
                    versionJson["snapshot_url"] = row["snapshot_url"].as<std::string>();
                    versionJson["snapshot_sha256"] = row["snapshot_sha256"].as<std::string>();
                    versionJson["size_bytes"] = Json::Int64(row["size_bytes"].as<int64_t>());
                    versionJson["created_by"] = row["created_by"].as<int>();
                    if (!row["change_summary"].isNull()) {
                        versionJson["change_summary"] = row["change_summary"].as<std::string>();
                    }
                    versionJson["source"] = row["source"].as<std::string>();
                    if (!row["content_text"].isNull()) {
                        versionJson["content_text"] = row["content_text"].as<std::string>();
                    }
                    if (!row["content_html"].isNull()) {
                        versionJson["content_html"] = row["content_html"].as<std::string>();
                    }
                    versionJson["created_at"] = row["created_at"].as<std::string>();
                    versionJson["creator_email"] = row["email"].as<std::string>();
                    if (!row["nickname"].isNull()) {
                        versionJson["creator_nickname"] = row["nickname"].as<std::string>();
                    }

                    ResponseUtils::sendSuccess(*callbackPtr, versionJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(versionId), std::to_string(docId));
    });
}

// 手动创建版本
void DocumentController::createVersion(const HttpRequestPtr& req,
                                       std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3. 检查权限（需要 editor 权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only editor or owner can create versions",
                                     k403Forbidden);
            return;
        }

        // 4. 解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        if (!json.isMember("snapshot_url") || !json.isMember("sha256") || !json.isMember("size_bytes")) {
            ResponseUtils::sendError(*callbackPtr, "Missing required fields: snapshot_url, sha256, size_bytes",
                                     k400BadRequest);
            return;
        }

        std::string snapshotUrl = json["snapshot_url"].asString();
        std::string sha256 = json["sha256"].asString();
        int64_t sizeBytes = json["size_bytes"].asInt64();
        std::string changeSummary = json.get("change_summary", "").asString();
        std::string contentText = json.get("content_text", "").asString();
        std::string contentHtml = json.get("content_html", "").asString();

        // 5. 使用 VersionRepository 创建版本
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        VersionInsertParams params;
        params.docId = docId;
        params.creatorId = userId;
        params.snapshotUrl = snapshotUrl;
        params.snapshotSha256 = sha256;
        params.sizeBytes = sizeBytes;
        params.changeSummary = changeSummary;
        params.source = "manual";
        params.contentText = contentText;
        params.contentHtml = contentHtml;

        VersionRepository::insertVersion(
                db, params,
                [=](int versionId, int versionNumber) {
                    Json::Value responseJson;
                    responseJson["version_id"] = versionId;
                    responseJson["version_number"] = versionNumber;
                    responseJson["doc_id"] = docId;
                    responseJson["message"] = "Version created successfully";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                },
                [=](const std::string& message, drogon::HttpStatusCode code) {
                    ResponseUtils::sendError(*callbackPtr, message, code);
                });
    });
}

// 恢复版本
void DocumentController::restoreVersion(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.size() < 2) {
        ResponseUtils::sendError(callback, "Document ID and Version ID are required", k400BadRequest);
        return;
    }
    int docId, versionId;
    try {
        docId = std::stoi(routingParams[0]);
        versionId = std::stoi(routingParams[1]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID or version ID", k400BadRequest);
        return;
    }

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3. 检查权限（需要 owner 权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only owner can restore versions", k403Forbidden);
            return;
        }

        // 4. 验证版本存在且属于该文档
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT snapshot_url, snapshot_sha256, size_bytes, content_text, content_html "
                "FROM document_version "
                "WHERE id = $1::bigint AND doc_id = $2::bigint",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Version not found", k404NotFound);
                        return;
                    }

                    const auto& row = r[0];
                    std::string snapshotUrl = row["snapshot_url"].as<std::string>();
                    std::string sha256 = row["snapshot_sha256"].as<std::string>();
                    int64_t sizeBytes = row["size_bytes"].as<int64_t>();
                    std::string contentText = row["content_text"].isNull() ? "" : row["content_text"].as<std::string>();
                    std::string contentHtml = row["content_html"].isNull() ? "" : row["content_html"].as<std::string>();

                    // 5. 创建新版本记录（标记为 restore 来源）
                    VersionInsertParams params;
                    params.docId = docId;
                    params.creatorId = userId;
                    params.snapshotUrl = snapshotUrl;
                    params.snapshotSha256 = sha256;
                    params.sizeBytes = sizeBytes;
                    params.changeSummary = "Restored from version " + std::to_string(versionId);
                    params.source = "restore";
                    params.contentText = contentText;
                    params.contentHtml = contentHtml;

                    VersionRepository::insertVersion(
                            db, params,
                            [=](int newVersionId, int newVersionNumber) {
                                // 更新文档的 last_published_version_id，使恢复的版本成为当前版本
                                db->execSqlAsync(
                                        "UPDATE document SET last_published_version_id = $1::bigint, updated_at = "
                                        "NOW() "
                                        "WHERE id = $2::bigint",
                                        [=](const drogon::orm::Result&) {
                                            Json::Value responseJson;
                                            responseJson["version_id"] = newVersionId;
                                            responseJson["version_number"] = newVersionNumber;
                                            responseJson["doc_id"] = docId;
                                            responseJson["restored_from_version_id"] = versionId;
                                            responseJson["message"] =
                                                    "Version restored successfully. Document content will be "
                                                    "updated "
                                                    "on next load.";
                                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                        },
                                        [=](const drogon::orm::DrogonDbException& e) {
                                            // 即使更新失败，版本已创建，返回成功但提示需要刷新
                                            Json::Value responseJson;
                                            responseJson["version_id"] = newVersionId;
                                            responseJson["version_number"] = newVersionNumber;
                                            responseJson["doc_id"] = docId;
                                            responseJson["restored_from_version_id"] = versionId;
                                            responseJson["message"] =
                                                    "Version restored successfully, but failed to update document "
                                                    "reference. Please refresh the document.";
                                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                        },
                                        std::to_string(newVersionId), std::to_string(docId));
                            },
                            [=](const std::string& message, drogon::HttpStatusCode code) {
                                ResponseUtils::sendError(*callbackPtr, message, code);
                            });
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(versionId), std::to_string(docId));
    });
}

// 获取版本差异
void DocumentController::getVersionDiff(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.size() < 2) {
        ResponseUtils::sendError(callback, "Document ID and Version ID are required", k400BadRequest);
        return;
    }
    int docId, versionId;
    try {
        docId = std::stoi(routingParams[0]);
        versionId = std::stoi(routingParams[1]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID or version ID", k400BadRequest);
        return;
    }

    // 2. 获取查询参数（可选：base_version_id，如果不提供则与当前版本比较）
    std::string baseVersionIdStr = req->getParameter("base_version_id");
    int baseVersionId = 0;
    if (!baseVersionIdStr.empty()) {
        try {
            baseVersionId = std::stoi(baseVersionIdStr);
        } catch (...) {
        }
    }

    // 3. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 4. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 5. 获取目标版本内容
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT content_text, content_html FROM document_version WHERE id = $1::bigint AND doc_id = $2::bigint",
                [=](const drogon::orm::Result& targetResult) {
                    if (targetResult.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Version not found", k404NotFound);
                        return;
                    }

                    std::string targetText =
                            ensurePlainText(targetResult[0]["content_text"].isNull()
                                                    ? ""
                                                    : targetResult[0]["content_text"].as<std::string>(),
                                            targetResult[0]["content_html"].isNull()
                                                    ? ""
                                                    : targetResult[0]["content_html"].as<std::string>());

                    // 6. 获取基础版本内容
                    if (baseVersionId > 0) {
                        db->execSqlAsync(
                                "SELECT content_text, content_html FROM document_version WHERE id = $1::bigint AND "
                                "doc_id = "
                                "$2::bigint",
                                [=](const drogon::orm::Result& baseResult) {
                                    if (baseResult.empty()) {
                                        ResponseUtils::sendError(*callbackPtr, "Base version not found", k404NotFound);
                                        return;
                                    }

                                    std::string baseText =
                                            ensurePlainText(baseResult[0]["content_text"].isNull()
                                                                    ? ""
                                                                    : baseResult[0]["content_text"].as<std::string>(),
                                                            baseResult[0]["content_html"].isNull()
                                                                    ? ""
                                                                    : baseResult[0]["content_html"].as<std::string>());

                                    // 7. 计算差异
                                    auto segments = DiffUtils::computeLineDiff(baseText, targetText);
                                    Json::Value responseJson;
                                    responseJson["base_version_id"] = baseVersionId;
                                    responseJson["target_version_id"] = versionId;
                                    responseJson["diff"] = DiffUtils::segmentsToJson(segments);
                                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                                },
                                [=](const drogon::orm::DrogonDbException& e) {
                                    ResponseUtils::sendError(*callbackPtr,
                                                             "Database error: " + std::string(e.base().what()),
                                                             k500InternalServerError);
                                },
                                std::to_string(baseVersionId), std::to_string(docId));
                    } else {
                        // 与当前版本比较（获取最新的版本）
                        db->execSqlAsync(
                                "SELECT content_text, content_html FROM document_version WHERE doc_id = $1::bigint "
                                "ORDER BY version_number DESC LIMIT 1",
                                [=](const drogon::orm::Result& currentResult) {
                                    std::string baseText = ensurePlainText(
                                            currentResult.empty() || currentResult[0]["content_text"].isNull()
                                                    ? ""
                                                    : currentResult[0]["content_text"].as<std::string>(),
                                            currentResult.empty() || currentResult[0]["content_html"].isNull()
                                                    ? ""
                                                    : currentResult[0]["content_html"].as<std::string>());

                                    // 计算差异
                                    auto segments = DiffUtils::computeLineDiff(baseText, targetText);
                                    Json::Value responseJson;
                                    responseJson["base_version_id"] = Json::Value::null;
                                    responseJson["target_version_id"] = versionId;
                                    responseJson["diff"] = DiffUtils::segmentsToJson(segments);
                                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                                },
                                [=](const drogon::orm::DrogonDbException& e) {
                                    ResponseUtils::sendError(*callbackPtr,
                                                             "Database error: " + std::string(e.base().what()),
                                                             k500InternalServerError);
                                },
                                std::to_string(docId));
                    }
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(versionId), std::to_string(docId));
    });
}
// ========== 文档导入导出功能实现 ==========

// 辅助函数：从配置文件获取 doc-converter-service URL
static std::string getConverterServiceUrl() {
    std::ifstream configFile("config.json");
    if (!configFile.is_open()) {
        configFile.open("../config.json");
        if (!configFile.is_open()) {
            return "http://localhost:3002";  // 默认值
        }
    }

    Json::Value config;
    Json::Reader reader;
    if (reader.parse(configFile, config) && config.isMember("app")) {
        if (config["app"].isMember("doc_converter_url")) {
            return config["app"]["doc_converter_url"].asString();
        }
    }
    return "http://localhost:3002";  // 默认值
}

// Markdown 文档导入（支持文件上传和 JSON 文本两种方式）
void DocumentController::importMarkdown(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    std::string markdown;
    std::string title;

    // 检查是否是文件上传（multipart/form-data）
    drogon::MultiPartParser parser;
    bool isFileUpload = (parser.parse(req) == 0 && !parser.getFiles().empty());

    if (isFileUpload) {
        // 文件上传方式
        const auto& files = parser.getFiles();
        const auto& file = files.front();

        // 验证文件类型
        std::string fileName = file.getFileName();
        if (fileName.find(".md") == std::string::npos && fileName.find(".markdown") == std::string::npos) {
            ResponseUtils::sendError(callback, "Invalid file type. Please upload a .md or .markdown file",
                                     k400BadRequest);
            return;
        }

        // 检查文件大小（50MB限制）
        size_t fileSize = file.fileLength();
        if (fileSize > 50 * 1024 * 1024) {
            ResponseUtils::sendError(callback, "File size exceeds 50MB limit", k400BadRequest);
            return;
        }

        // 读取文件内容
        const char* fileData = file.fileData();
        markdown = std::string(fileData, fileSize);

        // 从文件名提取标题（去掉扩展名）
        title = fileName;
        size_t dotPos = title.find_last_of('.');
        if (dotPos != std::string::npos) {
            title = title.substr(0, dotPos);
        }
        if (title.empty()) {
            title = "Imported Markdown";
        }
    } else {
        // JSON 文本方式（原有逻辑）
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(callback,
                                     "Invalid request. Please provide markdown content in JSON or upload a .md file",
                                     k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        if (!json.isMember("markdown")) {
            ResponseUtils::sendError(callback, "markdown content is required", k400BadRequest);
            return;
        }

        markdown = json["markdown"].asString();
        title = json.get("title", "Imported Markdown").asString();
    }

    if (markdown.empty()) {
        ResponseUtils::sendError(callback, "Markdown content is empty", k400BadRequest);
        return;
    }

    std::string converterUrl = getConverterServiceUrl();
    auto client = drogon::HttpClient::newHttpClient(converterUrl);
    auto converterReq = drogon::HttpRequest::newHttpRequest();
    converterReq->setMethod(drogon::Post);
    converterReq->setPath("/convert/markdown-to-html");
    converterReq->setContentTypeCode(drogon::CT_APPLICATION_JSON);

    Json::Value converterPayload;
    converterPayload["markdown"] = markdown;
    Json::StreamWriterBuilder builder;
    converterReq->setBody(Json::writeString(builder, converterPayload));

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    client->sendRequest(converterReq, [=](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            std::string errorMsg =
                    "Failed to connect to converter service: " + std::to_string(static_cast<int>(result));
            std::cerr << "Markdown import: Failed to connect to converter service. Result: " << static_cast<int>(result)
                      << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }
        if (resp->getStatusCode() != k200OK) {
            std::string errorMsg = "Converter service returned error: " + std::to_string(resp->getStatusCode());
            std::string responseBody;
            if (resp->getBody().size() > 0) {
                responseBody = std::string(resp->getBody().data(), resp->getBody().size());
                errorMsg += " - " + responseBody.substr(0, 500);
            }
            std::cerr << "Markdown import: Converter service error. Status: " << resp->getStatusCode()
                      << ", Body: " << responseBody << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        auto jsonPtr = resp->getJsonObject();
        if (!jsonPtr) {
            std::string errorMsg = "Invalid JSON response from converter service";
            if (resp->getBody().size() > 0) {
                errorMsg += ": " + std::string(resp->getBody().data(), std::min(resp->getBody().size(), size_t(200)));
            }
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (jsonPtr->isMember("error")) {
            std::string errorMsg = "Conversion failed: " + (*jsonPtr)["error"].asString();
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (!jsonPtr->isMember("html")) {
            ResponseUtils::sendError(*callbackPtr, "Invalid conversion response: missing 'html' field",
                                     k500InternalServerError);
            return;
        }

        std::string html = (*jsonPtr)["html"].asString();

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "INSERT INTO document (title, owner_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) "
                "RETURNING id",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create document", k500InternalServerError);
                        return;
                    }
                    int docId = r[0]["id"].as<int>();

                    // 为导入的文档创建版本，使用占位符值
                    std::string placeholderUrl = "import://markdown/" + std::to_string(docId);
                    std::string placeholderSha256 = "0000000000000000000000000000000000000000000000000000000000000000";
                    int64_t contentSize = static_cast<int64_t>(html.length());

                    db->execSqlAsync(
                            "INSERT INTO document_version (doc_id, version_number, snapshot_url, snapshot_sha256, "
                            "size_bytes, content_html, created_by, source, created_at) "
                            "VALUES ($1, 1, $2, $3, $4, $5, $6, 'import', NOW()) RETURNING id",
                            [=](const drogon::orm::Result& r) {
                                if (r.empty()) {
                                    ResponseUtils::sendError(*callbackPtr, "Failed to create version",
                                                             k500InternalServerError);
                                    return;
                                }
                                int versionId = r[0]["id"].as<int>();

                                // 更新文档的 last_published_version_id
                                db->execSqlAsync(
                                        "UPDATE document SET last_published_version_id = $1::bigint, updated_at = "
                                        "NOW() "
                                        "WHERE id = $2::bigint",
                                        [=](const drogon::orm::Result&) {
                                            // 将导入的文档索引到 Meilisearch
                                            SearchService::indexDocument(docId, title,
                                                                         markdown.empty() ? title : markdown);
                                            Json::Value responseJson;
                                            responseJson["id"] = docId;
                                            responseJson["title"] = title;
                                            responseJson["message"] = "Document imported successfully";
                                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                        },
                                        [=](const drogon::orm::DrogonDbException& e) {
                                            ResponseUtils::sendError(*callbackPtr,
                                                                     "Database error: " + std::string(e.base().what()),
                                                                     k500InternalServerError);
                                        },
                                        std::to_string(versionId), std::to_string(docId));
                            },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            std::to_string(docId), placeholderUrl, placeholderSha256, std::to_string(contentSize), html,
                            std::to_string(userId));
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                title, std::to_string(userId));
    });
}

// Word 文档导出
void DocumentController::exportWord(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT d.title, dv.content_html, dv.content_text "
                "FROM document d "
                "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
                "WHERE d.id = $1",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                        return;
                    }

                    std::string title = r[0]["title"].as<std::string>();
                    std::string html = r[0]["content_html"].isNull() ? "" : r[0]["content_html"].as<std::string>();
                    std::string text = r[0]["content_text"].isNull() ? "" : r[0]["content_text"].as<std::string>();
                    std::string content = html.empty() ? text : html;

                    // 混合方案：如果内容为空，尝试从其他版本获取
                    if (content.empty()) {
                        // 查询其他版本，按版本号降序，找到第一个有内容的版本
                        db->execSqlAsync(
                                "SELECT content_html, content_text "
                                "FROM document_version "
                                "WHERE doc_id = $1 AND (content_html IS NOT NULL OR content_text IS NOT NULL) "
                                "ORDER BY version_number DESC "
                                "LIMIT 1",
                                [=](const drogon::orm::Result& versionResult) {
                                    // 在 lambda 内部创建局部变量，避免引用外部变量导致的生命周期问题
                                    std::string extractedContent;

                                    if (!versionResult.empty()) {
                                        std::string versionHtml =
                                                versionResult[0]["content_html"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_html"].as<std::string>();
                                        std::string versionText =
                                                versionResult[0]["content_text"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_text"].as<std::string>();
                                        extractedContent = versionHtml.empty() ? versionText : versionHtml;
                                    }

                                    if (extractedContent.empty()) {
                                        ResponseUtils::sendError(*callbackPtr,
                                                                 "Document content is empty. Please save the document "
                                                                 "first to generate exportable content.",
                                                                 k400BadRequest);
                                        return;
                                    }

                                    // 继续导出流程，使用局部变量
                                    proceedWithWordExport(callbackPtr, title, extractedContent);
                                },
                                [=](const drogon::orm::DrogonDbException& e) {
                                    ResponseUtils::sendError(*callbackPtr,
                                                             "Database error: " + std::string(e.base().what()),
                                                             k500InternalServerError);
                                },
                                std::to_string(docId));
                        return;
                    }

                    // 内容不为空，直接导出
                    proceedWithWordExport(callbackPtr, title, content);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
    });
}

// 辅助函数：执行 Word 导出
static void proceedWithWordExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                  const std::string& title, const std::string& content) {
    std::string converterUrl = getConverterServiceUrl();
    auto client = drogon::HttpClient::newHttpClient(converterUrl);
    auto converterReq = drogon::HttpRequest::newHttpRequest();
    converterReq->setMethod(drogon::Post);
    converterReq->setPath("/convert/html-to-word");
    converterReq->setContentTypeCode(drogon::CT_APPLICATION_JSON);

    Json::Value converterPayload;
    converterPayload["html"] = content;
    converterPayload["title"] = title;
    Json::StreamWriterBuilder builder;
    converterReq->setBody(Json::writeString(builder, converterPayload));

    client->sendRequest(converterReq, [=](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            std::string errorMsg =
                    "Failed to connect to converter service: " + std::to_string(static_cast<int>(result));
            std::cerr << "Word export: Failed to connect to converter service. Result: " << static_cast<int>(result)
                      << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }
        if (resp->getStatusCode() != k200OK) {
            std::string errorMsg = "Converter service returned error: " + std::to_string(resp->getStatusCode());
            std::string responseBody;
            if (resp->getBody().size() > 0) {
                responseBody = std::string(resp->getBody().data(), resp->getBody().size());
                errorMsg += " - " + responseBody.substr(0, 500);
            }
            std::cerr << "Word export: Converter service error. Status: " << resp->getStatusCode()
                      << ", Body: " << responseBody << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        auto jsonPtr = resp->getJsonObject();
        if (!jsonPtr) {
            std::string errorMsg = "Invalid JSON response from converter service";
            if (resp->getBody().size() > 0) {
                errorMsg += ": " + std::string(resp->getBody().data(), std::min(resp->getBody().size(), size_t(200)));
            }
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (jsonPtr->isMember("error")) {
            std::string errorMsg = "Conversion failed: " + (*jsonPtr)["error"].asString();
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (!jsonPtr->isMember("data")) {
            ResponseUtils::sendError(*callbackPtr, "Invalid conversion response: missing 'data' field",
                                     k500InternalServerError);
            return;
        }

        std::string base64 = (*jsonPtr)["data"].asString();
        std::string filename = (*jsonPtr).get("filename", title + ".docx").asString();

        Json::Value responseJson;
        responseJson["data"] = base64;
        responseJson["filename"] = filename;
        responseJson["mime_type"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        auto fileResp = HttpResponse::newHttpJsonResponse(responseJson);
        fileResp->setStatusCode(k200OK);
        (*callbackPtr)(fileResp);
    });
}

// PDF 文档导出
void DocumentController::exportPdf(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT d.title, dv.content_text, dv.content_html "
                "FROM document d "
                "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
                "WHERE d.id = $1",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                        return;
                    }

                    std::string title = r[0]["title"].as<std::string>();
                    std::string text = r[0]["content_text"].isNull() ? "" : r[0]["content_text"].as<std::string>();
                    std::string html = r[0]["content_html"].isNull() ? "" : r[0]["content_html"].as<std::string>();

                    // 优先使用 content_text，如果为空则从 HTML 中提取纯文本
                    std::string content = text;
                    if (content.empty() && !html.empty()) {
                        // 简单移除HTML标签提取纯文本
                        std::string plainText = html;
                        size_t pos = 0;
                        while ((pos = plainText.find('<')) != std::string::npos) {
                            size_t end = plainText.find('>', pos);
                            if (end != std::string::npos) {
                                plainText.erase(pos, end - pos + 1);
                            } else {
                                break;
                            }
                        }
                        // 清理多余的空白字符
                        while ((pos = plainText.find("  ")) != std::string::npos) {
                            plainText.replace(pos, 2, " ");
                        }
                        while ((pos = plainText.find("\n\n\n")) != std::string::npos) {
                            plainText.replace(pos, 3, "\n\n");
                        }
                        content = plainText;
                    }

                    // 混合方案：如果内容为空，尝试从其他版本获取
                    if (content.empty()) {
                        // 查询其他版本，按版本号降序，找到第一个有内容的版本（包括 snapshot_url）
                        db->execSqlAsync(
                                "SELECT content_text, content_html, snapshot_url "
                                "FROM document_version "
                                "WHERE doc_id = $1 AND (content_html IS NOT NULL OR content_text IS NOT NULL OR "
                                "(snapshot_url IS NOT NULL AND snapshot_url NOT LIKE 'import://%')) "
                                "ORDER BY version_number DESC "
                                "LIMIT 1",
                                [=](const drogon::orm::Result& versionResult) {
                                    // 在 lambda 内部创建局部变量，避免引用外部变量导致的生命周期问题
                                    std::string extractedContent;

                                    if (!versionResult.empty()) {
                                        std::string versionText =
                                                versionResult[0]["content_text"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_text"].as<std::string>();
                                        std::string versionHtml =
                                                versionResult[0]["content_html"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_html"].as<std::string>();

                                        // 优先使用 text，如果为空则从 HTML 提取
                                        extractedContent = versionText;
                                        if (extractedContent.empty() && !versionHtml.empty()) {
                                            std::string plainText = versionHtml;
                                            size_t pos = 0;
                                            while ((pos = plainText.find('<')) != std::string::npos) {
                                                size_t end = plainText.find('>', pos);
                                                if (end != std::string::npos) {
                                                    plainText.erase(pos, end - pos + 1);
                                                } else {
                                                    break;
                                                }
                                            }
                                            while ((pos = plainText.find("  ")) != std::string::npos) {
                                                plainText.replace(pos, 2, " ");
                                            }
                                            while ((pos = plainText.find("\n\n\n")) != std::string::npos) {
                                                plainText.replace(pos, 3, "\n\n");
                                            }
                                            extractedContent = plainText;
                                        }

                                        // 如果 content_html 和 content_text 都为空，但 snapshot_url 存在，提示用户
                                        if (extractedContent.empty()) {
                                            std::string snapshotUrl =
                                                    versionResult[0]["snapshot_url"].isNull()
                                                            ? ""
                                                            : versionResult[0]["snapshot_url"].as<std::string>();
                                            if (!snapshotUrl.empty() && snapshotUrl.find("import://") != 0) {
                                                // Document needs to be saved once to generate exportable content
                                                ResponseUtils::sendError(*callbackPtr,
                                                                         "Document content is empty. Please open "
                                                                         "and save the document "
                                                                         "once to generate exportable content.",
                                                                         k400BadRequest);
                                                return;
                                            }
                                        }
                                    }

                                    if (extractedContent.empty()) {
                                        ResponseUtils::sendError(*callbackPtr,
                                                                 "Document content is empty. Please save the document "
                                                                 "first to generate exportable content.",
                                                                 k400BadRequest);
                                        return;
                                    }

                                    // 继续导出流程，使用局部变量
                                    proceedWithPdfExport(callbackPtr, title, extractedContent);
                                },
                                [=](const drogon::orm::DrogonDbException& e) {
                                    ResponseUtils::sendError(*callbackPtr,
                                                             "Database error: " + std::string(e.base().what()),
                                                             k500InternalServerError);
                                },
                                std::to_string(docId));
                        return;
                    }

                    // 内容不为空，直接导出
                    proceedWithPdfExport(callbackPtr, title, content);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
    });
}

// 辅助函数：执行 PDF 导出
static void proceedWithPdfExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                 const std::string& title, const std::string& content) {
    std::string converterUrl = getConverterServiceUrl();
    auto client = drogon::HttpClient::newHttpClient(converterUrl);
    auto converterReq = drogon::HttpRequest::newHttpRequest();
    converterReq->setMethod(drogon::Post);
    converterReq->setPath("/convert/text-to-pdf");
    converterReq->setContentTypeCode(drogon::CT_APPLICATION_JSON);

    Json::Value converterPayload;
    converterPayload["text"] = content;
    converterPayload["title"] = title;
    Json::StreamWriterBuilder builder;
    converterReq->setBody(Json::writeString(builder, converterPayload));

    client->sendRequest(converterReq, [=](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            std::string errorMsg =
                    "Failed to connect to converter service: " + std::to_string(static_cast<int>(result));
            std::cerr << "PDF export: Failed to connect to converter service. Result: " << static_cast<int>(result)
                      << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }
        if (resp->getStatusCode() != k200OK) {
            std::string errorMsg = "Converter service returned error: " + std::to_string(resp->getStatusCode());
            std::string responseBody;
            if (resp->getBody().size() > 0) {
                responseBody = std::string(resp->getBody().data(), resp->getBody().size());
                errorMsg += " - " + responseBody.substr(0, 500);
            }
            std::cerr << "PDF export: Converter service error. Status: " << resp->getStatusCode()
                      << ", Body: " << responseBody << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        auto jsonPtr = resp->getJsonObject();
        if (!jsonPtr) {
            std::string errorMsg = "Invalid JSON response from converter service";
            if (resp->getBody().size() > 0) {
                errorMsg += ": " + std::string(resp->getBody().data(), std::min(resp->getBody().size(), size_t(200)));
            }
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (jsonPtr->isMember("error")) {
            std::string errorMsg = "Conversion failed: " + (*jsonPtr)["error"].asString();
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (!jsonPtr->isMember("data")) {
            ResponseUtils::sendError(*callbackPtr, "Invalid conversion response: missing 'data' field",
                                     k500InternalServerError);
            return;
        }

        std::string base64 = (*jsonPtr)["data"].asString();
        std::string filename = (*jsonPtr).get("filename", title + ".pdf").asString();

        Json::Value responseJson;
        responseJson["data"] = base64;
        responseJson["filename"] = filename;
        responseJson["mime_type"] = "application/pdf";
        auto fileResp = HttpResponse::newHttpJsonResponse(responseJson);
        fileResp->setStatusCode(k200OK);
        (*callbackPtr)(fileResp);
    });
}

// 辅助函数：执行 Markdown 导出
static void proceedWithMarkdownExport(std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                      const std::string& title, const std::string& content) {
    std::string converterUrl = getConverterServiceUrl();
    auto client = drogon::HttpClient::newHttpClient(converterUrl);
    auto converterReq = drogon::HttpRequest::newHttpRequest();
    converterReq->setMethod(drogon::Post);
    converterReq->setPath("/convert/html-to-markdown");
    converterReq->setContentTypeCode(drogon::CT_APPLICATION_JSON);

    Json::Value converterPayload;
    converterPayload["html"] = content;
    Json::StreamWriterBuilder builder;
    converterReq->setBody(Json::writeString(builder, converterPayload));

    client->sendRequest(converterReq, [=](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            std::string errorMsg =
                    "Failed to connect to converter service: " + std::to_string(static_cast<int>(result));
            std::cerr << "Markdown export: Failed to connect to converter service. Result: " << static_cast<int>(result)
                      << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }
        if (resp->getStatusCode() != k200OK) {
            std::string errorMsg = "Converter service returned error: " + std::to_string(resp->getStatusCode());
            std::string responseBody;
            if (resp->getBody().size() > 0) {
                responseBody = std::string(resp->getBody().data(), resp->getBody().size());
                errorMsg += " - " + responseBody.substr(0, 500);
            }
            std::cerr << "Markdown export: Converter service error. Status: " << resp->getStatusCode()
                      << ", Body: " << responseBody << std::endl;
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        auto jsonPtr = resp->getJsonObject();
        if (!jsonPtr) {
            std::string errorMsg = "Invalid JSON response from converter service";
            if (resp->getBody().size() > 0) {
                errorMsg += ": " + std::string(resp->getBody().data(), std::min(resp->getBody().size(), size_t(200)));
            }
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (jsonPtr->isMember("error")) {
            std::string errorMsg = "Conversion failed: " + (*jsonPtr)["error"].asString();
            ResponseUtils::sendError(*callbackPtr, errorMsg, k500InternalServerError);
            return;
        }

        if (!jsonPtr->isMember("markdown")) {
            ResponseUtils::sendError(*callbackPtr, "Invalid conversion response: missing 'markdown' field",
                                     k500InternalServerError);
            return;
        }

        std::string markdown = (*jsonPtr)["markdown"].asString();
        std::string filename = title + ".md";

        Json::Value responseJson;
        responseJson["markdown"] = markdown;
        responseJson["filename"] = filename;
        responseJson["mime_type"] = "text/markdown";
        auto fileResp = HttpResponse::newHttpJsonResponse(responseJson);
        fileResp->setStatusCode(k200OK);
        (*callbackPtr)(fileResp);
    });
}

// Markdown 文档导出
void DocumentController::exportMarkdown(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT d.title, dv.content_html, dv.content_text "
                "FROM document d "
                "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
                "WHERE d.id = $1",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                        return;
                    }

                    std::string title = r[0]["title"].as<std::string>();
                    std::string html = r[0]["content_html"].isNull() ? "" : r[0]["content_html"].as<std::string>();
                    std::string text = r[0]["content_text"].isNull() ? "" : r[0]["content_text"].as<std::string>();
                    std::string content = html.empty() ? text : html;

                    // 混合方案：如果内容为空，尝试从其他版本获取
                    if (content.empty()) {
                        // 查询其他版本，按版本号降序，找到第一个有内容的版本
                        db->execSqlAsync(
                                "SELECT content_html, content_text "
                                "FROM document_version "
                                "WHERE doc_id = $1 AND (content_html IS NOT NULL OR content_text IS NOT NULL) "
                                "ORDER BY version_number DESC "
                                "LIMIT 1",
                                [=](const drogon::orm::Result& versionResult) {
                                    // 在 lambda 内部创建局部变量，避免引用外部变量导致的生命周期问题
                                    std::string extractedContent;

                                    if (!versionResult.empty()) {
                                        std::string versionHtml =
                                                versionResult[0]["content_html"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_html"].as<std::string>();
                                        std::string versionText =
                                                versionResult[0]["content_text"].isNull()
                                                        ? ""
                                                        : versionResult[0]["content_text"].as<std::string>();
                                        extractedContent = versionHtml.empty() ? versionText : versionHtml;

                                        // 如果 content_html 和 content_text 都为空，但 snapshot_url 存在，提示用户
                                        if (extractedContent.empty()) {
                                            std::string snapshotUrl =
                                                    versionResult[0]["snapshot_url"].isNull()
                                                            ? ""
                                                            : versionResult[0]["snapshot_url"].as<std::string>();
                                            if (!snapshotUrl.empty() && snapshotUrl.find("import://") != 0) {
                                                // Document needs to be saved once to generate exportable content
                                                ResponseUtils::sendError(*callbackPtr,
                                                                         "Document content is empty. Please open "
                                                                         "and save the document "
                                                                         "once to generate exportable content.",
                                                                         k400BadRequest);
                                                return;
                                            }
                                        }
                                    }

                                    if (extractedContent.empty()) {
                                        ResponseUtils::sendError(*callbackPtr,
                                                                 "Document content is empty. Please save the document "
                                                                 "first to generate exportable content.",
                                                                 k400BadRequest);
                                        return;
                                    }

                                    // 继续导出流程，使用局部变量
                                    proceedWithMarkdownExport(callbackPtr, title, extractedContent);
                                },
                                [=](const drogon::orm::DrogonDbException& e) {
                                    ResponseUtils::sendError(*callbackPtr,
                                                             "Database error: " + std::string(e.base().what()),
                                                             k500InternalServerError);
                                },
                                std::to_string(docId));
                        return;
                    }

                    // 内容不为空，直接导出
                    proceedWithMarkdownExport(callbackPtr, title, content);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
    });
}
