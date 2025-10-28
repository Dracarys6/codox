cmake_minimum_required(VERSION 3.24)
project(collab_cpp_service LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Drogon REQUIRED)
find_package(PQXX REQUIRED)

add_executable(cpp-service
  src/main.cpp
  src/controllers/HealthController.cc
)

target_include_directories(cpp-service PRIVATE src)

target_link_libraries(cpp-service
  PRIVATE
    Drogon::Drogon
    pqxx
)


