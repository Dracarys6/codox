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
    ADD_METHOD_TO(DocumentController::getVersions, "/api/docs/{id}/versions", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::getVersion, "/api/docs/{id}/versions/{versionId}", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::createVersion, "/api/docs/{id}/versions", Post, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::restoreVersion, "/api/docs/{id}/versions/{versionId}/restore", Post,
                  "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::getVersionDiff, "/api/docs/{id}/versions/{versionId}/diff", Get, "JwtAuthFilter");
    // 文档导入导出接口
    ADD_METHOD_TO(DocumentController::importWord, "/api/docs/import/word", Post, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::importPdf, "/api/docs/import/pdf", Post, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::importMarkdown, "/api/docs/import/markdown", Post, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::exportWord, "/api/docs/{id}/export/word", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::exportPdf, "/api/docs/{id}/export/pdf", Get, "JwtAuthFilter");
    ADD_METHOD_TO(DocumentController::exportMarkdown, "/api/docs/{id}/export/markdown", Get, "JwtAuthFilter");

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

    // 获取文档版本列表
    void getVersions(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 获取单个版本详情
    void getVersion(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 手动创建版本
    void createVersion(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 恢复版本
    void restoreVersion(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 获取版本差异
    void getVersionDiff(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 文档导入接口
    void importWord(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    void importPdf(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    void importMarkdown(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);

    // 文档导出接口
    void exportWord(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    void exportPdf(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
    void exportMarkdown(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback);
};