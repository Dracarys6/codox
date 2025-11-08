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
    ADD_METHOD_TO(DocumentController::getById, "/api/docs/{id}", Get, "JwtAuthFilter");
    // TODO: 后续实现
    // ADD_METHOD_TO(DocumentController::update, "/api/docs/{id}", Patch, "JwtAuthFilter");
    // ADD_METHOD_TO(DocumentController::deleteDoc, "/api/docs/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    // 创建文档
    void create(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    // 获取文档列表
    void list(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    // 获取文档详情
    void getById(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    // TODO: 后续实现
    // void update(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    // void deleteDoc(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
};