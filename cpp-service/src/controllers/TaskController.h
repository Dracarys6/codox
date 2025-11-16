#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>
using namespace drogon;

class TaskController : public drogon::HttpController<TaskController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(TaskController::getTasks, "/api/docs/{id}/tasks", Get, "JwtAuthFilter");
    ADD_METHOD_TO(TaskController::createTasks, "/api/docs/{id}/tasks", Post, "JwtAuthFilter");
    ADD_METHOD_TO(TaskController::updateTasks, "/api/tasks/{id}", Patch, "JwtAuthFilter");
    ADD_METHOD_TO(TaskController::deleteTasks, "/api/tasks/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    // 获取任务
    void getTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 创建任务
    void createTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 更新任务
    void updateTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 删除任务
    void deleteTasks(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 辅助函数：构建任务响应
    static void buildTaskResponse(const drogon::orm::Result& r,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr);
};