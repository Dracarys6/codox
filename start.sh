# 启动 PostgreSQL
echo "启动 PostgreSQL..."
sudo service postgresql start

# 启动 Docker 服务（如果使用）
if [ -f "docker-compose.yml" ]; then
    echo "启动 Docker 服务..."
    docker-compose up -d
fi

# 启动 C++ 后端服务
echo "启动 C++ 后端服务..."
cd cpp-service/build
./cpp-service &
CPP_PID=$!
echo "C++ 后端服务 PID: $CPP_PID"

# 启动前端服务
echo "启动前端服务..."
cd ../../frontend
npm run dev &
FRONTEND_PID=$!
echo "前端服务 PID: $FRONTEND_PID"

# 启动协作服务（如果存在）
if [ -d "../collab-service" ]; then
    echo "启动协作服务..."
    cd ../collab-service
    npm start &
    COLLAB_PID=$!
    echo "协作服务 PID: $COLLAB_PID"
fi

echo ""
echo "所有服务已启动！"
echo "前端: http://localhost:5173"
echo "后端 API: http://localhost:8080"
echo "协作服务: ws://localhost:1234"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待中断信号
trap "kill $CPP_PID $FRONTEND_PID $COLLAB_PID 2>/dev/null; exit" INT
wait
