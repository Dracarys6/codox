#pragma once

#include <drogon/HttpTypes.h>
#include <drogon/orm/DbClient.h>

#include <functional>
#include <string>

struct VersionInsertParams {
    int docId;
    int creatorId;
    std::string snapshotUrl;
    std::string snapshotSha256;
    int64_t sizeBytes;
    std::string changeSummary;
    std::string source;
    std::string contentText;
    std::string contentHtml;
};

class VersionRepository {
public:
    /**
     * 插入一条文档版本记录，并更新文档的 last_published_version_id。
     * onSuccess：返回新版本的 ID 和 version_number。
     * onFailure：返回错误消息和对应的 HTTP 状态码。
     */
    static void insertVersion(
        const drogon::orm::DbClientPtr& db,
        const VersionInsertParams& params,
        std::function<void(int versionId, int versionNumber)> onSuccess,
        std::function<void(const std::string& message, drogon::HttpStatusCode code)> onFailure);
};



