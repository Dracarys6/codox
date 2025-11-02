#include "utils/JwtUtil.h"
#include "utils/PasswordUtils.h"
#include <iostream>

int main() {
    // 测试密码哈希
    std::string password = "test123";
    std::string hash = PasswordUtils::hashPassword(password);
    std::cout << "Hash: " << hash << std::endl;

    bool valid = PasswordUtils::verifyPassword(password, hash);
    std::cout << "Verify: " << (valid ? "OK" : "FAIL") << std::endl;

    // 测试 JWT
    std::string secret = "my-secret-key";
    std::string token = JwtUtil::generateToken(123, secret, 3600);
    std::cout << "Token: " << token << std::endl;

    bool tokenValid = JwtUtil::verifyToken(token, secret);
    std::cout << "Token valid: " << (tokenValid ? "OK" : "FAIL") << std::endl;

    int userId = JwtUtil::getUserIdFromToken(token);
    std::cout << "User ID: " << userId << std::endl;
    return 0;
}