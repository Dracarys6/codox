#pragma once
#include <drogon/HttpController.h>
#include <drogon/HttpFilter.h>
#include <drogon/drogon.h>
#include <json/json.h>

using namespace drogon;

class JwtAuthFilter : public drogon::HttpFilter<JwtAuthFilter> {
public:
    void doFilter(const HttpRequestPtr& req, drogon::FilterCallback&& fcb, drogon::FilterChainCallback&& fccb);
};