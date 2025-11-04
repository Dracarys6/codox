#include"UserController.h"
#include<drogon/drogon.h>
#include"../utils/ResponseUtils.h"

void UserController::getMe(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    //1.获取user_id (由过滤器设置)
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (const std::exception& e) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    //2.查询数据库
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 shared_ptr 包装 callback
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 使用字符串参数绑定，然后让 PostgreSQL 自动转换类型
    // 这解决了 Drogon 与 PostgreSQL 在整数参数绑定时的兼容性问题
    db->execSqlAsync(
        "SELECT u.id, u.email, u.role, p.nickname, p.avatar_url, p.bio "
        "FROM \"user\" u "
        "LEFT JOIN user_profile p ON u.id = p.user_id "
        "WHERE u.id = $1::integer",
        [=](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "User not found", k404NotFound);
                return;
            }

            Json::Value responseJson;
            responseJson["id"] = r[0]["id"].as<int>();
            responseJson["email"] = r[0]["email"].as<std::string>();
            responseJson["role"] = r[0]["role"].as<std::string>();
            
            // 构建嵌套的 profile 对象
            Json::Value profileJson;
            profileJson["nickname"] = r[0]["nickname"].isNull() ?
                "" : r[0]["nickname"].as<std::string>();
            profileJson["avatar_url"] = r[0]["avatar_url"].isNull() ?
                "" : r[0]["avatar_url"].as<std::string>();
            profileJson["bio"] = r[0]["bio"].isNull() ?
                "" : r[0]["bio"].as<std::string>();
            responseJson["profile"] = profileJson;

            ResponseUtils::sendSuccess(*callbackPtr, responseJson);
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            LOG_ERROR << "Database error in getMe: " << e.base().what();
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId)
    );
}

void UserController::updateMe(const HttpRequestPtr& req,
                              std::function<void(const HttpResponsePtr&)>&& callback) {
    //1.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (const std::exception& e) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    //2.解析请求体 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string nickname = json.get("nickname", "").asString();
    std::string bio = json.get("bio", "").asString();
    std::string avatarUrl = json.get("avatar_url", "").asString();

    //3.输入验证
    if (nickname.length() > 64) {
        ResponseUtils::sendError(callback, "Nickname too long (max 64 characters)", k400BadRequest);
        return;
    }

    //4.获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    //5.更新或插入用户资料
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
                ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                return;
            }
            
            db2->execSqlAsync(
                "SELECT u.id, u.email, u.role, p.nickname, p.avatar_url, p.bio "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "WHERE u.id = $1::integer",
                [=](const drogon::orm::Result& r2) mutable {
                    if (r2.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "User not found", k404NotFound);
                        return;
                    }

                    Json::Value responseJson;
                    responseJson["id"] = r2[0]["id"].as<int>();
                    responseJson["email"] = r2[0]["email"].as<std::string>();
                    responseJson["role"] = r2[0]["role"].as<std::string>();

                    Json::Value profileJson;
                    profileJson["nickname"] = r2[0]["nickname"].isNull() ?
                        "" : r2[0]["nickname"].as<std::string>();
                    profileJson["avatar_url"] = r2[0]["avatar_url"].isNull() ?
                        "" : r2[0]["avatar_url"].as<std::string>();
                    profileJson["bio"] = r2[0]["bio"].isNull() ?
                        "" : r2[0]["bio"].as<std::string>();

                    responseJson["profile"] = profileJson;

                    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(userId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId),
        nickname,
        avatarUrl,
        bio
    );
} 