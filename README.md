# 📈 Quant Backend

**Binance 실시간 현물(Spot) 거래 데이터를 기반으로 한 백엔드 시스템**

---

## 🎯 목표

- Binance 현물 WebSocket API를 이용해 실시간 체결 데이터를 수신
- 수신한 데이터를 가공하여 WebSocket을 통해 프론트에 전송
- 추후 조건 기반 거래 전략(퀀트 전략) 구현 및 자동 매매 시스템 확장

---

## 🛠️ 기술 스택

- **Node.js (NestJS 10.x)**
- **Socket.IO (서버/클라이언트)**
- **TypeScript**
- **Binance Spot WebSocket API**

---

## 🔜 향후 구현 예정

- [ ] 1분봉(kline) 데이터 수신 및 분석
- [ ] 거래 전략 기반 조건 판단 및 트리거 로직
- [ ] 거래 체결 요청 기능 및 로그 저장
- [ ] 전략별 수익률 모니터링 기능
- [ ] 사용자 설정 기반 종목/전략 선택 및 프론트 연동

---

## 🏁 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev

# 클라이언트 테스트 (HTML 열기)
open ./public/index.html
```
