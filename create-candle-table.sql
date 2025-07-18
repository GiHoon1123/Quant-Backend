-- =========================================
-- 15분봉 캔들 데이터 테이블 생성 SQL
-- =========================================
-- 실행 순서:
-- 1. 이 파일의 모든 SQL을 복사
-- 2. PostgreSQL 클라이언트에서 실행
-- 3. 완료 후 애플리케이션 실행
-- =========================================

-- 1. 기존 테이블 삭제 (재생성 시)
DROP TABLE IF EXISTS "candle_15m" CASCADE;

-- 2. 15분봉 캔들 테이블 생성
CREATE TABLE "candle_15m" (
  -- 기본 키 및 식별자
  "id" BIGSERIAL NOT NULL,
  "symbol" VARCHAR(20) NOT NULL,                    -- 거래 심볼 (예: BTCUSDT, ETHUSDT)
  "market" VARCHAR(10) NOT NULL,                    -- 시장 구분 (FUTURES: 선물, SPOT: 현물)
  "timeframe" VARCHAR(5) NOT NULL DEFAULT '15m',    -- 시간봉 구분 (15분봉 고정)
  
  -- 캔들 시간 정보 (UTC 기준)
  "open_time" TIMESTAMP NOT NULL,                   -- 캔들 시작 시간
  "close_time" TIMESTAMP NOT NULL,                  -- 캔들 종료 시간
  
  -- OHLC 가격 데이터 (고정밀 소수점)
  "open" DECIMAL(20,8) NOT NULL,                    -- 시가
  "high" DECIMAL(20,8) NOT NULL,                    -- 고가
  "low" DECIMAL(20,8) NOT NULL,                     -- 저가
  "close" DECIMAL(20,8) NOT NULL,                   -- 종가
  
  -- 거래량 및 거래 정보
  "volume" DECIMAL(20,8) NOT NULL,                  -- 거래량
  "quote_volume" DECIMAL(20,8) NOT NULL,            -- 거래대금
  "trades" INTEGER NOT NULL,                        -- 거래 횟수
  "taker_buy_base_volume" DECIMAL(20,8) NOT NULL,   -- 능동 매수 거래량
  "taker_buy_quote_volume" DECIMAL(20,8) NOT NULL,  -- 능동 매수 거래대금
  
  -- 메타데이터
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),    -- 생성 시간
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),    -- 수정 시간
  
  -- 기본 키
  CONSTRAINT "PK_candle_15m" PRIMARY KEY ("id")
);

-- 3. UNIQUE 제약 조건 (중복 방지)
ALTER TABLE "candle_15m" 
ADD CONSTRAINT "UQ_candle_15m_symbol_market_time" 
UNIQUE ("symbol", "market", "open_time");

-- 4. CHECK 제약 조건들
-- 가격은 모두 양수여야 함
ALTER TABLE "candle_15m"
ADD CONSTRAINT "CHK_candle_15m_prices_positive"
CHECK ("open" > 0 AND "high" > 0 AND "low" > 0 AND "close" > 0);

-- OHLC 논리 검증 (고가 >= 시가,종가 AND 저가 <= 시가,종가)
ALTER TABLE "candle_15m"
ADD CONSTRAINT "CHK_candle_15m_ohlc_logic"
CHECK (
  "high" >= GREATEST("open", "close") AND 
  "low" <= LEAST("open", "close")
);

-- 거래량은 0 이상이어야 함
ALTER TABLE "candle_15m"
ADD CONSTRAINT "CHK_candle_15m_volumes_non_negative"
CHECK (
  "volume" >= 0 AND 
  "quote_volume" >= 0 AND 
  "trades" >= 0 AND
  "taker_buy_base_volume" >= 0 AND
  "taker_buy_quote_volume" >= 0
);

-- 시간 논리 검증 (시작 시간 < 종료 시간)
ALTER TABLE "candle_15m"
ADD CONSTRAINT "CHK_candle_15m_time_logic"
CHECK ("open_time" < "close_time");

-- 5. 성능 최적화 인덱스들
-- 심볼별 조회
CREATE INDEX "IDX_candle_15m_symbol" 
ON "candle_15m" ("symbol");

-- 심볼+시장별 조회 (가장 자주 사용)
CREATE INDEX "IDX_candle_15m_symbol_market" 
ON "candle_15m" ("symbol", "market");

-- 심볼+시장+시간 조회 (백테스팅용)
CREATE INDEX "IDX_candle_15m_symbol_market_time" 
ON "candle_15m" ("symbol", "market", "open_time");

-- 시간별 조회
CREATE INDEX "IDX_candle_15m_open_time" 
ON "candle_15m" ("open_time");

-- 생성시간별 조회
CREATE INDEX "IDX_candle_15m_created_at" 
ON "candle_15m" ("created_at");

-- 시장별 조회
CREATE INDEX "IDX_candle_15m_market" 
ON "candle_15m" ("market");

-- 거래량 정렬 (높은 거래량 먼저)
CREATE INDEX "IDX_candle_15m_volume_desc" 
ON "candle_15m" ("volume" DESC);

-- 6. 테이블 및 컬럼 코멘트
COMMENT ON TABLE "candle_15m" IS '15분봉 캔들스틱 데이터 - 바이낸스 선물/현물 실시간 데이터';

COMMENT ON COLUMN "candle_15m"."id" IS '고유 식별자 (자동증가)';
COMMENT ON COLUMN "candle_15m"."symbol" IS '거래 심볼 (예: BTCUSDT, ETHUSDT)';
COMMENT ON COLUMN "candle_15m"."market" IS '시장 구분 (FUTURES: 선물, SPOT: 현물)';
COMMENT ON COLUMN "candle_15m"."timeframe" IS '시간봉 구분 (현재 15m 고정)';
COMMENT ON COLUMN "candle_15m"."open_time" IS '캔들 시작 시간 (UTC)';
COMMENT ON COLUMN "candle_15m"."close_time" IS '캔들 종료 시간 (UTC)';
COMMENT ON COLUMN "candle_15m"."open" IS '시가 - 15분봉 시작가';
COMMENT ON COLUMN "candle_15m"."high" IS '고가 - 15분봉 최고가';
COMMENT ON COLUMN "candle_15m"."low" IS '저가 - 15분봉 최저가';
COMMENT ON COLUMN "candle_15m"."close" IS '종가 - 15분봉 종료가';
COMMENT ON COLUMN "candle_15m"."volume" IS '거래량 - 기본 자산 기준';
COMMENT ON COLUMN "candle_15m"."quote_volume" IS '거래대금 - 견적 자산 기준';
COMMENT ON COLUMN "candle_15m"."trades" IS '거래 횟수';
COMMENT ON COLUMN "candle_15m"."taker_buy_base_volume" IS '능동 매수 거래량';
COMMENT ON COLUMN "candle_15m"."taker_buy_quote_volume" IS '능동 매수 거래대금';
COMMENT ON COLUMN "candle_15m"."created_at" IS '레코드 생성 시간';
COMMENT ON COLUMN "candle_15m"."updated_at" IS '레코드 수정 시간';

-- 7. 마이그레이션 히스토리 테이블 (선택사항)
-- TypeORM이 사용하는 마이그레이션 추적 테이블
CREATE TABLE IF NOT EXISTS "typeorm_migrations" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "timestamp" BIGINT NOT NULL,
  "name" VARCHAR NOT NULL
);

-- 마이그레이션 실행 기록 추가 (선택사항)
INSERT INTO "typeorm_migrations" ("timestamp", "name") 
VALUES (1705555200000, 'CreateCandle15MTable1705555200000')
ON CONFLICT DO NOTHING;

-- =========================================
-- 완료! 🎉
-- =========================================
-- 이제 다음 명령으로 테이블 확인:
-- \dt candle_15m
-- \d candle_15m
-- SELECT COUNT(*) FROM candle_15m;
-- =========================================
