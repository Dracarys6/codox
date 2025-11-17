#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>
using namespace drogon;

class ChatController : public drogon::HttpController<ChatController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(ChatController::createRoom, "/api/chat/rooms", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::getRooms, "/api/chat/rooms", Get, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::addMember, "/api/chat/rooms/{id}/members", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::getMessages, "/api/chat/rooms/{id}/messages", Get, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::sendMessage, "/api/chat/rooms/{id}/messages", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::markMessageRead, "/api/chat/messages/{id}/read", Post, "JwtAuthFilter");
    METHOD_LIST_END

    // 创建聊天室
    void createRoom(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 获取用户聊天室列表
    void getRooms(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 添加成员到聊天室
    void addMember(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 获取信息历史
    void getMessages(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 发送信息
    void sendMessage(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 将信息标记为已读
    void markMessageRead(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 辅助函数:在数据库中创建聊天室
    void createRoomInDb(int userId, const std::string& name, const std::string& type, int docId,
                        const Json::Value& memberIdsArray,
                        std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback);

    // 辅助函数:添加成员到聊天室
    void addMembersToRoom(int roomId, const std::vector<int>& memberIds,
                          std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                          std::function<void(int)> onSuccess);
};