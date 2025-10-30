#include <drogon/drogon.h>
#include "controllers/HealthController.h"   // 引入控制器头文件

int main(int argc, char* argv[]) {
    // 配置并启动Drogon应用
    drogon::app()
        .setThreadNum(std::thread::hardware_concurrency())  // 使用硬件并发数作为线程数
        .loadConfigFile("config.json")                      // 加载配置文件
        .run();                                             // 启动服务

    return 0;
}