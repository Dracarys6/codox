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
    ADD_METHOD_TO(CollaborationController::saveSnapshotMetadata, "/api/collab/snapshot/{id}/save", Post,
                  "JwtAuthFilter");
    ADD_METHOD_TO(CollaborationController::uploadSnapshot, "/api/collab/upload/{id}", Post, "JwtAuthFilter");
    ADD_METHOD_TO(CollaborationController::downloadSnapshot, "/api/collab/snapshot/{id}/download", Get, "JwtAuthFilter");
    METHOD_LIST_END

    // 协作令牌生成接口
    void getToken(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 引导快照接口
    void getBootstrap(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 快照回调接口
    void handleSnapshot(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 快照上传接口（接收文件并上传到 MinIO）
    void uploadSnapshot(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 保存快照元数据接口（使用 JWT 认证，供前端调用）
    void saveSnapshotMetadata(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 下载快照文件接口（通过后端代理，避免签名问题）
    void downloadSnapshot(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};