#pragma once
#include <drogon/drogon.h>
#include <json/json.h>

#include <functional>
#include <string>

class ResponseUtils {
public:
    /**
     * 发送错误响应
     * @param callback 响应回调函数
     * @param message 错误消息
     * @param statusCode HTTP 状态码（默认 400）
     */
    static void sendError(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                          const std::string& message, int statusCode = drogon::k400BadRequest);

    /**
     * 发送成功响应（格式化 JSON）
     * @param callback 响应回调函数
     * @param data JSON 数据
     * @param statusCode HTTP 状态码（默认 200）
     */
    static void sendSuccess(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                            const Json::Value& data, int statusCode = drogon::k200OK);

    /**
     * 发送成功响应（普通 JSON，不格式化）
     * @param callback 响应回调函数
     * @param data JSON 数据
     * @param statusCode HTTP 状态码（默认 200）
     */
    static void sendSuccessPlain(const std::function<void(const drogon::HttpResponsePtr&)>& callback,
                                 const Json::Value& data, int statusCode = drogon::k200OK);
};
