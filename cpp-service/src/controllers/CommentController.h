#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

class CommentController : public drogon::HttpController<CommentController> {}