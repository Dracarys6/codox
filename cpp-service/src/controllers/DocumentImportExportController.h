#pragma once
#include <drogon/HttpClient.h>
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <fstream>
#include <nlohmann/json.hpp>
using namespace drogon;
using json = nlohmann::json;

class DocumentImportExportController : public drogon::HttpController<DocumentImportExportController> {
public:
    METHOD_LIST_BEGIN
    // 导入接口
    METHOD_ADD(DocumentImportExportController::importWord, "/api/docs/import/word", Post, "JwtAuthFilter");
    METHOD_ADD(DocumentImportExportController::importPdf, "/api/docs/import/Pdf", Post, "JwtAuthFilter");
    METHOD_ADD(DocumentImportExportController::importMarkdown, "/api/docs/import/Markdown", Post, "JwtAuthFilter");

    // 导出接口
    METHOD_ADD(DocumentImportExportController::importWord, "/api/docs/export/word", Post, "JwtAuthFilter");
    METHOD_ADD(DocumentImportExportController::importPdf, "/api/docs/export/Pdf", Post, "JwtAuthFilter");
    METHOD_ADD(DocumentImportExportController::importMarkdown, "/api/docs/export/Markdown", Post, "JwtAuthFilter");
    METHOD_LIST_END

    // Word导入
    void importWord(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // Pdf导入
    void importPdf(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // Markdown导入
    void importMarkdown(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // Word导出
    void exportWord(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // Pdf导出
    void exportPdf(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    // Markdown导入
    void exportMarkdown(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

private:
    // 调用Node.js 转换服务(通用方法)
    json callConverterService(const std::string& url, const std::string& method, const json& data = {},
                              const std::string& filePath = "");
    // 获取文档内容 (从数据库)
    std::string getDocumentContent(const std::string& docId);

    // 保存文档内容到数据库
    bool saveDocumentContent(const std::string& userId, const std::string& content, const std::string& title);
};