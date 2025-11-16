#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

class CommentController : public drogon::HttpController<CommentController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(CommentController::getComments, "/api/docs/{id}/comments", Get, "JwtAuthFilter");
    ADD_METHOD_TO(CommentController::createComments, "/api/docs/{id}/comments", Post, "JwtAuthFilter");
    ADD_METHOD_TO(CommentController::deleteComments, "/api/comments/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    // 获取评论
    void getComments(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 创建评论
    void createComments(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // 删除评论
    void deleteComments(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};