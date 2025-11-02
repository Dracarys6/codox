#include<string>

class PasswordUtils {
public:
    //哈希密码(返回哈希值字符串
    static std::string hashPassword(const std::string& plainPassword);

    //验证密码(明文密码 vs 存储的哈希值)
    static bool verifyPassword(const std::string& plainPassword, const std::string& hash);

private:
    //生成随机盐
    static std::string generateSalt(int length = 16);
};