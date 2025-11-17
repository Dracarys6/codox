#include "CollaborationController.h"

#include <json/json.h>
#include <unistd.h>  // for access()

#include <fstream>
#include <sstream>

#include "../utils/JwtUtil.h"
#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"

// 辅助函数：从配置文件读取配置值（直接读取配置文件）
static std::string getConfigValue(const std::string& key, const std::string& defaultValue = "") {
    std::string configPath = "config.json";
    if (access("config.json", F_OK) != 0) {
        configPath = "../config.json";
    }

    try {
        std::ifstream file(configPath);
        if (file.is_open()) {
            std::stringstream buffer;
            buffer << file.rdbuf();
            file.close();

            Json::Value root;
            Json::Reader reader;
            if (reader.parse(buffer.str(), root)) {
                if (root.isMember("app") && root["app"].isMember(key)) {
                    return root["app"][key].asString();
                }
            }
        }
    } catch (...) {
        // 忽略异常
    }

    return defaultValue;
}

// 辅助函数：从配置文件读取 webhook_token
static std::string getWebhookTokenFromConfig() { return getConfigValue("webhook_token", ""); }

void CollaborationController::getToken(const HttpRequestPtr& req,
                                       std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    /// 2.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    if (!json.isMember("doc_id")) {
        ResponseUtils::sendError(callback, "doc_id is required", k400BadRequest);
        return;
    }
    int docId = json["doc_id"].asInt();

    // 3.检查权限 (需要viewer或更高权限)
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4. 生成一次性协作令牌（有效期 1 小时）
        Json::Value payload;
        payload["doc_id"] = docId;
        payload["user_id"] = userId;
        payload["type"] = "collab";

        // 从配置获取 JWT secret
        std::string secret = getConfigValue("jwt_secret", "default-secret");

        std::string token = JwtUtil::generateToken(payload, secret, 3600);  // 1 小时

        // 5. 返回令牌
        Json::Value responseJson;
        responseJson["token"] = token;
        responseJson["expiresIn"] = 3600;
        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
    });
}

void CollaborationController::getBootstrap(const HttpRequestPtr& req,
                                           std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid Document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }  // 验证 userId 是否为有效数字
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.检查权限 (需要viewer或更高权限)
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.查询文档的最新发布版本
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k400BadRequest);
            return;
        }

        db->execSqlAsync(
                "SELECT dv.snapshot_url, dv.snapshot_sha256, dv.id as version_id "
                "FROM document d "
                "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
                "WHERE d.id = $1",
                [=](const drogon::orm::Result& r) {
                    if (r.empty() || r[0]["snapshot_url"].isNull()) {
                        // 没有快照,返回空
                        Json::Value responseJson;
                        responseJson["snapshot_url"] = Json::Value::null;
                        responseJson["sha256"] = Json::Value::null;
                        responseJson["version_id"] = Json::Value::null;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        return;
                    }
                    Json::Value responseJson;
                    responseJson["snapshot_url"] = r[0]["snapshot_url"].as<std::string>();
                    responseJson["sha256"] = r[0]["snapshot_sha256"].as<std::string>();
                    responseJson["version_id"] = r[0]["version_id"].as<int>();
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                    return;
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()));
                },
                docIdStr);
    });
}

void CollaborationController::handleSnapshot(const HttpRequestPtr& req,
                                             std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.验证 Webhook Token
    std::string webhookToken = req->getHeader("X-Webhook-Token");
    std::string expectedToken = getWebhookTokenFromConfig();

    if (webhookToken.empty() || expectedToken.empty() || webhookToken != expectedToken) {
        ResponseUtils::sendError(callback, "Invalid webhook token", k401Unauthorized);
        return;
    }

    // 2.获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    try {
        std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 3.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    if (!json.isMember("snapshot_url") || !json.isMember("sha256") || !json.isMember("size_bytes")) {
        ResponseUtils::sendError(callback, "Missing required fields", k400BadRequest);
        return;
    }

    std::string snapshotUrl = json["snapshot_url"].asString();
    std::string sha256 = json["sha256"].asString();
    int64_t sizeBytes = json["size_bytes"].asInt64();

    // 4.检查是否已存在相同 SHA256 的版本(幂等性)
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT id FROM document_version WHERE doc_id = $1 AND snapshot_sha256 = $2",
            [=](const drogon::orm::Result& r) {
                if (!r.empty()) {
                    // 已存在,返回现有版本 ID
                    Json::Value responseJson;
                    responseJson["version_id"] = r[0]["id"].as<int>();
                    responseJson["message"] = "Version already exists";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                    return;
                }

                // 5.插入新版本记录 (created_by 使用文档所有者)
                // 先获取文档所有者
                db->execSqlAsync(
                        "SELECT owner_id FROM document WHERE id = $1",
                        [=](const drogon::orm::Result& docResult) {
                            int ownerId = 1;  // 默认值
                            if (!docResult.empty()) {
                                ownerId = docResult[0]["owner_id"].as<int>();
                            }

                            // 插入新版本记录
                            db->execSqlAsync(
                                    "INSERT INTO document_version (doc_id, snapshot_url, snapshot_sha256, size_bytes, "
                                    "created_by)"
                                    "VALUES ($1, $2, $3, $4::bigint, $5::integer)"
                                    "RETURNING id",
                                    [=](const drogon::orm::Result& r) {
                                        if (r.empty()) {
                                            ResponseUtils::sendError(*callbackPtr, "Failed to create version",
                                                                     k500InternalServerError);
                                            return;
                                        }

                                        int versionId = r[0]["id"].as<int>();

                                        // 6.更新文档的 last_published_version_id
                                        db->execSqlAsync(
                                                "UPDATE document SET last_published_version_id = $1::bigint, "
                                                "updated_at = NOW()"
                                                "WHERE id = $2::integer",
                                                [=](const drogon::orm::Result&) {
                                                    Json::Value responseJson;
                                                    responseJson["version_id"] = versionId;
                                                    responseJson["message"] = "Snapshot saved successfully";
                                                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                                                },
                                                [=](const drogon::orm::DrogonDbException& e) {
                                                    ResponseUtils::sendError(
                                                            *callbackPtr,
                                                            "Database error: " + std::string(e.base().what()),
                                                            k500InternalServerError);
                                                },
                                                std::to_string(versionId), docIdStr);
                                    },
                                    [=](const drogon::orm::DrogonDbException& e) {
                                        ResponseUtils::sendError(*callbackPtr,
                                                                 "Database error: " + std::string(e.base().what()),
                                                                 k500InternalServerError);
                                    },
                                    docIdStr, snapshotUrl, sha256, std::to_string(sizeBytes), std::to_string(ownerId));
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr, sha256);
}