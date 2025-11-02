#include"DbUtils.h"
#include<drogon/drogon.h>

drogon::orm::DbClientPtr DbUtils::getDbClient() {
    // Drogon 会自动管理连接池，直接从 app 获取即可
    return drogon::app().getDbClient();
}

void DbUtils::getUserByEmail(const std::string& email,
    std::function<void(const drogon::orm::Result&)> successCallback,
    std::function<void(const drogon::orm::DrogonDbException&)>errorCallback) {
    auto db = getDbClient();
    db->execSqlAsync(
        "SELECT id,email,password_hash,role FROM \"user\" WHERE email = $1",
        successCallback,
        errorCallback,
        email
    );
}


void DbUtils::createUser(const std::string& email,
    const std::string& passwordHash,
    const std::string& role,
    std::function<void(int userId)> successCallback,
    std::function<void(const drogon::orm::DrogonDbException&)> errorCallback) {
    auto db = getDbClient();
    db->execSqlAsync(
        "INSERT INTO \"user\" (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [successCallback](const drogon::orm::Result& r) {
            if (!r.empty()) {
                int userId = r[0]["id"].as<int>();
                successCallback(userId);
            }
        },
        errorCallback,
        email,
        passwordHash,
        role
    );
}