#include <drogon/HttpController.h>
#include <pqxx/pqxx>
#include <drogon/drogon.h>

using namespace drogon;

class HealthController : public drogon::HttpController<HealthController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(HealthController::health, "/health", Get);
    METHOD_LIST_END

        void health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
        Json::Value body;
        body["status"] = "ok";

        try {
            // Read DB config from Drogon default client (optional) or env
            // Using libpqxx direct test from environment variables if provided
            const char* conn = std::getenv("DB_URI");
            if (conn && std::strlen(conn) > 0) {
                pqxx::connection c { conn };
                pqxx::work tx { c };
                auto r = tx.exec("SELECT 1");
                (void)r;
                tx.commit();
                body["db"] = "ok";
            }
            else {
                body["db"] = "skipped";
            }
        }
        catch (const std::exception& e) {
            body["db"] = "error";
            body["error"] = e.what();
        }

        auto resp = HttpResponse::newHttpJsonResponse(body);
        resp->setStatusCode(k200OK);
        callback(resp);
    }
};

// Register at load
static auto reg = HttpController<HealthController>::registerSelf();


