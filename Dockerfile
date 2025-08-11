# 🐳 NestJS 애플리케이션을 위한 Docker 이미지 만들기
# 이 파일은 우리가 만든 NestJS 앱을 컨테이너로 실행할 수 있게 이미지로 만드는 방법을 정의합니다

# 1단계: 기본 이미지 선택 (Node.js 20 버전, Alpine 리눅스 - 가벼운 버전)
FROM node:20-alpine

# 2단계: 작업 디렉토리 설정 (컨테이너 안에서 앱이 실행될 폴더)
WORKDIR /app

# 3단계: 패키지 파일들 복사 (package.json, package-lock.json)
# 의존성 설치를 위해 먼저 복사 (Docker 캐싱 최적화)
COPY package*.json ./

# 4단계: 의존성 설치 (프로덕션용으로만 설치 - 개발 도구 제외)
RUN npm ci --only=production

# 5단계: 소스 코드 복사 (우리가 만든 모든 파일들)
COPY . .

# 6단계: TypeScript 코드를 JavaScript로 빌드
RUN npm run build

# 7단계: 포트 노출 (컨테이너가 3000번 포트를 사용한다고 알림)
EXPOSE 3000

# 8단계: 헬스체크를 위한 curl 설치 (컨테이너가 제대로 실행되는지 확인용)
RUN apk add --no-cache curl

# 9단계: 애플리케이션 실행 명령어 (컨테이너가 시작될 때 실행될 명령)
CMD ["npm", "run", "start:prod"]
