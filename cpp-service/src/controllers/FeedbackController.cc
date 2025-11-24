#include "FeedbackController.h"

#include <drogon/orm/DbClient.h>

#include <utility>

#include "../utils/ResponseUtils.h"

using drogon::orm::Result;

namespace {
template <typename SuccessCb, typename ErrorCb>
void execWithParams(const std::shared_ptr<drogon::orm::DbClient>& db, const std::string& sql,
                    const std::vector<std::string>& params, SuccessCb&& successCb, ErrorCb&& errorCb) {
    auto binder = (*db << sql);
    for (const auto& param : params) {
        binder << param;
    }
    binder >> std::forward<SuccessCb>(successCb);
    binder >> std::forward<ErrorCb>(errorCb);
}
}  // namespace

void FeedbackController::submitFeedback(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON body", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    std::string dimension = json.get("dimension", "general").asString();
    if (dimension.empty()) {
        dimension = "general";
    }
    if (dimension.size() > 100) {
        ResponseUtils::sendError(callback, "Dimension too long (max 100 chars)", k400BadRequest);
        return;
    }

    if (!json.isMember("score") || !json["score"].isInt()) {
        ResponseUtils::sendError(callback, "score field is required", k400BadRequest);
        return;
    }
    int score = json["score"].asInt();
    if (score < 1 || score > 5) {
        ResponseUtils::sendError(callback, "score must be between 1 and 5", k400BadRequest);
        return;
    }

    std::string comment = json.get("comment", "").asString();
    if (comment.size() > 2000) {
        ResponseUtils::sendError(callback, "comment too long (max 2000 chars)", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    db->execSqlAsync(
            "INSERT INTO user_feedback (user_id, dimension, score, comment) VALUES ($1, $2, $3, $4) "
            "RETURNING id, created_at",
            [=](const Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(callback, "Failed to record feedback", k500InternalServerError);
                    return;
                }
                Json::Value resp;
                resp["message"] = "Thanks for your feedback!";
                resp["feedback_id"] = r[0]["id"].as<int>();
                resp["created_at"] = r[0]["created_at"].as<std::string>();
                ResponseUtils::sendSuccess(callback, resp, k201Created);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(callback, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, dimension, std::to_string(score), comment);
}

void FeedbackController::getFeedbackStats(const HttpRequestPtr& req,
                                          std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(userId, callbackPtr, [=]() {
        std::string dimension = req->getParameter("dimension");
        std::string limitStr = req->getParameter("limit");
        int limit = 20;
        if (!limitStr.empty()) {
            try {
                limit = std::max(5, std::min(100, std::stoi(limitStr)));
            } catch (...) {
            }
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        std::string summarySql =
                "SELECT dimension, COUNT(*) AS responses, ROUND(AVG(score)::numeric, 2) AS avg_score "
                "FROM user_feedback "
                "WHERE ($1 = '' OR dimension = $1) "
                "GROUP BY dimension "
                "ORDER BY responses DESC";

        std::vector<std::string> summaryParams = {dimension};

        auto summaryCallback = [=](const Result& summaryResult) {
            Json::Value summary(Json::arrayValue);
            for (const auto& row : summaryResult) {
                Json::Value item;
                item["dimension"] = row["dimension"].as<std::string>();
                item["responses"] = row["responses"].as<int>();
                item["avg_score"] = row["avg_score"].as<double>();
                summary.append(item);
            }

            std::string recentSql =
                    "SELECT uf.id, uf.user_id, uf.dimension, uf.score, uf.comment, uf.created_at, "
                    "u.email, COALESCE(p.nickname, '') AS nickname "
                    "FROM user_feedback uf "
                    "LEFT JOIN \"user\" u ON u.id = uf.user_id "
                    "LEFT JOIN user_profile p ON p.user_id = u.id "
                    "WHERE ($1 = '' OR uf.dimension = $1) "
                    "ORDER BY uf.created_at DESC "
                    "LIMIT $2::integer";

            std::vector<std::string> recentParams = {dimension, std::to_string(limit)};

            auto recentCallback = [=](const Result& rows) {
                Json::Value recent(Json::arrayValue);
                for (const auto& row : rows) {
                    Json::Value item;
                    item["id"] = row["id"].as<int>();
                    item["user_id"] = row["user_id"].as<int>();
                    item["dimension"] = row["dimension"].as<std::string>();
                    item["score"] = row["score"].as<int>();
                    item["comment"] = row["comment"].isNull() ? "" : row["comment"].as<std::string>();
                    item["created_at"] = row["created_at"].as<std::string>();
                    item["email"] = row["email"].isNull() ? "" : row["email"].as<std::string>();
                    item["nickname"] = row["nickname"].as<std::string>();
                    recent.append(item);
                }

                Json::Value responseJson;
                responseJson["summary"] = summary;
                responseJson["recent"] = recent;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
            };

            auto recentError = [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            };

            execWithParams(db, recentSql, recentParams, recentCallback, recentError);
        };

        auto summaryError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        execWithParams(db, summarySql, summaryParams, summaryCallback, summaryError);
    });
}

bool FeedbackController::ensureAdmin(int userId, std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                                     std::function<void()> onSuccess) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(*callback, "Database not available", k500InternalServerError);
        return false;
    }
    db->execSqlAsync(
            "SELECT role FROM \"user\" WHERE id = $1",
            [=](const Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callback, "User not found", k404NotFound);
                    return;
                }
                if (r[0]["role"].as<std::string>() != "admin") {
                    ResponseUtils::sendError(*callback, "Admin privileges required", k403Forbidden);
                    return;
                }
                onSuccess();
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callback, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(userId));
    return true;
}
