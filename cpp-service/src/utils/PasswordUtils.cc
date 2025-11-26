#include "PasswordUtils.h"

#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/sha.h>

#include <array>
#include <iomanip>  //包含setw(),setfill()头文件 设置输出宽度,填充字符
#include <memory>
#include <sstream>  //字符串流 简化string操作
#include <stdexcept>
#include <vector>

namespace {

std::array<unsigned char, SHA256_DIGEST_LENGTH> sha256Digest(const std::string& data) {
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) {
        throw std::runtime_error("Failed to allocate EVP_MD_CTX");
    }

    std::array<unsigned char, SHA256_DIGEST_LENGTH> digest{};
    auto ctxDeleter = [](EVP_MD_CTX* ptr) { EVP_MD_CTX_free(ptr); };
    std::unique_ptr<EVP_MD_CTX, decltype(ctxDeleter)> ctxGuard(ctx, ctxDeleter);

    if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1 || EVP_DigestUpdate(ctx, data.data(), data.size()) != 1 ||
        EVP_DigestFinal_ex(ctx, digest.data(), nullptr) != 1) {
        throw std::runtime_error("Failed to compute SHA256 digest");
    }

    return digest;
}

}  // namespace

std::string PasswordUtils::generateSalt(int length) {
    std::vector<unsigned char> salt(length);
    RAND_bytes(salt.data(), length);

    std::stringstream ss;
    for (int i = 0; i < length; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(salt[i]);
    }
    return ss.str();
}

std::string PasswordUtils::hashPassword(const std::string& plainPassword) {
    // 生成随机盐
    std::string salt = generateSalt(16);

    // SHA-256 哈希:password + salt
    std::string input = plainPassword + salt;
    auto hash = sha256Digest(input);

    // 将哈希值和盐编码为16进制字符串
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(hash[i]);
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
    std::string input = plainPassword + salt;
    auto computedHash = sha256Digest(input);

    // 转换为16进制字符串
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(computedHash[i]);
    }

    return ss.str() == storedHash;
}