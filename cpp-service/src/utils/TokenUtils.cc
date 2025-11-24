#include "TokenUtils.h"

#include <openssl/rand.h>
#include <openssl/sha.h>

#include <iomanip>
#include <sstream>
#include <vector>

std::string TokenUtils::generateRandomHex(size_t byteLength) {
    if (byteLength == 0) {
        byteLength = 32;
    }

    std::vector<unsigned char> buffer(byteLength);
    RAND_bytes(buffer.data(), static_cast<int>(buffer.size()));

    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    for (const auto& byte : buffer) {
        ss << std::setw(2) << static_cast<int>(byte);
    }
    return ss.str();
}

std::string TokenUtils::sha256(const std::string& input) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(input.c_str()), input.size(), hash);

    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    for (const auto& byte : hash) {
        ss << std::setw(2) << static_cast<int>(byte);
    }
    return ss.str();
}


