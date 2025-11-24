#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <json/json.h>

#include <functional>

using namespace drogon;

class FeedbackController : public drogon::HttpController<FeedbackController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(FeedbackController::submitFeedback, "/api/feedback", Post, "JwtAuthFilter");
    ADD_METHOD_TO(FeedbackController::getFeedbackStats, "/api/feedback/stat", Get, "JwtAuthFilter");
    METHOD_LIST_END

    void submitFeedback(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void getFeedbackStats(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

private:
    bool ensureAdmin(int userId,
                     std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                     std::function<void()> onSuccess);
};


