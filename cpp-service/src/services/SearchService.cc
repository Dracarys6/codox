#include "SearchService.h"

#include <drogon/HttpClient.h>
#include <drogon/drogon.h>
#include <json/json.h>
#include <unistd.h>  // for access()

#include <fstream>
#include <sstream>

void SearchService::indexDocument(int docId, const std::string& title, const std::string& content) {
    Json::Value document;
    document["id"] = docId;
    document["title"] = title;
    document["content"] = content;

    Json::StreamWriterBuilder builder;
    std::string body = Json::writeString(builder, document);
    // 发送获取请求
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Post);
    req->setPath("/indexes/documents/documents");
    req->addHeader("Authorization", "Bearer " + getMasterKey());
    req->setContentTypeCode(drogon::CT_APPLICATION_JSON);
    req->setBody(body);
    // 异步处理：记录索引结果，便于排查问题
    LOG_INFO << "[SearchService] indexDocument called for docId=" << docId << ", title=" << title;
    client->sendRequest(req, [docId](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            LOG_ERROR << "[SearchService] Failed to index document (network error). docId=" << docId
                      << ", result=" << static_cast<int>(result);
            return;
        }

        auto status = resp->getStatusCode();
        if (status != drogon::k202Accepted && status != drogon::k200OK) {
            std::string bodyStr;
            auto bodyView = resp->getBody();
            if (!bodyView.empty()) {
                bodyStr.assign(bodyView.data(), std::min<size_t>(bodyView.length(), 500));  // 只打印前 500 字符
            }
            LOG_ERROR << "[SearchService] Meilisearch returned status " << status << " when indexing docId=" << docId
                      << ", body=" << bodyStr;
        } else {
            LOG_INFO << "[SearchService] Indexed document successfully. docId=" << docId << ", status=" << status;
        }
    });
}

void SearchService::deleteDocument(int docId) {
    // 发送 DELETE 请求
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Delete);
    req->setPath("/indexes/documents/documents/" + std::to_string(docId));
    req->addHeader("Authorization", "Bearer " + getMasterKey());
    // 异步处理：失败时记录错误日志
    client->sendRequest(req, [=](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            LOG_ERROR << "Failed to delete document from index";
        }
    });
}

void SearchService::search(const std::string& query, int page, int pageSize,
                           std::function<void(const Json::Value&)> callback,
                           std::function<void(const std::string&)> errorCallback) {
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();

    req->setMethod(drogon::Post);
    req->setPath("/indexes/documents/search");
    req->addHeader("Authorization", "Bearer " + getMasterKey());
    req->setContentTypeCode(drogon::CT_APPLICATION_JSON);

    Json::Value payload;
    payload["q"] = query;
    payload["page"] = page;
    payload["hitsPerPage"] = pageSize;
    Json::StreamWriterBuilder builder;
    req->setBody(Json::writeString(builder, payload));

    client->sendRequest(req, [callback, errorCallback](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            errorCallback("Search request failed");
            return;
        }

        if (resp->getStatusCode() != drogon::k200OK) {
            errorCallback("MeiliSearch returned " + std::to_string(resp->getStatusCode()));
            return;
        }

        auto jsonPtr = resp->getJsonObject();
        if (!jsonPtr) {
            errorCallback("Invalid JSON response");
            return;
        }

        callback(*jsonPtr);
    });
}

// 辅助函数：从配置文件读取配置值（直接读取配置文件）
static std::string getConfigValue(const std::string& key, const std::string& defaultValue = "") {
    std::string configPath = "config.json";
    if (access("config.json", F_OK) != 0) {
        configPath = "../config.json";
    }

    try {
        std::ifstream file(configPath);
        if (file.is_open()) {
            std::stringstream buffer;
            buffer << file.rdbuf();
            file.close();

            Json::Value root;
            Json::Reader reader;
            if (reader.parse(buffer.str(), root)) {
                if (root.isMember("app") && root["app"].isMember(key)) {
                    return root["app"][key].asString();
                }
            }
        }
    } catch (...) {
        // 忽略异常
    }

    return defaultValue;
}

std::string SearchService::getMeilisearchUrl() { return getConfigValue("meilisearch_url", "http://localhost:7700"); }

std::string SearchService::getMasterKey() { return getConfigValue("meilisearch_master_key", ""); }
