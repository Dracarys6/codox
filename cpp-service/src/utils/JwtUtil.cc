#include "JwtUtil.h"
#include<jwt-cpp/jwt.h>
#include<ctime>
#include<sstream>

std::string JwtUtil::generateToken(int userId, const std::string& secret, int expiresIn) {
    //1.计算过期时间戳(当前时间 + expiresIn)
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::seconds(expiresIn);

    //2.创建payload(包含 user_id 和 exp)
    auto token = jwt::create()
        .set_type("JWT")
        .set_issued_at(now)
        .set_expires_at(exp)
        .set_payload_claim("user_id", jwt::claim(std::to_string(userId)))
        .sign(jwt::algorithm::hs256 { secret });

    return token;
}

bool JwtUtil::verifyToken(const std::string& token, const std::string& secret) {
    try {
        //验证并解码 token
        auto decoded = jwt::decode(token);

        //验证签名（不检查 issuer，因为生成时没有设置）
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256 { secret });

        verifier.verify(decoded);
        return true;
    }
    catch (const std::exception& e) {
        //token 无效或已过期
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
        return -1; //值为空
    }
    catch (const std::exception& e) {
        // claim 不存在或类型不匹配时返回 -1
        return -1;
    }
}

