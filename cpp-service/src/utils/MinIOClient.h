#pragma once

#include <string>
#include <memory>
#include <functional>
#include <drogon/drogon.h>

/**
 * MinIO 客户端工具类
 * 
 * 提供文件上传、下载等基本操作
 * 使用 MinIO 的 S3 兼容 API
 */
class MinIOClient {
public:
    /**
     * 上传文件到 MinIO
     * 
     * @param objectName 对象名称（路径），例如 "snapshots/doc-123/snapshot-20240101.bin"
     * @param data 文件数据
     * @param size 数据大小
     * @param contentType 内容类型，默认为 "application/octet-stream"
     * @param callback 成功回调，返回对象 URL
     * @param errorCallback 错误回调
     */
    static void uploadFile(
        const std::string& objectName,
        const char* data,
        size_t size,
        const std::string& contentType,
        std::function<void(const std::string& url)>&& callback,
        std::function<void(const std::string& error)>&& errorCallback
    );

    /**
     * 从 MinIO 下载文件
     * 
     * @param objectName 对象名称（路径），例如 "snapshots/doc-123/snapshot-20240101.bin"
     * @param callback 成功回调，返回文件数据
     * @param errorCallback 错误回调
     */
    static void downloadFile(
        const std::string& objectName,
        std::function<void(const std::vector<char>& data)>&& callback,
        std::function<void(const std::string& error)>&& errorCallback
    );

    /**
     * 从配置获取 MinIO 配置值
     */
    static std::string getConfigValue(const std::string& key, const std::string& defaultValue = "");

private:
    /**
     * 生成 S3 签名（简化版，仅用于开发环境）
     * 生产环境应使用 AWS SDK 或 MinIO SDK
     */
    static std::string generateSignature(
        const std::string& method,
        const std::string& objectName,
        const std::string& date,
        const std::string& accessKey,
        const std::string& secretKey
    );
};

