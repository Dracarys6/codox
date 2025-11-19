#include "ResponseUtils.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>
#include <sstream>

// 添加安全响应头的辅助函数
static void addSecurityHeaders(drogon::HttpResponsePtr& resp) {
    resp->addHeader("X-Content-Type-Options", "nosniff");
    resp->addHeader("X-Frame-Options", "DENY");
    resp->addHeader("X-XSS-Protection", "1; mode=block");
    resp->addHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // 注意：Content-Security-Policy 应该根据实际需求配置，这里提供一个宽松的默认值
    // 如果需要更严格的 CSP，应该在配置文件中或通过中间件设置
}

void ResponseUtils::sendError(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                              const std::string& message, int statusCode) {
    Json::Value errorJson;
    errorJson["error"] = message;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(errorJson);
    resp->setStatusCode(static_cast<drogon::HttpStatusCode>(statusCode));
    addSecurityHeaders(resp);
    callback(resp);
}

void ResponseUtils::sendSuccess(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                                const Json::Value& data, int statusCode) {
    // 格式化 JSON 输出（pretty-print）
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "  ";  // 使用 2 个空格缩进
    builder["commentStyle"] = "None";
    builder["enableYAMLCompatibility"] = false;
    builder["dropNullPlaceholders"] = false;
    builder["useSpecialFloats"] = false;
    builder["precision"] = 17;

    std::unique_ptr<Json::StreamWriter> writer(builder.newStreamWriter());
    std::ostringstream os;
    writer->write(data, &os);

    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setBody(os.str());
    resp->setContentTypeCode(drogon::CT_APPLICATION_JSON);
    resp->setStatusCode(static_cast<drogon::HttpStatusCode>(statusCode));
    addSecurityHeaders(resp);
    callback(resp);
}

void ResponseUtils::sendSuccessPlain(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                                     const Json::Value& data, int statusCode) {
    auto resp = drogon::HttpResponse::newHttpJsonResponse(data);
    resp->setStatusCode(static_cast<drogon::HttpStatusCode>(statusCode));
    addSecurityHeaders(resp);
    callback(resp);
}
