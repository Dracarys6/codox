#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

class DocumentController : public drogon::HttpController<DocumentController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(DocumentController::create, "/api/docs", Post, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::list, "/api/docs", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::get, "/api/docs/{id}", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::update, "/api/docs/{id}", Patch, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::deleteDoc, "/api/docs/{id}", Delete, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::getAcl, "/api/docs/{id}/acl", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::updateAcl, "/api/docs/{id}/acl", Put, "JwtAuthFilter");

    METHOD_LIST_END

    // 创建文档
    void create(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 获取文档列表
    void list(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 获取文档详情
    void get(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 更新文档
    void update(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 删除文档
    void deleteDoc(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 获取文档acl(权限列表)
    void getAcl(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 更新文档acl
    void updateAcl(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
};