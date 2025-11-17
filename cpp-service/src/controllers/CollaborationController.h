#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>
using namespace drogon;

// 协作后端接口
class CollaborationController : public drogon::HttpController<CollaborationController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(CollaborationController::getToken, "/api/collab/token", Post, "JwtAuthFilter");
    ADD_METHOD_TO(CollaborationController::getBootstrap, "/api/collab/bootstrap/{id}", Get, "JwtAuthFilter");
    ADD_METHOD_TO(CollaborationController::handleSnapshot, "/api/collab/snapshot/{id}", Post);
    METHOD_LIST_END

    // 协作令牌生成接口
    void getToken(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 引导快照接口
    void getBootstrap(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 快照回调接口
    void handleSnapshot(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};