#pragma once

#include <string>

class TokenUtils {
public:
    /**
     * 生成指定长度（字节数）的随机 token，并以十六进制字符串返回
     */
    static std::string generateRandomHex(size_t byteLength = 32);

    /**
     * 计算输入字符串的 SHA-256 哈希，返回十六进制字符串
     */
    static std::string sha256(const std::string& input);
};


