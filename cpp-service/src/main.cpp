#include <drogon/drogon.h>
#include <unistd.h>  // for access()

#include <chrono>
#include <fstream>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    // 查找配置文件（支持从不同目录运行）
    std::string configPath = "config.json";

    // 如果当前目录没有 config.json，尝试从上一级目录查找
    if (access("config.json", F_OK) != 0) {
        configPath = "../config.json";
    }

    try {
        auto& app = drogon::app();
        std::cout << "✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨" << std::endl;
        std::cout << "Starting Drogon server..." << std::endl;
        std::cout << "检查连接状态请访问: http://localhost:8080/health" << std::endl;
        app.loadConfigFile(configPath);  // 加载配置文件
        app.run();
    } catch (const std::exception& e) {
        std::cerr << "Error starting application: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}