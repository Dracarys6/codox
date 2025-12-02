#include "CollaborationController.h"

#include <json/json.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/evp.h>
#include <unistd.h>  // for access()

#include <ctime>
#include <fstream>
#include <sstream>
#include <vector>

#include "../utils/JwtUtil.h"
#include "../utils/MinIOClient.h"
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

    // 3.检查权限 (需要 viewer 或更高权限；编辑权限由前端控制只读/可写)
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
                "SELECT dv.snapshot_url, dv.snapshot_sha256, dv.id as version_id, dv.content_html, dv.content_text "
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
                    std::string snapshotUrl = r[0]["snapshot_url"].as<std::string>();

                    // 检查是否是导入占位符 URL (import://markdown/xxx)
                    if (snapshotUrl.find("import://") == 0) {
                        // 对于导入的文档，返回 content_html 让前端初始化
                        std::cerr << "Bootstrap: Found import placeholder URL: " << snapshotUrl
                                  << ", returning content_html for frontend initialization." << std::endl;
                        responseJson["snapshot_url"] = Json::Value::null;
                        responseJson["sha256"] = Json::Value::null;
                        responseJson["version_id"] = r[0]["version_id"].isNull()
                                                             ? Json::Value::null
                                                             : Json::Value(r[0]["version_id"].as<int>());
                        // 返回 content_html 和 content_text，让前端可以从 HTML 初始化
                        if (!r[0]["content_html"].isNull()) {
                            responseJson["content_html"] = r[0]["content_html"].as<std::string>();
                        }
                        if (!r[0]["content_text"].isNull()) {
                            responseJson["content_text"] = r[0]["content_text"].as<std::string>();
                        }
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        return;
                    }

                    // 返回代理 URL 而不是直接的 MinIO URL，避免签名问题
                    // 如果已经是代理 URL，直接返回；否则转换为代理 URL
                    if (snapshotUrl.find("/api/collab/snapshot/") != std::string::npos) {
                        responseJson["snapshot_url"] = snapshotUrl;
                    } else {
                        // 转换为代理 URL
                        responseJson["snapshot_url"] = "/api/collab/snapshot/" + docIdStr + "/download";
                    }
                    responseJson["sha256"] = r[0]["snapshot_sha256"].as<std::string>();
                    responseJson["version_id"] = r[0]["version_id"].as<int>();

                    // 优化：即使有快照 URL，也返回 content_html 和 content_text 作为后备方案
                    // 这样当快照文件无法访问时（例如恢复的旧版本），前端仍可以从 HTML 内容初始化
                    if (!r[0]["content_html"].isNull() && !r[0]["content_html"].as<std::string>().empty()) {
                        responseJson["content_html"] = r[0]["content_html"].as<std::string>();
                    }
                    if (!r[0]["content_text"].isNull() && !r[0]["content_text"].as<std::string>().empty()) {
                        responseJson["content_text"] = r[0]["content_text"].as<std::string>();
                    }

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

void CollaborationController::uploadSnapshot(const HttpRequestPtr& req,
                                             std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数 doc_id
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

    // 3. 检查权限（需要 editor 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4. 解析 JSON 请求体（包含 base64 编码的文件数据）
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        if (!json.isMember("data") || !json["data"].isString()) {
            ResponseUtils::sendError(*callbackPtr, "Missing 'data' field (base64 encoded file)", k400BadRequest);
            return;
        }

        std::string base64Data = json["data"].asString();
        std::string fileName = json.get("filename", "").asString();
        if (fileName.empty()) {
            // 生成默认文件名
            auto now = std::time(nullptr);
            char buffer[64];
            std::strftime(buffer, sizeof(buffer), "%Y%m%d%H%M%S", std::gmtime(&now));
            fileName = "snapshot-" + std::string(buffer) + ".bin";
        }

        // 5. Base64 解码（使用 OpenSSL）
        std::vector<char> buffer;
        BIO* bio = BIO_new_mem_buf(base64Data.c_str(), base64Data.length());
        BIO* b64 = BIO_new(BIO_f_base64());
        BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);  // 不处理换行符
        bio = BIO_push(b64, bio);

        // 分配缓冲区（base64 解码后大小约为原数据的 3/4）
        size_t decodedSize = (base64Data.length() * 3) / 4;
        buffer.resize(decodedSize);

        int decodedLen = BIO_read(bio, buffer.data(), decodedSize);
        BIO_free_all(bio);

        if (decodedLen <= 0) {
            ResponseUtils::sendError(*callbackPtr, "Invalid base64 data", k400BadRequest);
            return;
        }

        // 调整缓冲区大小到实际解码长度
        buffer.resize(decodedLen);

        // 6. 构建 MinIO 对象名称
        std::string objectName = "snapshots/doc-" + docIdStr + "/" + fileName;

        // 7. 上传到 MinIO
        MinIOClient::uploadFile(
                objectName, buffer.data(), buffer.size(), "application/octet-stream",
                [=](const std::string& url) {
                    // 上传成功，返回 URL
                    Json::Value responseJson;
                    responseJson["snapshot_url"] = url;
                    responseJson["message"] = "File uploaded successfully";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const std::string& error) {
                    // 上传失败
                    ResponseUtils::sendError(*callbackPtr, "Failed to upload to MinIO: " + error,
                                             k500InternalServerError);
                });
    });
}

void CollaborationController::saveSnapshotMetadata(const HttpRequestPtr& req,
                                                   std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    int docId;
    try {
        docId = std::stoi(docIdStr);
        if (docId <= 0) {
            ResponseUtils::sendError(callback, "Invalid document ID: must be positive", k400BadRequest);
            return;
        }
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取 user_id (由 JwtAuthFilter 设置)
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

    // 3.检查权限（需要 editor 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        if (!json.isMember("snapshot_url") || !json.isMember("sha256") || !json.isMember("size_bytes")) {
            ResponseUtils::sendError(*callbackPtr, "Missing required fields", k400BadRequest);
            return;
        }

        std::string snapshotUrl = json["snapshot_url"].asString();
        std::string sha256 = json["sha256"].asString();
        int64_t sizeBytes = json["size_bytes"].asInt64();

        std::string contentText;
        std::string contentHtml;
        if (json.isMember("content_text") && json["content_text"].isString()) {
            contentText = json["content_text"].asString();
        }
        if (json.isMember("content_html") && json["content_html"].isString()) {
            contentHtml = json["content_html"].asString();
        }

        // 5.检查是否已存在相同 SHA256 的版本(幂等性)
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

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

                    // 6.插入新版本记录 (created_by 使用当前用户)
                    db->execSqlAsync(
                            "INSERT INTO document_version (doc_id, snapshot_url, snapshot_sha256, size_bytes, "
                            "created_by, content_text, content_html, source) "
                            "VALUES ($1, $2, $3, $4::bigint, $5::integer, $6, $7, 'auto') "
                            "RETURNING id",
                            [=](const drogon::orm::Result& r) {
                                if (r.empty()) {
                                    ResponseUtils::sendError(*callbackPtr, "Failed to create version",
                                                             k500InternalServerError);
                                    return;
                                }

                                int versionId = r[0]["id"].as<int>();

                                // 7.更新文档的 last_published_version_id
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
                                            ResponseUtils::sendError(*callbackPtr,
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
                            docIdStr, snapshotUrl, sha256, std::to_string(sizeBytes), std::to_string(userId),
                            contentText, contentHtml);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                docIdStr, sha256);
    });
}

void CollaborationController::downloadSnapshot(const HttpRequestPtr& req,
                                               std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    int docId;
    try {
        docId = std::stoi(docIdStr);
        if (docId <= 0) {
            ResponseUtils::sendError(callback, "Invalid document ID: must be positive", k400BadRequest);
            return;
        }
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取 user_id (由 JwtAuthFilter 设置)
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

    // 3.检查权限（需要 viewer 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.查询文档的最新快照 URL
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT dv.snapshot_url "
                "FROM document d "
                "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
                "WHERE d.id = $1",
                [=](const drogon::orm::Result& r) {
                    if (r.empty() || r[0]["snapshot_url"].isNull()) {
                        ResponseUtils::sendError(*callbackPtr, "Snapshot not found", k404NotFound);
                        return;
                    }

                    std::string minioUrl = r[0]["snapshot_url"].as<std::string>();

                    // 5.从 MinIO URL 中提取 objectName
                    // URL 格式: http://localhost:9000/documents/snapshots/doc-123/filename.bin
                    std::string objectName;
                    size_t bucketPos = minioUrl.find("/documents/");
                    if (bucketPos != std::string::npos) {
                        // 提取 documents/ 之后的部分
                        objectName = minioUrl.substr(bucketPos + 11);  // 跳过 "/documents/"
                    } else {
                        // 如果 URL 格式不对，尝试其他方式
                        // 可能是相对路径或已经提取过的路径
                        if (minioUrl.find("snapshots/") != std::string::npos) {
                            // 已经是 snapshots/ 开头的路径
                            objectName = minioUrl;
                        } else {
                            // 尝试从完整 URL 中提取
                            size_t httpPos = minioUrl.find("://");
                            if (httpPos != std::string::npos) {
                                size_t pathStart = minioUrl.find('/', httpPos + 3);
                                if (pathStart != std::string::npos) {
                                    std::string path = minioUrl.substr(pathStart + 1);  // 跳过第一个 /
                                    size_t bucketSlash = path.find('/');
                                    if (bucketSlash != std::string::npos) {
                                        objectName = path.substr(bucketSlash + 1);  // 跳过 bucket 名称
                                    } else {
                                        objectName = path;
                                    }
                                }
                            }
                        }

                        if (objectName.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Invalid snapshot URL format: " + minioUrl,
                                                     k500InternalServerError);
                            return;
                        }
                    }

                    // 6.从 MinIO 下载文件
                    MinIOClient::downloadFile(
                            objectName,
                            [=](const std::vector<char>& data) {
                                // 下载成功，返回文件内容
                                auto resp = HttpResponse::newHttpResponse();
                                resp->setStatusCode(k200OK);
                                resp->setContentTypeCode(CT_APPLICATION_OCTET_STREAM);
                                resp->setBody(std::string(data.data(), data.size()));
                                // 添加安全响应头
                                resp->addHeader("X-Content-Type-Options", "nosniff");
                                resp->addHeader("Content-Disposition", "attachment");
                                (*callbackPtr)(resp);
                            },
                            [=](const std::string& error) {
                                // 下载失败
                                ResponseUtils::sendError(*callbackPtr, "Failed to download snapshot: " + error,
                                                         k500InternalServerError);
                            });
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                docIdStr);
    });
}