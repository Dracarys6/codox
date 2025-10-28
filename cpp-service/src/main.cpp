#include <drogon/drogon.h>

int main(int argc, char* argv[]) {
    drogon::app()
        .addListener("0.0.0.0", 8080)
        .setThreadNum(std::thread::hardware_concurrency())
        .loadConfigFile("config.json");

    drogon::app().run();
    return 0;
}


