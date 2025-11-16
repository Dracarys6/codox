#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>
using namespace drogon;

class SearchController : public drogon::HttpController<SearchController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(SearchController::search, "/api/search", Get, "JwtAuthFilter");
    METHOD_LIST_END

    void search(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};