#pragma once
#include <json/json.h>

#include <string>

class JwtUtil {
public:
    // 生成 token（userId：用户ID，secret：密钥，expiresIn：过期时间（秒））
    static std::string generateToken(int userId, const std::string& secret, int expiresIn);

    // 生成 token（支持自定义 payload，secret：密钥，expiresIn：过期时间（秒））
    static std::string generateToken(const Json::Value& payload, const std::string& secret, int expiresIn);

    // 验证 token 有效性
    static bool verifyToken(const std::string& token, const std::string& secret);

    // 从 token 中解析用户ID
    static int getUserIdFromToken(const std::string& token);  // 解析 payload
};