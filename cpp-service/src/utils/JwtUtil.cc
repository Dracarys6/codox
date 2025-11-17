#include "JwtUtil.h"

#include <json/json.h>
#include <jwt-cpp/jwt.h>

#include <ctime>
#include <sstream>

std::string JwtUtil::generateToken(int userId, const std::string& secret, int expiresIn) {
    // 1.计算过期时间戳(当前时间 + expiresIn)
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::seconds(expiresIn);

    // 2.创建payload(包含 user_id 和 exp)
    auto token = jwt::create()
                         .set_type("JWT")
                         .set_issued_at(now)
                         .set_expires_at(exp)
                         .set_payload_claim("user_id", jwt::claim(std::to_string(userId)))
                         .sign(jwt::algorithm::hs256{secret});

    return token;
}

std::string JwtUtil::generateToken(const Json::Value& payload, const std::string& secret, int expiresIn) {
    // 1. 计算过期时间戳（当前时间 + expiresIn）
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::seconds(expiresIn);

    // 2. 创建 token builder
    auto tokenBuilder = jwt::create().set_type("JWT").set_issued_at(now).set_expires_at(exp);

    // 3. 从 payload 中添加所有字段
    for (const auto& key : payload.getMemberNames()) {
        Json::Value value = payload[key];
        if (value.isString()) {
            tokenBuilder.set_payload_claim(key, jwt::claim(value.asString()));
        } else if (value.isInt() || value.isInt64()) {
            tokenBuilder.set_payload_claim(key, jwt::claim(std::to_string(value.asInt64())));
        } else if (value.isUInt() || value.isUInt64()) {
            tokenBuilder.set_payload_claim(key, jwt::claim(std::to_string(value.asUInt64())));
        } else if (value.isDouble()) {
            tokenBuilder.set_payload_claim(key, jwt::claim(std::to_string(value.asDouble())));
        } else if (value.isBool()) {
            tokenBuilder.set_payload_claim(key,
                                           jwt::claim(value.asBool() ? std::string("true") : std::string("false")));
        } else {
            // 对于其他类型，转换为字符串
            Json::StreamWriterBuilder builder;
            std::string valueStr = Json::writeString(builder, value);
            tokenBuilder.set_payload_claim(key, jwt::claim(valueStr));
        }
    }

    // 4. 签名并返回
    return tokenBuilder.sign(jwt::algorithm::hs256{secret});
}

bool JwtUtil::verifyToken(const std::string& token, const std::string& secret) {
    try {
        // 1. 先解码 token（检查格式）
        auto decoded = jwt::decode(token);

        // 2. 验证签名和过期时间
        auto verifier = jwt::verify().allow_algorithm(jwt::algorithm::hs256{secret});

        // verify() 会自动检查：
        // - 签名是否正确
        // - 是否已过期（检查 exp claim）
        verifier.verify(decoded);
        return true;
    } catch (const std::exception& e) {
        // token 无效、已过期、签名错误或格式错误
        return false;
    }
}

int JwtUtil::getUserIdFromToken(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);

        // jwt-cpp 使用 get_payload_claim(key) 获取单个 claim
        // 如果 key 不存在，会抛出异常，所以直接用 try-catch 包裹
        auto userIdClaim = decoded.get_payload_claim("user_id");

        // 直接获取字符串值（如果类型不匹配会抛出异常）
        std::string userIdStr = userIdClaim.as_string();
        if (!userIdStr.empty()) {
            return std::stoi(userIdStr);
        }
        return -1;  // 值为空
    } catch (const std::exception& e) {
        // claim 不存在或类型不匹配时返回 -1
        return -1;
    }
}
