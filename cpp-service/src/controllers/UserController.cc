#include "UserController.h"

#include <drogon/drogon.h>
#include <drogon/utils/Utilities.h>  // 用于 urlDecode

#include "../utils/ResponseUtils.h"

void UserController::getMe(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id (由过滤器设置)
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    try {
        std::stoi(userIdStr);
    } catch (const std::exception& e) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2.查询数据库
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用字符串参数绑定，然后让 PostgreSQL 自动转换类型
    // 这解决了 Drogon 与 PostgreSQL 在整数参数绑定时的兼容性问题
    db->execSqlAsync(
            "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.last_login_at, u.created_at, "
            "u.updated_at, p.nickname, p.avatar_url, p.bio "
            "FROM \"user\" u "
            "LEFT JOIN user_profile p ON u.id = p.user_id "
            "WHERE u.id = $1::integer",
            [=](const drogon::orm::Result& r) mutable {
                if (r.empty()) {
                    ResponseUtils::sendError(callback, "User not found", k404NotFound);
                    return;
                }

                Json::Value responseJson;
                responseJson["id"] = r[0]["id"].as<int>();
                responseJson["email"] = r[0]["email"].as<std::string>();
                responseJson["role"] = r[0]["role"].as<std::string>();
                responseJson["status"] = r[0]["status"].as<std::string>();
                responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                if (!r[0]["remark"].isNull()) {
                    responseJson["remark"] = r[0]["remark"].as<std::string>();
                }
                if (!r[0]["last_login_at"].isNull()) {
                    responseJson["last_login_at"] = r[0]["last_login_at"].as<std::string>();
                }
                responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();

                // 构建嵌套的 profile 对象
                Json::Value profileJson;
                profileJson["nickname"] = r[0]["nickname"].isNull() ? "" : r[0]["nickname"].as<std::string>();
                profileJson["avatar_url"] = r[0]["avatar_url"].isNull() ? "" : r[0]["avatar_url"].as<std::string>();
                profileJson["bio"] = r[0]["bio"].isNull() ? "" : r[0]["bio"].as<std::string>();
                responseJson["profile"] = profileJson;

                ResponseUtils::sendSuccess(callback, responseJson);
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                LOG_ERROR << "Database error in getMe: " << e.base().what();
                ResponseUtils::sendError(callback, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr);  // 直接使用 userIdStr
}

void UserController::updateMe(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    try {
        std::stoi(userIdStr);
    } catch (const std::exception& e) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2.解析请求体 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string nickname = json["nickname"].asString();
    std::string bio = json["bio"].asString();
    std::string avatarUrl = json["avatar_url"].asString();

    // 3.输入验证
    if (nickname.length() > 64) {
        ResponseUtils::sendError(callback, "Nickname too long (max 64 characters)", k400BadRequest);
        return;
    }

    // 4.获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 5.更新或插入用户资料
    db->execSqlAsync(
            "INSERT INTO user_profile (user_id, nickname, avatar_url, bio) "
            "VALUES ($1::integer, $2, $3, $4) "
            "ON CONFLICT (user_id) "
            "DO UPDATE SET "
            "    nickname = $2, "
            "    avatar_url = $3, "
            "    bio = $4 "
            "RETURNING user_id",
            [=](const drogon::orm::Result& r) mutable {
                // 重新查询完整信息
                auto db2 = drogon::app().getDbClient();
                if (!db2) {
                    ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
                    return;
                }

                db2->execSqlAsync(
                        "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.last_login_at, u.created_at, "
                        "u.updated_at, p.nickname, p.avatar_url, p.bio "
                        "FROM \"user\" u "
                        "LEFT JOIN user_profile p ON u.id = p.user_id "
                        "WHERE u.id = $1::integer",
                        [=](const drogon::orm::Result& r2) mutable {
                            if (r2.empty()) {
                                ResponseUtils::sendError(callback, "User not found", k404NotFound);
                                return;
                            }

                            Json::Value responseJson;
                            responseJson["id"] = r2[0]["id"].as<int>();
                            responseJson["email"] = r2[0]["email"].as<std::string>();
                            responseJson["role"] = r2[0]["role"].as<std::string>();
                            responseJson["status"] = r2[0]["status"].as<std::string>();
                            responseJson["is_locked"] = r2[0]["is_locked"].as<bool>();
                            if (!r2[0]["remark"].isNull()) {
                                responseJson["remark"] = r2[0]["remark"].as<std::string>();
                            }
                            if (!r2[0]["last_login_at"].isNull()) {
                                responseJson["last_login_at"] = r2[0]["last_login_at"].as<std::string>();
                            }
                            responseJson["created_at"] = r2[0]["created_at"].as<std::string>();
                            responseJson["updated_at"] = r2[0]["updated_at"].as<std::string>();

                            Json::Value profileJson;
                            profileJson["nickname"] =
                                    r2[0]["nickname"].isNull() ? "" : r2[0]["nickname"].as<std::string>();
                            profileJson["avatar_url"] =
                                    r2[0]["avatar_url"].isNull() ? "" : r2[0]["avatar_url"].as<std::string>();
                            profileJson["bio"] = r2[0]["bio"].isNull() ? "" : r2[0]["bio"].as<std::string>();

                            responseJson["profile"] = profileJson;

                            ResponseUtils::sendSuccess(callback, responseJson);
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(callback, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        userIdStr);
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(callback, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, nickname, avatarUrl, bio);
}

void UserController::searchUsers(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取搜索关键词
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
        ResponseUtils::sendError(callback, "Query parameter 'q' is required", drogon::k400BadRequest);
        return;
    }

    // 2.获取分页参数
    int page = 1;
    int pageSize = 20;

    // 获取 page 参数
    std::string pageStr = req->getParameter("page");
    if (pageStr.empty()) {
        // 尝试从查询字符串手动解析
        std::string queryString = req->query();
        if (!queryString.empty()) {
            size_t pos = queryString.find("page=");
            if (pos != std::string::npos) {
                size_t start = pos + 5;
                size_t end = queryString.find("&", start);
                if (end == std::string::npos) {
                    end = queryString.length();
                }
                pageStr = queryString.substr(start, end - start);
            }
        }
    }
    try {
        if (!pageStr.empty()) {
            page = std::max(1, std::stoi(pageStr));
        }
    } catch (...) {
    }

    // 获取 page_size 参数
    std::string pageSizeStr = req->getParameter("page_size");
    if (pageSizeStr.empty()) {
        // 尝试从查询字符串手动解析
        std::string queryString = req->query();
        if (!queryString.empty()) {
            size_t pos = queryString.find("page_size=");
            if (pos != std::string::npos) {
                size_t start = pos + 10;
                size_t end = queryString.find("&", start);
                if (end == std::string::npos) {
                    end = queryString.length();
                }
                pageSizeStr = queryString.substr(start, end - start);
            }
        }
    }
    try {
        if (!pageSizeStr.empty()) {
            pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
        }
    } catch (...) {
    }

    // 3.获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", drogon::k500InternalServerError);
        return;
    }

    // 4.构建搜索查询
    // 支持按用户ID、邮箱、昵称搜索
    std::string searchPattern = "%" + query + "%";
    int offset = (page - 1) * pageSize;

    // 检查查询是否为纯数字（用户ID搜索）
    bool isNumericQuery = false;
    int userIdQuery = 0;
    try {
        userIdQuery = std::stoi(query);
        isNumericQuery = true;
    } catch (...) {
        isNumericQuery = false;
    }

    // 先查询总数
    std::string countQuery;
    if (isNumericQuery) {
        // 如果是数字，同时匹配ID和文本字段
        countQuery =
                "SELECT COUNT(*) as total "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "WHERE u.id = $1::integer OR u.email ILIKE $2 OR COALESCE(p.nickname, '') ILIKE $2";
    } else {
        // 如果不是数字，只匹配文本字段
        countQuery =
                "SELECT COUNT(*) as total "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "WHERE u.email ILIKE $1 OR COALESCE(p.nickname, '') ILIKE $1";
    }

    // 创建 callback 的 shared_ptr 以便在 lambda 中使用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    auto countCallback = [=](const drogon::orm::Result& countResult) mutable {
        int total = 0;
        if (!countResult.empty()) {
            total = countResult[0]["total"].as<int>();
        }

        // 查询用户列表
        std::string listQuery;
        if (isNumericQuery) {
            listQuery =
                    "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.last_login_at, u.created_at, "
                    "u.updated_at, p.nickname, p.avatar_url, p.bio "
                    "FROM \"user\" u "
                    "LEFT JOIN user_profile p ON u.id = p.user_id "
                    "WHERE u.id = $1::integer OR u.email ILIKE $2 OR COALESCE(p.nickname, '') ILIKE $2 "
                    "ORDER BY u.id "
                    "LIMIT $3::integer OFFSET $4::integer";
        } else {
            listQuery =
                    "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.last_login_at, u.created_at, "
                    "u.updated_at, p.nickname, p.avatar_url, p.bio "
                    "FROM \"user\" u "
                    "LEFT JOIN user_profile p ON u.id = p.user_id "
                    "WHERE u.email ILIKE $1 OR COALESCE(p.nickname, '') ILIKE $1 "
                    "ORDER BY u.id "
                    "LIMIT $2::integer OFFSET $3::integer";
        }

        auto listCallback = [=](const drogon::orm::Result& r) mutable {
            Json::Value responseJson;
            Json::Value usersArray(Json::arrayValue);

            for (const auto& row : r) {
                Json::Value userJson;
                userJson["id"] = row["id"].as<int>();
                userJson["email"] = row["email"].as<std::string>();
                userJson["role"] = row["role"].as<std::string>();
                userJson["status"] = row["status"].as<std::string>();
                userJson["is_locked"] = row["is_locked"].as<bool>();
                if (!row["remark"].isNull()) {
                    userJson["remark"] = row["remark"].as<std::string>();
                }
                if (!row["last_login_at"].isNull()) {
                    userJson["last_login_at"] = row["last_login_at"].as<std::string>();
                }
                userJson["created_at"] = row["created_at"].as<std::string>();
                userJson["updated_at"] = row["updated_at"].as<std::string>();

                Json::Value profileJson;
                profileJson["nickname"] = row["nickname"].isNull() ? "" : row["nickname"].as<std::string>();
                profileJson["avatar_url"] = row["avatar_url"].isNull() ? "" : row["avatar_url"].as<std::string>();
                profileJson["bio"] = row["bio"].isNull() ? "" : row["bio"].as<std::string>();
                userJson["profile"] = profileJson;

                usersArray.append(userJson);
            }

            responseJson["users"] = usersArray;
            responseJson["total"] = total;
            responseJson["page"] = page;
            responseJson["page_size"] = pageSize;

            ResponseUtils::sendSuccess(*callbackPtr, responseJson);
        };

        auto listErrorCallback = [=](const drogon::orm::DrogonDbException& e) mutable {
            LOG_ERROR << "Database error in searchUsers: " << e.base().what();
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     drogon::k500InternalServerError);
        };

        if (isNumericQuery) {
            db->execSqlAsync(listQuery, listCallback, listErrorCallback, userIdQuery, searchPattern, pageSize, offset);
        } else {
            db->execSqlAsync(listQuery, listCallback, listErrorCallback, searchPattern, pageSize, offset);
        }
    };

    auto countErrorCallback = [=](const drogon::orm::DrogonDbException& e) mutable {
        LOG_ERROR << "Database error in searchUsers (count): " << e.base().what();
        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                 drogon::k500InternalServerError);
    };

    if (isNumericQuery) {
        db->execSqlAsync(countQuery, countCallback, countErrorCallback, userIdQuery, searchPattern);
    } else {
        db->execSqlAsync(countQuery, countCallback, countErrorCallback, searchPattern);
    }
}