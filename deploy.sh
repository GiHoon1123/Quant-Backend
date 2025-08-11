#!/bin/bash

# 🚀 Quant Backend 자동 배포 스크립트
# 이 스크립트를 실행하면 자동으로 Docker 이미지를 빌드하고 컨테이너를 실행합니다
# 사용법: ./deploy.sh [up|down|logs|status|build]

set -e  # 에러가 발생하면 스크립트 중단

# 🔧 환경변수 로드
load_environment_variables() {
    log_info "🔧 환경변수 로드 중..."
    
    # .env.dev 파일이 있는지 확인
    if [ -f ".env.dev" ]; then
        log_info "📄 .env.dev 파일에서 환경변수를 로드합니다..."
        export $(grep -v '^#' .env.dev | xargs)
        log_success "✅ 환경변수 로드 완료"
    else
        log_warning "⚠️ .env.dev 파일을 찾을 수 없습니다."
        log_info "💡 기본 환경변수를 사용합니다."
    fi
    
    # 필수 환경변수 확인
    if [ -z "$BINANCE_API_KEY" ] || [ -z "$BINANCE_API_SECRET" ]; then
        log_warning "⚠️ Binance API 키가 설정되지 않았습니다."
        log_info "💡 .env.dev 파일에 BINANCE_API_KEY와 BINANCE_API_SECRET을 설정해주세요."
    fi
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        log_warning "⚠️ Telegram 설정이 완료되지 않았습니다."
        log_info "💡 .env.dev 파일에 TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 설정해주세요."
    fi
}

# 🎨 색상 정의 (터미널에서 예쁘게 표시하기 위해)
RED='\033[0;31m'      # 빨간색 (에러)
GREEN='\033[0;32m'    # 초록색 (성공)
YELLOW='\033[1;33m'   # 노란색 (경고)
BLUE='\033[0;34m'     # 파란색 (정보)
NC='\033[0m'          # 색상 초기화

# 📝 로그 출력 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 🔍 Docker 설치 확인
check_docker() {
    log_info "Docker 설치 확인 중..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        log_info "Docker를 먼저 설치해주세요: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        log_info "Docker Compose를 먼저 설치해주세요."
        exit 1
    fi
    
    log_success "Docker 설치 확인 완료"
}

# 🏗️ Docker Compose 명령어 확인 (버전에 따라 다름)
get_compose_command() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    elif docker compose version &> /dev/null; then
        echo "docker compose"
    else
        log_error "Docker Compose를 찾을 수 없습니다."
        exit 1
    fi
}

# 🔍 PostgreSQL 컨테이너 확인 및 생성
check_postgres_container() {
    log_info "🗄️ PostgreSQL 컨테이너 확인 중..."
    
    if docker ps -q -f name=postgres | grep -q .; then
        log_success "✅ 기존 PostgreSQL 컨테이너가 실행 중입니다."
        return 0
    elif docker ps -aq -f name=postgres | grep -q .; then
        log_warning "⚠️ 중지된 PostgreSQL 컨테이너가 있습니다. 재시작합니다..."
        docker start postgres
        log_success "✅ PostgreSQL 컨테이너가 재시작되었습니다."
        return 0
    else
        log_info "📦 새로운 PostgreSQL 컨테이너를 생성합니다..."
        docker run --name postgres \
            -e POSTGRES_USER=root \
            -e POSTGRES_PASSWORD=1234 \
            -e POSTGRES_DB=market_data \
            -p 5432:5432 \
            -d postgres:15
        
        log_success "✅ PostgreSQL 컨테이너가 생성되었습니다."
        return 0
    fi
}

# 🚀 서비스 시작 (이미지 빌드 + 컨테이너 실행)
up() {
    log_info "🚀 Quant Backend 서비스 시작 중..."
    
    # 환경변수 로드
    load_environment_variables
    
    check_docker
    COMPOSE_CMD=$(get_compose_command)
    
    # PostgreSQL 컨테이너 확인 및 생성
    check_postgres_container
    
    log_info "1단계: Docker 이미지 빌드 및 컨테이너 시작"
    $COMPOSE_CMD up -d --build
    
    log_success "✅ 서비스가 성공적으로 시작되었습니다!"
    log_info "📊 상태 확인: ./deploy.sh status"
    log_info "📋 로그 확인: ./deploy.sh logs"
    log_info "🌐 웹 접속: http://localhost:3000"
    log_info "🗄️  데이터베이스: localhost:5432"
}

# ⏹️ 서비스 중지
down() {
    log_info "⏹️ 서비스 중지 중..."
    
    COMPOSE_CMD=$(get_compose_command)
    $COMPOSE_CMD down
    
    log_success "✅ 서비스가 중지되었습니다."
    log_info "💡 PostgreSQL 컨테이너는 유지됩니다. (데이터 보호)"
}

# 📋 로그 확인
logs() {
    log_info "📋 애플리케이션 로그 확인 중..."
    
    COMPOSE_CMD=$(get_compose_command)
    $COMPOSE_CMD logs -f app
}

# 📊 상태 확인
status() {
    log_info "📊 서비스 상태 확인 중..."
    
    COMPOSE_CMD=$(get_compose_command)
    
    echo ""
    log_info "🔍 Docker Compose 상태:"
    $COMPOSE_CMD ps
    
    echo ""
    log_info "🐳 실행 중인 컨테이너들:"
    docker ps --filter "name=quant-backend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    log_info "💾 볼륨 상태:"
    docker volume ls --filter "name=quant-backend"
}

# 🏗️ 이미지만 빌드 (실행하지 않음)
build() {
    log_info "🏗️ Docker 이미지 빌드 중..."
    
    check_docker
    COMPOSE_CMD=$(get_compose_command)
    
    $COMPOSE_CMD build --no-cache
    
    log_success "✅ 이미지 빌드가 완료되었습니다."
    log_info "🚀 서비스 시작: ./deploy.sh up"
}

# 🔄 서비스 재시작
restart() {
    log_info "🔄 서비스 재시작 중..."
    
    COMPOSE_CMD=$(get_compose_command)
    $COMPOSE_CMD restart
    
    log_success "✅ 서비스가 재시작되었습니다."
}

# 🧹 모든 데이터 삭제 (주의!)
cleanup() {
    log_warning "⚠️  모든 데이터를 삭제하시겠습니까? (y/N)"
    log_warning "   이 작업은 되돌릴 수 없습니다!"
    log_warning "   PostgreSQL 컨테이너는 보호됩니다."
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "🧹 모든 데이터 삭제 중..."
        
        COMPOSE_CMD=$(get_compose_command)
        $COMPOSE_CMD down -v  # 볼륨도 함께 삭제
        
        # 볼륨 강제 삭제 (PostgreSQL 볼륨은 제외)
        docker volume rm quant-backend_postgres_data 2>/dev/null || true
        
        log_success "✅ 모든 데이터가 삭제되었습니다."
        log_info "💡 PostgreSQL 컨테이너는 보호되었습니다."
    else
        log_info "❌ 삭제가 취소되었습니다."
    fi
}

# 📚 도움말 표시
show_help() {
    echo "🚀 Quant Backend 자동 배포 스크립트"
    echo ""
    echo "📖 사용법:"
    echo "  ./deploy.sh up        - 🚀 서비스 시작 (빌드 + 실행)"
    echo "  ./deploy.sh down      - ⏹️  서비스 중지"
    echo "  ./deploy.sh logs      - 📋 애플리케이션 로그 확인"
    echo "  ./deploy.sh status    - 📊 서비스 상태 확인"
    echo "  ./deploy.sh build     - 🏗️ 이미지만 빌드 (실행 안함)"
    echo "  ./deploy.sh restart   - 🔄 서비스 재시작"
    echo "  ./deploy.sh cleanup   - 🧹 모든 데이터 삭제 (주의!)"
    echo "  ./deploy.sh help      - 📚 도움말 표시"
    echo ""
    echo "🔧 환경 변수 설정 (선택사항):"
    echo "  export BINANCE_API_KEY=your-api-key"
    echo "  export BINANCE_SECRET_KEY=your-secret-key"
    echo "  export TELEGRAM_BOT_TOKEN=your-bot-token"
    echo "  export TELEGRAM_CHAT_ID=your-chat-id"
    echo "  export DATABASE_USERNAME=your-username"
    echo "  export DATABASE_PASSWORD=your-password"
    echo ""
    echo "💡 예시:"
    echo "  ./deploy.sh up        # 서비스 시작"
    echo "  ./deploy.sh logs      # 로그 확인"
    echo "  ./deploy.sh status    # 상태 확인"
    echo ""
    echo "🌐 접속 정보:"
    echo "  웹 애플리케이션: http://localhost:3000"
    echo "  데이터베이스: localhost:5432"
}

# 🎯 메인 함수 (명령어 처리)
main() {
    case "${1:-help}" in
        "up")
            up
            ;;
        "down")
            down
            ;;
        "logs")
            logs
            ;;
        "status")
            status
            ;;
        "build")
            build
            ;;
        "restart")
            restart
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# �� 스크립트 실행
main "$@"
