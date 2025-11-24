#include "AdminUserController.h"

#include <drogon/orm/DbClient.h>

#include <chrono>
#include <ctime>
#include <iomanip>
#include <memory>
#include <set>
#include <sstream>
#include <unordered_set>
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

constexpr int kMaxPageSize = 100;
constexpr int kMaxExportSize = 5000;
const std::unordered_set<std::string> kAllowedRoles = {"admin", "editor", "viewer"};
const std::unordered_set<std::string> kAllowedStatuses = {"active", "disabled", "suspended"};

std::string formatTimePoint(const std::chrono::system_clock::time_point& tp) {
    std::time_t tt = std::chrono::system_clock::to_time_t(tp);
    std::tm tm{};
    gmtime_r(&tt, &tm);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

std::string escapeCsv(const std::string& value) {
    bool needsQuote = value.find_first_of(",\"\n") != std::string::npos;
    if (!needsQuote) {
        return value;
    }
    std::string escaped = value;
    size_t pos = 0;
    while ((pos = escaped.find('"', pos)) != std::string::npos) {
        escaped.insert(pos, "\"");
        pos += 2;
    }
    return "\"" + escaped + "\"";
}
}  // namespace

void AdminUserController::listUsers(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string adminIdStr = req->getParameter("user_id");
    if (adminIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int adminId = std::stoi(adminIdStr);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(adminId, callbackPtr, [=]() {
        UserListOptions options;
        if (!parseUserListOptions(req, options, callbackPtr, false)) {
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        std::string countSql =
                "SELECT COUNT(*) AS total FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id " +
                options.whereClause;

        auto countCallback = [=](const Result& countResult) {
            int total = 0;
            if (!countResult.empty()) {
                total = countResult[0]["total"].as<int>();
            }

            std::string listSql =
                    "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.created_at, u.updated_at, "
                    "u.last_login_at, COALESCE(p.nickname, '') AS nickname, COALESCE(p.avatar_url, '') AS avatar_url, "
                    "COALESCE(p.bio, '') AS bio, COALESCE(doc_stats.doc_count, 0) AS document_count, "
                    "COALESCE(doc_stats.active_doc_count, 0) AS active_document_count, "
                    "COALESCE(comment_stats.comment_count, 0) AS comment_count, "
                    "COALESCE(task_stats.completed_tasks, 0) AS completed_tasks "
                    "FROM \"user\" u "
                    "LEFT JOIN user_profile p ON u.id = p.user_id "
                    "LEFT JOIN (SELECT owner_id, COUNT(*) AS doc_count, "
                    "                   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') "
                    "                       AS active_doc_count "
                    "            FROM document GROUP BY owner_id) doc_stats ON doc_stats.owner_id = u.id "
                    "LEFT JOIN (SELECT author_id, COUNT(*) AS comment_count FROM comment GROUP BY author_id) "
                    "            comment_stats ON comment_stats.author_id = u.id "
                    "LEFT JOIN (SELECT created_by, COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks "
                    "            FROM task GROUP BY created_by) task_stats ON task_stats.created_by = u.id " +
                    options.whereClause + " ORDER BY " + options.orderExpr + " " + options.orderDirection;

            int limitIndex = static_cast<int>(options.params.size()) + 1;
            int offsetIndex = limitIndex + 1;
            listSql += " LIMIT $" + std::to_string(limitIndex) + " OFFSET $" + std::to_string(offsetIndex);

            auto listParams = options.params;
            listParams.push_back(std::to_string(options.pageSize));
            listParams.push_back(std::to_string(options.offset));

            auto listCallback = [=](const Result& rows) {
                Json::Value responseJson;
                Json::Value users(Json::arrayValue);
                for (const auto& row : rows) {
                    users.append(buildUserJson(row));
                }
                responseJson["users"] = users;
                responseJson["total"] = total;
                responseJson["page"] = options.page;
                responseJson["page_size"] = options.pageSize;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
            };

            auto listError = [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            };

            execWithParams(db, listSql, listParams, listCallback, listError);
        };

        auto countError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        execWithParams(db, countSql, options.params, countCallback, countError);
    });
}

void AdminUserController::exportUsers(const HttpRequestPtr& req,
                                      std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string adminIdStr = req->getParameter("user_id");
    if (adminIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int adminId = std::stoi(adminIdStr);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(adminId, callbackPtr, [=]() {
        UserListOptions options;
        if (!parseUserListOptions(req, options, callbackPtr, true)) {
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        std::string listSql =
                "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.created_at, u.updated_at, "
                "u.last_login_at, COALESCE(p.nickname, '') AS nickname, COALESCE(p.avatar_url, '') AS avatar_url, "
                "COALESCE(p.bio, '') AS bio, COALESCE(doc_stats.doc_count, 0) AS document_count, "
                "COALESCE(doc_stats.active_doc_count, 0) AS active_document_count, "
                "COALESCE(comment_stats.comment_count, 0) AS comment_count, "
                "COALESCE(task_stats.completed_tasks, 0) AS completed_tasks "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "LEFT JOIN (SELECT owner_id, COUNT(*) AS doc_count, "
                "                   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') "
                "                       AS active_doc_count "
                "            FROM document GROUP BY owner_id) doc_stats ON doc_stats.owner_id = u.id "
                "LEFT JOIN (SELECT author_id, COUNT(*) AS comment_count FROM comment GROUP BY author_id) "
                "            comment_stats ON comment_stats.author_id = u.id "
                "LEFT JOIN (SELECT created_by, COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks "
                "            FROM task GROUP BY created_by) task_stats ON task_stats.created_by = u.id " +
                options.whereClause + " ORDER BY " + options.orderExpr + " " + options.orderDirection;

        int limitIndex = static_cast<int>(options.params.size()) + 1;
        listSql += " LIMIT $" + std::to_string(limitIndex);

        auto params = options.params;
        params.push_back(std::to_string(options.pageSize));

        auto listCallback = [=](const Result& rows) {
            std::ostringstream csv;
            csv << "ID,Email,Role,Status,Locked,Created At,Last Login,Documents,Active Documents,Comments,Completed "
                   "Tasks\n";
            for (const auto& row : rows) {
                csv << row["id"].as<int>() << ',' << escapeCsv(row["email"].as<std::string>()) << ','
                    << row["role"].as<std::string>() << ',' << row["status"].as<std::string>() << ','
                    << (row["is_locked"].as<bool>() ? "true" : "false") << ','
                    << escapeCsv(row["created_at"].as<std::string>()) << ','
                    << escapeCsv(row["last_login_at"].isNull() ? "" : row["last_login_at"].as<std::string>()) << ','
                    << row["document_count"].as<int>() << ',' << row["active_document_count"].as<int>() << ','
                    << row["comment_count"].as<int>() << ',' << row["completed_tasks"].as<int>() << '\n';
            }

            auto resp = HttpResponse::newHttpResponse();
            resp->setStatusCode(k200OK);
            resp->addHeader("Content-Type", "text/csv; charset=utf-8");
            resp->addHeader("Content-Disposition", "attachment; filename=\"users.csv\"");
            resp->setBody(csv.str());
            (*callbackPtr)(resp);
        };

        auto listError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        execWithParams(db, listSql, params, listCallback, listError);
    });
}

void AdminUserController::updateUserStatus(const HttpRequestPtr& req,
                                           std::function<void(const HttpResponsePtr&)>&& callback,
                                           const std::string& userIdPath) {
    std::string adminIdStr = req->getParameter("user_id");
    if (adminIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int adminId = std::stoi(adminIdStr);
    if (userIdPath.empty()) {
        ResponseUtils::sendError(callback, "User ID is required", k400BadRequest);
        return;
    }
    int targetUserId = std::stoi(userIdPath);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(adminId, callbackPtr, [=]() {
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON body", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        bool hasStatus = json.isMember("status");
        bool hasLocked = json.isMember("is_locked");
        bool hasRemark = json.isMember("remark");

        if (!hasStatus && !hasLocked && !hasRemark) {
            ResponseUtils::sendError(*callbackPtr, "Nothing to update", k400BadRequest);
            return;
        }

        std::vector<std::string> params;
        std::ostringstream setClause;
        setClause << "UPDATE \"user\" SET ";
        std::vector<std::string> assignments;

        if (hasStatus) {
            std::string status = json["status"].asString();
            if (kAllowedStatuses.find(status) == kAllowedStatuses.end()) {
                ResponseUtils::sendError(*callbackPtr, "Invalid status value", k400BadRequest);
                return;
            }
            assignments.push_back("status = $" + std::to_string(params.size() + 1));
            params.push_back(status);
        }

        if (hasLocked) {
            bool locked = json["is_locked"].asBool();
            assignments.push_back("is_locked = $" + std::to_string(params.size() + 1));
            params.push_back(locked ? "true" : "false");
        }

        if (hasRemark) {
            assignments.push_back("remark = $" + std::to_string(params.size() + 1));
            params.push_back(json["remark"].asString());
        }

        assignments.push_back("updated_at = NOW()");
        for (size_t i = 0; i < assignments.size(); i++) {
            if (i > 0) {
                setClause << ", ";
            }
            setClause << assignments[i];
        }
        setClause << " WHERE id = $" << std::to_string(params.size() + 1) << " RETURNING id";
        params.push_back(std::to_string(targetUserId));

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        auto updateCallback = [=](const Result& result) {
            if (result.empty()) {
                ResponseUtils::sendError(*callbackPtr, "User not found", k404NotFound);
                return;
            }

            Json::Value payload;
            if (json.isMember("status")) payload["status"] = json["status"];
            if (json.isMember("is_locked")) payload["is_locked"] = json["is_locked"];
            if (json.isMember("remark")) payload["remark"] = json["remark"];
            writeAuditLog(adminId, targetUserId, "update_status", payload);

            fetchUserDetail(targetUserId, callbackPtr, [=](const Json::Value& userJson) {
                Json::Value responseJson;
                responseJson["message"] = "User updated";
                responseJson["user"] = userJson;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
            });
        };

        auto updateError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        execWithParams(db, setClause.str(), params, updateCallback, updateError);
    });
}

void AdminUserController::updateUserRoles(const HttpRequestPtr& req,
                                          std::function<void(const HttpResponsePtr&)>&& callback,
                                          const std::string& userIdPath) {
    std::string adminIdStr = req->getParameter("user_id");
    if (adminIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int adminId = std::stoi(adminIdStr);
    if (userIdPath.empty()) {
        ResponseUtils::sendError(callback, "User ID is required", k400BadRequest);
        return;
    }
    int targetUserId = std::stoi(userIdPath);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(adminId, callbackPtr, [=]() {
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON body", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        std::string roleValue;
        if (json.isMember("role")) {
            roleValue = json["role"].asString();
        } else if (json.isMember("roles") && json["roles"].isArray() && json["roles"].size() > 0) {
            roleValue = json["roles"][0].asString();
        }

        if (roleValue.empty()) {
            ResponseUtils::sendError(*callbackPtr, "role or roles field is required", k400BadRequest);
            return;
        }

        if (kAllowedRoles.find(roleValue) == kAllowedRoles.end()) {
            ResponseUtils::sendError(*callbackPtr, "Invalid role value", k400BadRequest);
            return;
        }

        if (adminId == targetUserId && roleValue != "admin") {
            ResponseUtils::sendError(*callbackPtr, "Cannot remove own admin role", k400BadRequest);
            return;
        }

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "UPDATE \"user\" SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
                [=](const Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "User not found", k404NotFound);
                        return;
                    }

                    Json::Value payload;
                    payload["role"] = roleValue;
                    writeAuditLog(adminId, targetUserId, "update_role", payload);

                    fetchUserDetail(targetUserId, callbackPtr, [=](const Json::Value& userJson) {
                        Json::Value responseJson;
                        responseJson["message"] = "Role updated";
                        responseJson["user"] = userJson;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                    });
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                roleValue, std::to_string(targetUserId));
    });
}

void AdminUserController::getUserAnalytics(const HttpRequestPtr& req,
                                           std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string adminIdStr = req->getParameter("user_id");
    if (adminIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int adminId = std::stoi(adminIdStr);
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    ensureAdmin(adminId, callbackPtr, [=]() {
        auto now = std::chrono::system_clock::now();
        std::string toParam = req->getParameter("to");
        std::string fromParam = req->getParameter("from");
        if (toParam.empty()) {
            toParam = formatTimePoint(now);
        }
        if (fromParam.empty()) {
            auto fromDefault = now - std::chrono::hours(24 * 30);
            fromParam = formatTimePoint(fromDefault);
        }

        int limit = 20;
        std::string limitParam = req->getParameter("limit");
        if (!limitParam.empty()) {
            try {
                limit = std::max(5, std::min(50, std::stoi(limitParam)));
            } catch (...) {
            }
        }

        auto responseJson = std::make_shared<Json::Value>(Json::objectValue);
        (*responseJson)["range"]["from"] = fromParam;
        (*responseJson)["range"]["to"] = toParam;

        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        std::vector<std::string> rangeParams = {fromParam, toParam};

        std::string totalsSql =
                "SELECT "
                "  (SELECT COUNT(*) FROM document WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz) "
                "      AS documents_created, "
                "  (SELECT COUNT(*) FROM comment WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz) "
                "      AS comments_created, "
                "  (SELECT COUNT(*) FROM task WHERE status = 'done' "
                "      AND updated_at BETWEEN $1::timestamptz AND $2::timestamptz) AS tasks_completed, "
                "  (SELECT COUNT(*) FROM ("
                "       SELECT owner_id AS user_id FROM document WHERE created_at BETWEEN $1::timestamptz AND "
                "$2::timestamptz "
                "       UNION "
                "       SELECT author_id AS user_id FROM comment WHERE created_at BETWEEN $1::timestamptz AND "
                "$2::timestamptz "
                "       UNION "
                "       SELECT created_by AS user_id FROM task WHERE updated_at BETWEEN $1::timestamptz AND "
                "$2::timestamptz "
                "   ) AS activity) AS active_users";

        auto totalsCallback = [=](const Result& totalsResult) {
            if (!totalsResult.empty()) {
                Json::Value totals;
                totals["documents_created"] = totalsResult[0]["documents_created"].as<int>();
                totals["comments_created"] = totalsResult[0]["comments_created"].as<int>();
                totals["tasks_completed"] = totalsResult[0]["tasks_completed"].as<int>();
                totals["active_users"] = totalsResult[0]["active_users"].as<int>();
                (*responseJson)["totals"] = totals;
            }

            std::string topUserSql =
                    "SELECT u.id, u.email, u.role, COALESCE(up.nickname, '') AS nickname, "
                    "COALESCE(doc_counts.doc_count, 0) AS documents_created, "
                    "COALESCE(comment_counts.comment_count, 0) AS comments_created, "
                    "COALESCE(task_counts.completed_tasks, 0) AS tasks_completed, "
                    "u.last_login_at "
                    "FROM \"user\" u "
                    "LEFT JOIN user_profile up ON u.id = up.user_id "
                    "LEFT JOIN (SELECT owner_id, COUNT(*) AS doc_count "
                    "           FROM document WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz "
                    "           GROUP BY owner_id) doc_counts ON doc_counts.owner_id = u.id "
                    "LEFT JOIN (SELECT author_id, COUNT(*) AS comment_count "
                    "           FROM comment WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz "
                    "           GROUP BY author_id) comment_counts ON comment_counts.author_id = u.id "
                    "LEFT JOIN (SELECT created_by, COUNT(*) AS completed_tasks "
                    "           FROM task WHERE status = 'done' AND updated_at BETWEEN $1::timestamptz AND "
                    "$2::timestamptz "
                    "           GROUP BY created_by) task_counts ON task_counts.created_by = u.id "
                    "WHERE COALESCE(doc_counts.doc_count, 0) + COALESCE(comment_counts.comment_count, 0) + "
                    "      COALESCE(task_counts.completed_tasks, 0) > 0 "
                    "ORDER BY COALESCE(doc_counts.doc_count, 0) DESC, "
                    "         COALESCE(comment_counts.comment_count, 0) DESC "
                    "LIMIT $3::integer";

            auto userParams = rangeParams;
            userParams.push_back(std::to_string(limit));

            auto userCallback = [=](const Result& rows) {
                Json::Value topUsers(Json::arrayValue);
                for (const auto& row : rows) {
                    Json::Value item;
                    item["user_id"] = row["id"].as<int>();
                    item["email"] = row["email"].as<std::string>();
                    item["role"] = row["role"].as<std::string>();
                    item["nickname"] = row["nickname"].as<std::string>();
                    item["documents_created"] = row["documents_created"].as<int>();
                    item["comments_created"] = row["comments_created"].as<int>();
                    item["tasks_completed"] = row["tasks_completed"].as<int>();
                    if (!row["last_login_at"].isNull()) {
                        item["last_login_at"] = row["last_login_at"].as<std::string>();
                    }
                    topUsers.append(item);
                }
                (*responseJson)["top_users"] = topUsers;

                std::string roleSql =
                        "SELECT u.role, "
                        "COALESCE(SUM(doc_counts.doc_count), 0) AS documents_created, "
                        "COALESCE(SUM(comment_counts.comment_count), 0) AS comments_created, "
                        "COALESCE(SUM(task_counts.completed_tasks), 0) AS tasks_completed "
                        "FROM \"user\" u "
                        "LEFT JOIN (SELECT owner_id, COUNT(*) AS doc_count "
                        "           FROM document WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz "
                        "           GROUP BY owner_id) doc_counts ON doc_counts.owner_id = u.id "
                        "LEFT JOIN (SELECT author_id, COUNT(*) AS comment_count "
                        "           FROM comment WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz "
                        "           GROUP BY author_id) comment_counts ON comment_counts.author_id = u.id "
                        "LEFT JOIN (SELECT created_by, COUNT(*) AS completed_tasks "
                        "           FROM task WHERE status = 'done' AND updated_at BETWEEN $1::timestamptz AND "
                        "$2::timestamptz "
                        "           GROUP BY created_by) task_counts ON task_counts.created_by = u.id "
                        "GROUP BY u.role ORDER BY u.role";

                auto roleCallback = [=](const Result& roleRows) {
                    Json::Value roleStats(Json::arrayValue);
                    for (const auto& row : roleRows) {
                        Json::Value item;
                        item["role"] = row["role"].as<std::string>();
                        item["documents_created"] = row["documents_created"].as<int>();
                        item["comments_created"] = row["comments_created"].as<int>();
                        item["tasks_completed"] = row["tasks_completed"].as<int>();
                        roleStats.append(item);
                    }
                    (*responseJson)["role_breakdown"] = roleStats;
                    ResponseUtils::sendSuccess(*callbackPtr, *responseJson);
                };

                auto roleError = [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                };

                execWithParams(db, roleSql, rangeParams, roleCallback, roleError);
            };

            auto userError = [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            };

            execWithParams(db, topUserSql, userParams, userCallback, userError);
        };

        auto totalsError = [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        execWithParams(db, totalsSql, rangeParams, totalsCallback, totalsError);
    });
}

bool AdminUserController::ensureAdmin(int userId, std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
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
                std::string role = r[0]["role"].as<std::string>();
                if (role != "admin") {
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

bool AdminUserController::parseUserListOptions(const HttpRequestPtr& req, UserListOptions& options,
                                               std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                                               bool forExport) {
    int defaultPageSize = forExport ? 1000 : 20;
    int maxPageSize = forExport ? kMaxExportSize : kMaxPageSize;

    options.page = 1;
    std::string pageStr = req->getParameter("page");
    if (!pageStr.empty()) {
        try {
            options.page = std::max(1, std::stoi(pageStr));
        } catch (...) {
        }
    }

    options.pageSize = defaultPageSize;
    std::string sizeStr = req->getParameter("page_size");
    if (!sizeStr.empty()) {
        try {
            options.pageSize = std::max(1, std::min(maxPageSize, std::stoi(sizeStr)));
        } catch (...) {
        }
    }
    if (forExport) {
        options.page = 1;
    }
    options.offset = (options.page - 1) * options.pageSize;

    std::string keyword = req->getParameter("keyword");
    if (keyword.empty()) {
        keyword = req->getParameter("q");
    }
    std::string roleFilter = req->getParameter("role");
    std::string statusFilter = req->getParameter("status");
    std::string lockedFilter = req->getParameter("is_locked");

    std::string sortBy = req->getParameter("sort_by");
    std::string sortOrder = req->getParameter("sort_order");
    if (sortOrder != "asc" && sortOrder != "desc") {
        sortOrder = "desc";
    }

    if (sortBy == "last_login_at") {
        options.orderExpr = "u.last_login_at";
    } else if (sortBy == "document_count") {
        options.orderExpr = "COALESCE(doc_stats.doc_count, 0)";
    } else if (sortBy == "comment_count") {
        options.orderExpr = "COALESCE(comment_stats.comment_count, 0)";
    } else if (sortBy == "completed_tasks") {
        options.orderExpr = "COALESCE(task_stats.completed_tasks, 0)";
    } else {
        options.orderExpr = "u.created_at";
    }
    options.orderDirection = sortOrder == "asc" ? "ASC" : "DESC";

    std::ostringstream where;
    where << " WHERE 1=1 ";
    std::vector<std::string> params;
    int paramIndex = 1;

    if (!keyword.empty()) {
        std::string placeholder = "$" + std::to_string(paramIndex++);
        where << " AND (u.email ILIKE " << placeholder << " OR COALESCE(u.phone, '') ILIKE " << placeholder
              << " OR COALESCE(p.nickname, '') ILIKE " << placeholder << ")";
        params.push_back("%" + keyword + "%");
    }

    if (!roleFilter.empty()) {
        if (kAllowedRoles.find(roleFilter) == kAllowedRoles.end()) {
            ResponseUtils::sendError(*callback, "Invalid role filter", k400BadRequest);
            return false;
        }
        std::string placeholder = "$" + std::to_string(paramIndex++);
        where << " AND u.role = " << placeholder;
        params.push_back(roleFilter);
    }

    if (!statusFilter.empty()) {
        if (kAllowedStatuses.find(statusFilter) == kAllowedStatuses.end()) {
            ResponseUtils::sendError(*callback, "Invalid status filter", k400BadRequest);
            return false;
        }
        std::string placeholder = "$" + std::to_string(paramIndex++);
        where << " AND u.status = " << placeholder;
        params.push_back(statusFilter);
    }

    if (!lockedFilter.empty()) {
        bool locked = lockedFilter == "true" || lockedFilter == "1";
        std::string placeholder = "$" + std::to_string(paramIndex++);
        where << " AND u.is_locked = " << placeholder;
        params.push_back(locked ? "true" : "false");
    }

    options.whereClause = where.str();
    options.params = params;
    return true;
}

void AdminUserController::fetchUserDetail(int targetUserId,
                                          std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                                          std::function<void(const Json::Value&)> onSuccess) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(*callback, "Database not available", k500InternalServerError);
        return;
    }

    db->execSqlAsync(
            "SELECT u.id, u.email, u.role, u.status, u.is_locked, u.remark, u.created_at, u.updated_at, "
            "u.last_login_at, COALESCE(p.nickname, '') AS nickname, COALESCE(p.avatar_url, '') AS avatar_url, "
            "COALESCE(p.bio, '') AS bio, "
            "COALESCE(doc_stats.doc_count, 0) AS document_count, "
            "COALESCE(doc_stats.active_doc_count, 0) AS active_document_count, "
            "COALESCE(comment_stats.comment_count, 0) AS comment_count, "
            "COALESCE(task_stats.completed_tasks, 0) AS completed_tasks "
            "FROM \"user\" u "
            "LEFT JOIN user_profile p ON u.id = p.user_id "
            "LEFT JOIN (SELECT owner_id, COUNT(*) AS doc_count, "
            "                   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') AS active_doc_count "
            "            FROM document GROUP BY owner_id) doc_stats ON doc_stats.owner_id = u.id "
            "LEFT JOIN (SELECT author_id, COUNT(*) AS comment_count FROM comment GROUP BY author_id) comment_stats "
            "            ON comment_stats.author_id = u.id "
            "LEFT JOIN (SELECT created_by, COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks "
            "            FROM task GROUP BY created_by) task_stats ON task_stats.created_by = u.id "
            "WHERE u.id = $1",
            [=](const Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callback, "User not found", k404NotFound);
                    return;
                }
                onSuccess(buildUserJson(r[0]));
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callback, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(targetUserId));
}

void AdminUserController::writeAuditLog(int adminId, int targetUserId, const std::string& action,
                                        const Json::Value& payload) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        return;
    }
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "";
    std::string payloadStr = Json::writeString(builder, payload);

    db->execSqlAsync(
            "INSERT INTO admin_audit_log (admin_id, target_user_id, action, payload) VALUES ($1, $2, $3, $4)",
            [](const Result&) {},
            [](const drogon::orm::DrogonDbException& e) {
                LOG_ERROR << "Failed to write audit log: " << e.base().what();
            },
            std::to_string(adminId), std::to_string(targetUserId), action, payloadStr);
}

Json::Value AdminUserController::buildUserJson(const drogon::orm::Row& row) {
    Json::Value userJson;
    userJson["id"] = row["id"].as<int>();
    userJson["email"] = row["email"].as<std::string>();
    userJson["role"] = row["role"].as<std::string>();
    userJson["status"] = row["status"].as<std::string>();
    userJson["is_locked"] = row["is_locked"].as<bool>();
    if (!row["remark"].isNull()) {
        userJson["remark"] = row["remark"].as<std::string>();
    }
    userJson["created_at"] = row["created_at"].as<std::string>();
    userJson["updated_at"] = row["updated_at"].as<std::string>();
    if (!row["last_login_at"].isNull()) {
        userJson["last_login_at"] = row["last_login_at"].as<std::string>();
    }

    Json::Value profileJson;
    profileJson["nickname"] = row["nickname"].as<std::string>();
    profileJson["avatar_url"] = row["avatar_url"].as<std::string>();
    profileJson["bio"] = row["bio"].as<std::string>();
    userJson["profile"] = profileJson;

    Json::Value statsJson;
    statsJson["document_count"] = row["document_count"].as<int>();
    statsJson["active_document_count"] = row["active_document_count"].as<int>();
    statsJson["comment_count"] = row["comment_count"].as<int>();
    statsJson["completed_tasks"] = row["completed_tasks"].as<int>();
    userJson["stats"] = statsJson;

    return userJson;
}
