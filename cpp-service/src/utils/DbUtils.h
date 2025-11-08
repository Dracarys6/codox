#pragma once
#include <drogon/orm/DbClient.h>

#include <functional>
#include <memory>

class DbUtils {
public:
    // 获取数据库客户端 (连接池)
    static drogon::orm::DbClientPtr getDbClient();

    // 执行查询等需求 ......

    // 查询单个用户（异步）
    static void getUserByEmail(const std::string& email,
                               std::function<void(const drogon::orm::Result&)> successCallback,
                               std::function<void(const drogon::orm::DrogonDbException&)> errorCallback);

    // 创建用户（异步）
    static void createUser(const std::string& email, const std::string& passwordHash, const std::string& role,
                           std::function<void(int userId)> successCallback,
                           std::function<void(const drogon::orm::DrogonDbException&)> errorCallback);
};