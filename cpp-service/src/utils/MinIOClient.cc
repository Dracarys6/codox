#include "MinIOClient.h"

#include <drogon/HttpClient.h>
#include <drogon/drogon.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <memory>
#include <sstream>
#include <stdexcept>

namespace {
/**
 * 从配置文件读取配置值
 */
std::string getConfigValueFromFile(const std::string& key, const std::string& defaultValue = "") {
    auto& appConfig = drogon::app().getCustomConfig();
    if (appConfig.isMember(key)) {
        return appConfig[key].asString();
    }
    return defaultValue;
}

/**
 * 获取当前时间戳（ISO 8601 格式）
 */
std::string getCurrentTimestamp() {
    auto now = std::time(nullptr);
    char buffer[64];
    std::strftime(buffer, sizeof(buffer), "%Y%m%dT%H%M%SZ", std::gmtime(&now));
    return std::string(buffer);
}

/**
 * 计算 HMAC-SHA256
 */
std::vector<unsigned char> hmacSha256(const std::string& key, const std::string& data) {
    unsigned char* digest =
            HMAC(EVP_sha256(), key.c_str(), key.length(), (unsigned char*)data.c_str(), data.length(), NULL, NULL);
    std::vector<unsigned char> result(digest, digest + SHA256_DIGEST_LENGTH);
    return result;
}

/**
 * 计算 SHA256 哈希
 */
std::vector<unsigned char> sha256(const std::string& data) {
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) {
        throw std::runtime_error("Failed to allocate EVP_MD_CTX");
    }
    auto ctxDeleter = [](EVP_MD_CTX* ptr) { EVP_MD_CTX_free(ptr); };
    std::unique_ptr<EVP_MD_CTX, decltype(ctxDeleter)> ctxGuard(ctx, ctxDeleter);

    std::array<unsigned char, SHA256_DIGEST_LENGTH> hash{};
    if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1 || EVP_DigestUpdate(ctx, data.data(), data.size()) != 1 ||
        EVP_DigestFinal_ex(ctx, hash.data(), nullptr) != 1) {
        throw std::runtime_error("Failed to compute SHA256 hash");
    }

    return std::vector<unsigned char>(hash.begin(), hash.end());
}

/**
 * 将字节数组转换为十六进制字符串
 */
std::string toHex(const unsigned char* data, size_t length) {
    std::ostringstream oss;
    for (size_t i = 0; i < length; i++) {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)data[i];
    }
    return oss.str();
}

}  // namespace

std::string MinIOClient::getConfigValue(const std::string& key, const std::string& defaultValue) {
    return getConfigValueFromFile(key, defaultValue);
}

std::string MinIOClient::generateSignature(const std::string& method, const std::string& objectName,
                                           const std::string& date, const std::string& accessKey,
                                           const std::string& secretKey) {
    // AWS Signature Version 4 实现（简化版）
    // 参考: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html

    std::string dateStamp = date.substr(0, 8);  // YYYYMMDD
    std::string region = "us-east-1";           // MinIO 默认区域
    std::string service = "s3";

    // 1. 创建规范请求
    // objectName 格式: bucket/path/to/file
    std::string canonicalUri = "/" + objectName;
    std::string canonicalQueryString = "";
    std::string canonicalHeaders = "host:" + getConfigValueFromFile("minio_endpoint", "localhost:9000") +
                                   "\n"
                                   "x-amz-date:" +
                                   date + "\n";
    std::string signedHeaders = "host;x-amz-date";
    std::string payloadHash = "UNSIGNED-PAYLOAD";  // 对于 PUT 请求，可以计算 SHA256

    std::string canonicalRequest = method + "\n" + canonicalUri + "\n" + canonicalQueryString + "\n" +
                                   canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

    // 2. 创建待签名字符串
    std::string algorithm = "AWS4-HMAC-SHA256";
    std::string credentialScope = dateStamp + "/" + region + "/" + service + "/aws4_request";
    auto canonicalRequestHash = sha256(canonicalRequest);
    std::string stringToSign = algorithm + "\n" + date + "\n" + credentialScope + "\n" +
                               toHex(canonicalRequestHash.data(), SHA256_DIGEST_LENGTH);

    // 3. 计算签名
    std::string kSecret = "AWS4" + secretKey;
    auto kDate = hmacSha256(kSecret, dateStamp);
    auto kRegion = hmacSha256(std::string(kDate.begin(), kDate.end()), region);
    auto kService = hmacSha256(std::string(kRegion.begin(), kRegion.end()), service);
    auto kSigning = hmacSha256(std::string(kService.begin(), kService.end()), "aws4_request");
    auto signature = hmacSha256(std::string(kSigning.begin(), kSigning.end()), stringToSign);

    // 4. 构建授权头
    std::string authorization = algorithm + " " + "Credential=" + accessKey + "/" + credentialScope + ", " +
                                "SignedHeaders=" + signedHeaders + ", " +
                                "Signature=" + toHex(signature.data(), SHA256_DIGEST_LENGTH);

    return authorization;
}

void MinIOClient::uploadFile(const std::string& objectName, const char* data, size_t size,
                             const std::string& contentType, std::function<void(const std::string& url)>&& callback,
                             std::function<void(const std::string& error)>&& errorCallback) {
    // 1. 获取配置
    std::string endpoint = getConfigValue("minio_endpoint", "localhost:9000");
    std::string accessKey = getConfigValue("minio_access_key", "minioadmin");
    std::string secretKey = getConfigValue("minio_secret_key", "minioadmin");
    std::string bucket = getConfigValue("minio_bucket", "documents");

    // 2. 构建 URL
    std::string url = "http://" + endpoint + "/" + bucket + "/" + objectName;

    // 3. 创建 HTTP 客户端
    auto client = drogon::HttpClient::newHttpClient("http://" + endpoint);
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Put);
    req->setPath("/" + bucket + "/" + objectName);
    req->setBody(std::string(data, size));
    req->addHeader("Content-Type", contentType);
    req->addHeader("Content-Length", std::to_string(size));

    // 4. 添加认证头（使用 AWS Signature Version 4）
    std::string date = getCurrentTimestamp();
    req->addHeader("x-amz-date", date);
    req->addHeader("x-amz-content-sha256", "UNSIGNED-PAYLOAD");

    // 构建完整的路径用于签名（bucket/objectName）
    std::string fullPath = bucket + "/" + objectName;
    std::string authorization = generateSignature("PUT", fullPath, date, accessKey, secretKey);
    req->addHeader("Authorization", authorization);

    // 5. 发送请求
    client->sendRequest(req, [=, callback = std::move(callback), errorCallback = std::move(errorCallback)](
                                     drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            errorCallback("Failed to connect to MinIO: " + std::to_string(static_cast<int>(result)));
            return;
        }

        int statusCode = resp->getStatusCode();
        if (statusCode == drogon::k200OK || statusCode == drogon::k204NoContent) {
            callback(url);
        } else {
            std::string errorMsg = "MinIO upload failed: HTTP " + std::to_string(statusCode);
            auto body = resp->getBody();
            if (!body.empty()) {
                errorMsg += " - " + std::string(body.data(), body.length());
            }
            errorCallback(errorMsg);
        }
    });
}

void MinIOClient::downloadFile(const std::string& objectName,
                               std::function<void(const std::vector<char>& data)>&& callback,
                               std::function<void(const std::string& error)>&& errorCallback) {
    // 1. 获取配置
    std::string endpoint = getConfigValue("minio_endpoint", "localhost:9000");
    std::string accessKey = getConfigValue("minio_access_key", "minioadmin");
    std::string secretKey = getConfigValue("minio_secret_key", "minioadmin");
    std::string bucket = getConfigValue("minio_bucket", "documents");

    // 2. 创建 HTTP 客户端
    auto client = drogon::HttpClient::newHttpClient("http://" + endpoint);
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Get);
    req->setPath("/" + bucket + "/" + objectName);

    // 3. 添加认证头（使用 AWS Signature Version 4）
    std::string date = getCurrentTimestamp();
    req->addHeader("x-amz-date", date);
    req->addHeader("x-amz-content-sha256", "UNSIGNED-PAYLOAD");

    // 构建完整的路径用于签名（bucket/objectName）
    std::string fullPath = bucket + "/" + objectName;
    std::string authorization = generateSignature("GET", fullPath, date, accessKey, secretKey);
    req->addHeader("Authorization", authorization);

    // 4. 发送请求
    client->sendRequest(req, [=, callback = std::move(callback), errorCallback = std::move(errorCallback)](
                                     drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            errorCallback("Failed to connect to MinIO: " + std::to_string(static_cast<int>(result)));
            return;
        }

        int statusCode = resp->getStatusCode();
        if (statusCode == drogon::k200OK) {
            auto body = resp->getBody();
            std::vector<char> data(body.data(), body.data() + body.length());
            callback(data);
        } else {
            std::string errorMsg = "MinIO download failed: HTTP " + std::to_string(statusCode);
            auto body = resp->getBody();
            if (!body.empty()) {
                errorMsg += " - " + std::string(body.data(), body.length());
            }
            errorCallback(errorMsg);
        }
    });
}
