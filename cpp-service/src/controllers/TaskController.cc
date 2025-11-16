#include "TaskController.h"

#include <drogon/drogon.h>

#include <numeric>

#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"
using namespace drogon;

void TaskController::getTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4. 查询任务列表
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT t.id, t.doc_id, t.assignee_id, t.title, t.status, t.due_at, "
                "       t.created_by, t.created_at, t.updated_at, "
                "       u.email as assignee_email, up.nickname as assignee_nickname "
                "FROM task t "
                "LEFT JOIN \"user\" u ON t.assignee_id = u.id "
                "LEFT JOIN user_profile up ON u.id = up.user_id "
                "WHERE t.doc_id = $1::integer "
                "ORDER BY t.created_at DESC",
                [=](const drogon::orm::Result& r) {
                    Json::Value responseJson;
                    Json::Value tasksArray(Json::arrayValue);

                    for (const auto& row : r) {
                        Json::Value taskJson;
                        taskJson["id"] = row["id"].as<int>();
                        taskJson["doc_id"] = row["doc_id"].as<int>();
                        taskJson["title"] = row["title"].as<std::string>();
                        taskJson["status"] = row["status"].as<std::string>();
                        taskJson["created_at"] = row["created_at"].as<std::string>();
                        taskJson["updated_at"] = row["updated_at"].as<std::string>();

                        if (!row["assignee_id"].isNull()) {
                            taskJson["assignee_id"] = row["assignee_id"].as<int>();
                            Json::Value assigneeJson;
                            assigneeJson["id"] = row["assignee_id"].as<int>();
                            assigneeJson["email"] = row["assignee_email"].as<std::string>();
                            if (!row["assignee_nickname"].isNull()) {
                                assigneeJson["nickname"] = row["assignee_nickname"].as<std::string>();
                            }
                            taskJson["assignee"] = assigneeJson;
                        }

                        if (!row["due_at"].isNull()) {
                            taskJson["due_at"] = row["due_at"].as<std::string>();
                        }

                        taskJson["created_by"] = row["created_by"].as<int>();

                        tasksArray.append(taskJson);
                    }

                    responseJson["tasks"] = tasksArray;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
    });
}

void TaskController::createTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 检查权限（需要 editor 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only editor or owner can create tasks", k403Forbidden);
            return;
        }

        // 4. 解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        if (!json.isMember("title")) {
            ResponseUtils::sendError(*callbackPtr, "title is required", k400BadRequest);
            return;
        }

        std::string title = json["title"].asString();
        if (title.empty()) {
            ResponseUtils::sendError(*callbackPtr, "title cannot be empty", k400BadRequest);
            return;
        }

        // assignee_id 和 due_at 是可选的
        int assigneeId = -1;
        if (json.isMember("assignee_id") && !json["assignee_id"].isNull()) {
            assigneeId = json["assignee_id"].asInt();
        }

        std::string dueAt = "";
        if (json.isMember("due_at") && !json["due_at"].isNull()) {
            dueAt = json["due_at"].asString();
        }

        // 5. 插入任务
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        if (assigneeId > 0 && !dueAt.empty()) {
            db->execSqlAsync(
                    "INSERT INTO task (doc_id, assignee_id, title, due_at, created_by) "
                    "VALUES ($1::integer, $2::integer, $3, $4::timestamptz, $5::integer) "
                    "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                    [=](const drogon::orm::Result& r) { buildTaskResponse(r, callbackPtr); },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                 k500InternalServerError);
                    },
                    std::to_string(docId), std::to_string(assigneeId), title, dueAt, std::to_string(userId));
        } else if (assigneeId > 0) {
            db->execSqlAsync(
                    "INSERT INTO task (doc_id, assignee_id, title, created_by) "
                    "VALUES ($1::integer, $2::integer, $3, $4::integer) "
                    "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                    [=](const drogon::orm::Result& r) { buildTaskResponse(r, callbackPtr); },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                 k500InternalServerError);
                    },
                    std::to_string(docId), std::to_string(assigneeId), title, std::to_string(userId));
        } else {
            db->execSqlAsync(
                    "INSERT INTO task (doc_id, title, created_by) "
                    "VALUES ($1::integer, $2, $3::integer) "
                    "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                    [=](const drogon::orm::Result& r) { buildTaskResponse(r, callbackPtr); },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                 k500InternalServerError);
                    },
                    std::to_string(docId), title, std::to_string(userId));
        }
    });
}

void TaskController::updateTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Task ID is required", k400BadRequest);
        return;
    }
    int taskId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    // 4. 检查权限（必须是任务分配者、创建者或文档所有者）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT t.doc_id, t.assignee_id, t.created_by, d.owner_id "
            "FROM task t "
            "JOIN document d ON t.doc_id = d.id "
            "WHERE t.id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
                    return;
                }

                int assigneeId = r[0]["assignee_id"].isNull() ? -1 : r[0]["assignee_id"].as<int>();
                int createdBy = r[0]["created_by"].as<int>();
                int ownerId = r[0]["owner_id"].as<int>();

                if (userId != assigneeId && userId != createdBy && userId != ownerId) {
                    ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                    return;
                }

                // 5. 构建更新 SQL
                std::vector<std::string> updateFields;
                std::vector<std::string> updateValues;

                if (json.isMember("status")) {
                    std::string status = json["status"].asString();
                    if (status != "todo" && status != "doing" && status != "done") {
                        ResponseUtils::sendError(*callbackPtr, "Invalid status", k400BadRequest);
                        return;
                    }
                    updateFields.push_back("status = $" + std::to_string(updateFields.size() + 1));
                    updateValues.push_back(status);
                }

                if (json.isMember("title")) {
                    std::string title = json["title"].asString();
                    if (title.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "title cannot be empty", k400BadRequest);
                        return;
                    }
                    updateFields.push_back("title = $" + std::to_string(updateFields.size() + 1));
                    updateValues.push_back(title);
                }

                if (json.isMember("assignee_id")) {
                    int assigneeId = json["assignee_id"].asInt();
                    updateFields.push_back("assignee_id = $" + std::to_string(updateFields.size() + 1) + "::integer");
                    updateValues.push_back(std::to_string(assigneeId));
                }

                if (json.isMember("due_at")) {
                    std::string dueAt = json["due_at"].asString();
                    updateFields.push_back("due_at = $" + std::to_string(updateFields.size() + 1) + "::timestamptz");
                    updateValues.push_back(dueAt);
                }

                if (updateFields.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
                    return;
                }

                updateFields.push_back("updated_at = NOW()");

                // 6. 执行更新
                std::string sql =
                        "UPDATE task SET " +
                        std::accumulate(updateFields.begin(), updateFields.end(), std::string(),
                                        [](const std::string& a, const std::string& b) {
                                            return a.empty() ? b : a + ", " + b;
                                        }) +
                        " WHERE id = $" + std::to_string(updateFields.size() + 1) +
                        "::integer "
                        "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at";

                std::vector<std::string> params = updateValues;
                params.push_back(std::to_string(taskId));

                // 注意：这里需要根据参数数量动态构建 execSqlAsync 调用
                // 简化版本：只支持 status 更新
                if (json.isMember("status")) {
                    std::string status = json["status"].asString();
                    db->execSqlAsync(
                            "UPDATE task SET status = $1, updated_at = NOW() WHERE id = $2::integer "
                            "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, "
                            "updated_at",
                            [=](const drogon::orm::Result& r) { buildTaskResponse(r, callbackPtr); },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            status, std::to_string(taskId));
                }
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(taskId));
}

void TaskController::deleteTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Task ID is required", k400BadRequest);
        return;
    }
    int taskId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 检查权限（必须是创建者或文档所有者）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT t.created_by, d.owner_id "
            "FROM task t "
            "JOIN document d ON t.doc_id = d.id "
            "WHERE t.id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
                    return;
                }

                int createdBy = r[0]["created_by"].as<int>();
                int ownerId = r[0]["owner_id"].as<int>();

                if (userId != createdBy && userId != ownerId) {
                    ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                    return;
                }

                // 4. 删除任务
                db->execSqlAsync(
                        "DELETE FROM task WHERE id = $1::integer",
                        [=](const drogon::orm::Result&) {
                            Json::Value responseJson;
                            responseJson["message"] = "Task deleted successfully";
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        std::to_string(taskId));
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(taskId));
}

// 辅助函数：构建任务响应
void TaskController::buildTaskResponse(const drogon::orm::Result& r,
                                       std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    if (r.empty()) {
        ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
        return;
    }

    Json::Value taskJson;
    taskJson["id"] = r[0]["id"].as<int>();
    taskJson["doc_id"] = r[0]["doc_id"].as<int>();
    taskJson["title"] = r[0]["title"].as<std::string>();
    taskJson["status"] = r[0]["status"].as<std::string>();
    taskJson["created_at"] = r[0]["created_at"].as<std::string>();
    taskJson["updated_at"] = r[0]["updated_at"].as<std::string>();
    taskJson["created_by"] = r[0]["created_by"].as<int>();

    if (!r[0]["assignee_id"].isNull()) {
        taskJson["assignee_id"] = r[0]["assignee_id"].as<int>();
    }

    if (!r[0]["due_at"].isNull()) {
        taskJson["due_at"] = r[0]["due_at"].as<std::string>();
    }

    ResponseUtils::sendSuccess(*callbackPtr, taskJson, k200OK);
}
