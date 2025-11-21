#include "VersionRepository.h"

#include <algorithm>
#include <cctype>
#include <memory>
#include <string>
#include <vector>

namespace {
std::string sanitizeSource(std::string source) {
    if (source.empty()) return "auto";
    std::transform(source.begin(), source.end(), source.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (source == "manual" || source == "restore") return source;
    return "auto";
}

void cleanupAutoVersions(const drogon::orm::DbClientPtr& db, int docId, int retentionLimit,
                         std::function<void()> onSuccess,
                         std::function<void(const std::string&, drogon::HttpStatusCode)> onFailure) {
    if (!db || retentionLimit <= 0) {
        onSuccess();
        return;
    }
    db->execSqlAsync(
        "WITH ordered AS ("
        "  SELECT id FROM document_version "
        "  WHERE doc_id = $1::bigint AND source = 'auto' "
        "  ORDER BY version_number DESC "
        "  OFFSET $2::integer"
        ") "
        "DELETE FROM document_version WHERE id IN (SELECT id FROM ordered)",
        [onSuccess](const drogon::orm::Result&) { onSuccess(); },
        [onFailure](const drogon::orm::DrogonDbException& e) {
            onFailure("Database error: " + std::string(e.base().what()), drogon::k500InternalServerError);
        },
        std::to_string(docId), std::to_string(retentionLimit));
}
}  // namespace

void VersionRepository::insertVersion(const drogon::orm::DbClientPtr& db, const VersionInsertParams& params,
                                      std::function<void(int, int)> onSuccess,
                                      std::function<void(const std::string&, drogon::HttpStatusCode)> onFailure) {
    if (!db) {
        onFailure("Database not available", drogon::k500InternalServerError);
        return;
    }

    auto paramsPtr = std::make_shared<VersionInsertParams>(params);

    db->execSqlAsync(
        "SELECT owner_id, COALESCE(version_retention_limit, 0) AS retention_limit "
        "FROM document WHERE id = $1::integer",
        [db, paramsPtr, onSuccess, onFailure](const drogon::orm::Result& docResult) {
            if (docResult.empty()) {
                onFailure("Document not found", drogon::k404NotFound);
                return;
            }

            int ownerId = docResult[0]["owner_id"].as<int>();
            int retentionLimit = docResult[0]["retention_limit"].as<int>();
            int creatorId = paramsPtr->creatorId > 0 ? paramsPtr->creatorId : ownerId;
            std::string source = sanitizeSource(paramsPtr->source);
            std::string changeSummary = paramsPtr->changeSummary;
            if (changeSummary.size() > 2048) {
                changeSummary = changeSummary.substr(0, 2048);
            }

            db->execSqlAsync(
                "WITH next_version AS ("
                "  SELECT COALESCE(MAX(version_number), 0) + 1 AS next_val "
                "  FROM document_version WHERE doc_id = $1::bigint"
                ") "
                "INSERT INTO document_version "
                "(doc_id, version_number, snapshot_url, snapshot_sha256, size_bytes, created_by, change_summary, source, "
                "content_text, content_html) "
                "SELECT $1::bigint, next_val, $2, $3, $4::bigint, $5::integer, NULLIF($6, ''), $7, NULLIF($8, ''), "
                "NULLIF($9, '') "
                "FROM next_version "
                "RETURNING id, version_number",
                [db, paramsPtr, onSuccess, onFailure, source, retentionLimit](const drogon::orm::Result& insertResult) {
                    if (insertResult.empty()) {
                        onFailure("Failed to create version", drogon::k500InternalServerError);
                        return;
                    }
                    int versionId = insertResult[0]["id"].as<int>();
                    int versionNumber = insertResult[0]["version_number"].as<int>();

                    db->execSqlAsync(
                        "UPDATE document SET last_published_version_id = $1::bigint, updated_at = NOW() "
                        "WHERE id = $2::integer",
                        [db, paramsPtr, onSuccess, onFailure, versionId, versionNumber, source, retentionLimit](
                            const drogon::orm::Result&) {
                            if (source == "auto" && retentionLimit > 0) {
                                cleanupAutoVersions(db, paramsPtr->docId, retentionLimit,
                                                    [onSuccess, versionId, versionNumber]() {
                                                        onSuccess(versionId, versionNumber);
                                                    },
                                                    onFailure);
                                return;
                            }
                            onSuccess(versionId, versionNumber);
                        },
                        [onFailure](const drogon::orm::DrogonDbException& e) {
                            onFailure("Database error: " + std::string(e.base().what()), drogon::k500InternalServerError);
                        },
                        std::to_string(versionId), std::to_string(paramsPtr->docId));
                },
                [onFailure](const drogon::orm::DrogonDbException& e) {
                    onFailure("Database error: " + std::string(e.base().what()), drogon::k500InternalServerError);
                },
                std::to_string(paramsPtr->docId), paramsPtr->snapshotUrl, paramsPtr->snapshotSha256,
                std::to_string(paramsPtr->sizeBytes), std::to_string(creatorId), changeSummary, source,
                paramsPtr->contentText, paramsPtr->contentHtml);
        },
        [onFailure](const drogon::orm::DrogonDbException& e) {
            onFailure("Database error: " + std::string(e.base().what()), drogon::k500InternalServerError);
        },
        std::to_string(params.docId));
}



