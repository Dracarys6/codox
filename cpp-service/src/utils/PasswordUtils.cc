#include "PasswordUtils.h"

#include <openssl/rand.h>
#include <openssl/sha.h>

#include <iomanip>  //包含setw(),setfill()头文件 设置输出宽度,填充字符
#include <sstream>  //字符串流 简化string操作

std::string PasswordUtils::generateSalt(int length) {
    unsigned char salt[length];
    RAND_bytes(salt, length);

    std::stringstream ss;
    for (int i = 0; i < length; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)salt[i];
    }
    return ss.str();
}

std::string PasswordUtils::hashPassword(const std::string& plainPassword) {
    // 生成随机盐
    std::string salt = generateSalt(16);

    // SHA-256 哈希:password + salt
    unsigned char hash[SHA256_DIGEST_LENGTH];
    std::string input = plainPassword + salt;
    SHA256((unsigned char*)input.c_str(), input.length(), hash);

    // 将哈希值和盐编码为16进制字符串
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }

    // 返回格式: $sha256$salt$hash
    return "$sha256$" + salt + "$" + ss.str();
}

bool PasswordUtils::verifyPassword(const std::string& plainPassword, const std::string& hash) {
    // 解析存储的哈希格式:$sha256$salt$hash
    if (hash.substr(0, 8) != "$sha256$") {
        return false;
    }

    // 提取salt 和 storedHash
    size_t saltStart = 8;
    size_t saltEnd = hash.find('$', saltStart);
    if (saltEnd == std::string::npos) {
        return false;
    }

    std::string salt = hash.substr(saltStart, saltEnd - saltStart);
    std::string storedHash = hash.substr(saltEnd + 1);

    // 重新计算哈希
    unsigned char computedHash[SHA256_DIGEST_LENGTH];
    std::string input = plainPassword + salt;
    SHA256((unsigned char*)input.c_str(), input.length(), computedHash);

    // 转换为16进制字符串
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)computedHash[i];
    }

    return ss.str() == storedHash;
}