#include "DocumentImportExportController.h"

#include <drogon/HttpResponse.h>
#include <json/json.h>

namespace {
HttpResponsePtr makeNotImplementedResponse(const std::string& action) {
    Json::Value payload(Json::objectValue);
    payload["error"] = action + " is not implemented yet";
    auto resp = HttpResponse::newHttpJsonResponse(payload);
    resp->setStatusCode(drogon::k501NotImplemented);
    return resp;
}
}  // namespace

void DocumentImportExportController::importWord(const HttpRequestPtr&,
                                                std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("Word import"));
}

void DocumentImportExportController::importPdf(const HttpRequestPtr&,
                                               std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("PDF import"));
}

void DocumentImportExportController::importMarkdown(const HttpRequestPtr&,
                                                    std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("Markdown import"));
}

void DocumentImportExportController::exportWord(const HttpRequestPtr&,
                                                std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("Word export"));
}

void DocumentImportExportController::exportPdf(const HttpRequestPtr&,
                                               std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("PDF export"));
}

void DocumentImportExportController::exportMarkdown(const HttpRequestPtr&,
                                                    std::function<void(const HttpResponsePtr&)>&& callback) {
    callback(makeNotImplementedResponse("Markdown export"));
}

json DocumentImportExportController::callConverterService(const std::string& url, const std::string& method,
                                                          const json& data, const std::string& filePath) {
    LOG_WARN << "callConverterService is not implemented. url=" << url << ", method=" << method << ", file=" << filePath
             << ", payload=" << data.dump();
    return json{};
}

std::string DocumentImportExportController::getDocumentContent(const std::string& docId) {
    LOG_WARN << "getDocumentContent is not implemented. docId=" << docId;
    return {};
}

bool DocumentImportExportController::saveDocumentContent(const std::string& userId, const std::string& content,
                                                         const std::string& title) {
    LOG_WARN << "saveDocumentContent is not implemented. userId=" << userId << ", title=" << title
             << ", content_length=" << content.size();
    return false;
}
