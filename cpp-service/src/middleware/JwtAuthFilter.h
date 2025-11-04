#pragma once
#include<json/json.h>
#include<drogon/drogon.h>
#include<drogon/HttpFilter.h>
#include<drogon/HttpController.h>

using namespace drogon;

class JwtAuthFilter :public drogon::HttpFilter<JwtAuthFilter> {
public:
    void doFilter(const HttpRequestPtr& req,
        drogon::FilterCallback&& fcb,
        drogon::FilterChainCallback&& fccb);
};