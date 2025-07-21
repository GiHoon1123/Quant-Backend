import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CommonResponse } from 'src/common/response/CommonResponse';
import { ClosePositionRequest } from '../dto/request/ClosePositionRequest';
import { OpenPositionRequest } from '../dto/request/OpenPositionRequest';
import { SetLeverageRequest } from '../dto/request/SetLeverageRequest';
import { SetMarginTypeRequest } from '../dto/request/SetMarginTypeRequest';
import { TransferFundsRequest } from '../dto/request/TransferFundsRequest';
import { FuturesService } from '../service/FuturesService';

/**
 * 선물거래 컨트롤러
 *
 * 바이낸스 선물거래 API의 모든 엔드포인트를 제공합니다.
 * RESTful API 설계를 따르며, Swagger 문서화가 완료되어 있습니다.
 *
 * ⚠️ 중요한 안전 공지:
 * - 선물거래는 높은 위험을 수반합니다
 * - 레버리지 사용 시 손실이 원금을 초과할 수 있습니다
 * - 충분한 이해 없이 사용하지 마세요
 * - 반드시 테스트넷에서 충분히 테스트 후 사용하세요
 *
 * 📚 API 문서: /api-docs 에서 상세한 API 문서를 확인할 수 있습니다
 */
@ApiTags('선물거래 🚀')
@Controller('futures')
export class FuturesController {
  constructor(private readonly futuresService: FuturesService) {}

  /**
   * 선물 포지션 진입 API
   *
   * 📈 기능: 롱(상승베팅) 또는 숏(하락베팅) 포지션을 시장가로 즉시 진입
   *
   * ⚡ 처리 과정:
   * 1. 레버리지 자동 설정
   * 2. 잔고 충분성 확인
   * 3. 최소 주문 금액 검증
   * 4. 포지션 즉시 진입
   *
   * ⚠️ 주의사항:
   * - 시장가 주문으로 슬리피지 발생 가능
   * - 높은 레버리지는 높은 위험 의미
   * - 충분한 마진 확보 필요
   */
  @Post('/position/open')
  @ApiOperation({
    summary: '선물 포지션 진입 (롱/숏)',
    description: `
      🎯 새로운 선물 포지션을 진입합니다.
      
      **포지션 타입:**
      - LONG: 가격 상승 시 수익 (매수 포지션)
      - SHORT: 가격 하락 시 수익 (매도 포지션)
      
      **안전 기능:**
      ✅ 자동 레버리지 설정
      ✅ 잔고 충분성 검증
      ✅ 최소 주문 금액 확인
      ✅ 기존 포지션 알림
      
      **위험 경고:** 선물거래는 원금 손실 위험이 있습니다.
    `,
  })
  @ApiOkResponse({
    description: '포지션 진입 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT LONG 포지션 진입이 완료되었습니다.',
        data: {
          orderId: 123456789,
          symbol: 'BTCUSDT',
          side: 'LONG',
          quantity: 0.001,
          executedQuantity: 0.001,
          avgPrice: 45000.0,
          totalAmount: 45.0,
          status: 'FILLED',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async openPosition(@Body() dto: OpenPositionRequest) {
    const result = await this.futuresService.openPosition(
      dto.symbol,
      dto.side,
      dto.quantity,
      dto.leverage,
    );

    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} ${dto.side} 포지션 진입이 완료되었습니다.`,
      data: result,
    });
  }

  /**
   * 선물 포지션 청산 API
   *
   * 💰 기능: 보유중인 포지션을 전체 또는 부분 청산
   *
   * 📊 청산 옵션:
   * - 전체 청산: quantity 미지정 시
   * - 부분 청산: 특정 수량 지정 시
   *
   * 🔒 안전 검증:
   * - 포지션 존재 여부 확인
   * - 청산 수량 유효성 검사
   * - 여러 포지션 보유 시 안내
   */
  @Post('/position/close')
  @ApiOperation({
    summary: '선물 포지션 청산 (전체/부분)',
    description: `
      💸 보유중인 포지션을 청산하여 손익을 실현합니다.
      
      **청산 방식:**
      - 전체 청산: quantity를 지정하지 않으면 해당 심볼의 모든 포지션 청산
      - 부분 청산: 특정 수량만 청산하여 일부 포지션 유지
      
      **안전 기능:**
      ✅ 포지션 존재 여부 확인
      ✅ 청산 수량 검증
      ✅ 여러 포지션 처리 안내
      
      **즉시 실행:** 시장가로 즉시 청산됩니다.
    `,
  })
  @ApiOkResponse({
    description: '포지션 청산 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT 포지션 청산이 완료되었습니다.',
        data: {
          orderId: 123456790,
          symbol: 'BTCUSDT',
          side: 'SELL',
          quantity: 0.001,
          executedQuantity: 0.001,
          avgPrice: 46000.0,
          totalAmount: 46.0,
          status: 'FILLED',
          timestamp: '2024-01-01T00:05:00.000Z',
        },
      },
    },
  })
  async closePosition(@Body() dto: ClosePositionRequest) {
    const result = await this.futuresService.closePosition(
      dto.symbol,
      dto.quantity,
    );

    const actionText = dto.quantity ? '부분 청산' : '전체 청산';
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 포지션 ${actionText}이 완료되었습니다.`,
      data: result,
    });
  }

  /**
   * 레버리지 설정 API
   *
   * ⚙️ 기능: 특정 심볼의 레버리지 배수 설정
   *
   * 📊 레버리지 범위: 1배 ~ 125배
   *
   * 💡 팁:
   * - 낮은 레버리지: 안전하지만 자금효율성 낮음
   * - 높은 레버리지: 위험하지만 높은 수익 가능성
   *
   * ⚠️ 제한사항: 포지션이 있는 상태에서는 변경 제한 가능
   */
  @Post('/leverage')
  @ApiOperation({
    summary: '레버리지 설정',
    description: `
      🎚️ 특정 심볼의 레버리지를 설정합니다.
      
      **레버리지 가이드:**
      - 1~5배: 보수적, 초보자 권장
      - 5~20배: 중간 위험도
      - 20~125배: 고위험, 전문가용
      
      **주의사항:**
      ⚠️ 높은 레버리지 = 높은 위험
      ⚠️ 포지션 보유 시 변경 제한 가능
      ⚠️ 청산 위험 증가
      
      **자동 적용:** 다음 포지션부터 적용됩니다.
    `,
  })
  @ApiOkResponse({
    description: '레버리지 설정 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT 레버리지가 10배로 설정되었습니다.',
        data: {
          symbol: 'BTCUSDT',
          leverage: 10,
          maxNotional: '1000000',
        },
      },
    },
  })
  async setLeverage(@Body() dto: SetLeverageRequest) {
    const result = await this.futuresService.setLeverage(
      dto.symbol,
      dto.leverage,
    );

    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 레버리지가 ${dto.leverage}배로 설정되었습니다.`,
      data: result,
    });
  }

  /**
   * 마진 모드 설정 API
   *
   * 🔧 기능: 격리마진 또는 교차마진 모드 설정
   *
   * 📋 마진 모드:
   * - ISOLATED (격리마진): 포지션별 마진 분리, 안전
   * - CROSSED (교차마진): 전체 잔고 활용, 효율적
   *
   * 🎯 선택 가이드:
   * - 초보자: ISOLATED 권장 (위험 제한)
   * - 숙련자: CROSSED (자금 효율성)
   */
  @Post('/margin-type')
  @ApiOperation({
    summary: '마진 모드 설정 (격리/교차)',
    description: `
      🔄 마진 모드를 설정합니다.
      
      **마진 모드 비교:**
      
      **ISOLATED (격리마진)**
      ✅ 포지션별 독립적 마진
      ✅ 위험 제한적
      ✅ 초보자 친화적
      ❌ 자금 효율성 낮음
      
      **CROSSED (교차마진)**
      ✅ 전체 잔고 활용
      ✅ 청산 위험 낮음
      ✅ 자금 효율성 높음
      ❌ 전체 계정 위험
      
      **주의:** 포지션 보유 시 변경 불가능
    `,
  })
  @ApiOkResponse({
    description: '마진 모드 설정 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT 마진 모드가 격리마진으로 설정되었습니다.',
        data: {
          symbol: 'BTCUSDT',
          marginType: 'ISOLATED',
        },
      },
    },
  })
  async setMarginType(@Body() dto: SetMarginTypeRequest) {
    const result = await this.futuresService.setMarginType(
      dto.symbol,
      dto.marginType,
    );

    const marginTypeText =
      dto.marginType === 'ISOLATED' ? '격리마진' : '교차마진';
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 마진 모드가 ${marginTypeText}으로 설정되었습니다.`,
      data: result,
    });
  }

  /**
   * 현재 포지션 조회 API
   *
   * 📊 기능: 보유중인 모든 선물 포지션 정보 조회
   *
   * 🔍 제공 정보:
   * - 포지션 수량 및 방향 (롱/숏)
   * - 진입가격 및 현재 손익
   * - 청산가격 및 위험도
   * - 레버리지 및 마진 정보
   *
   * 💡 활용법: 포트폴리오 관리 및 위험 모니터링
   */
  @Get('/positions')
  @ApiOperation({
    summary: '현재 포지션 조회',
    description: `
      📈 현재 보유중인 모든 선물 포지션을 조회합니다.
      
      **제공 정보:**
      📊 포지션 기본 정보 (심볼, 수량, 방향)
      💰 손익 정보 (미실현 PnL, 수익률)
      ⚠️ 위험 정보 (청산가격, 유지마진율)
      🎚️ 설정 정보 (레버리지, 마진모드)
      
      **실시간 데이터:** 바이낸스에서 실시간으로 조회
      **포지션 없음:** 빈 배열 반환
    `,
  })
  @ApiQuery({
    name: 'symbol',
    required: false,
    description: '특정 심볼만 조회 (선택사항)',
    example: 'BTCUSDT',
  })
  @ApiOkResponse({
    description: '포지션 조회 성공',
    schema: {
      example: {
        status: 200,
        message: '현재 포지션 정보입니다.',
        data: [
          {
            symbol: 'BTCUSDT',
            quantity: 0.001,
            side: 'LONG',
            entryPrice: 45000.0,
            markPrice: 46000.0,
            unrealizedPnl: 1.0,
            unrealizedPnlPercent: 2.22,
            liquidationPrice: 40500.0,
            leverage: 10,
            marginType: 'ISOLATED',
            notionalValue: 46.0,
            isolatedMargin: 4.6,
            maintMarginRatio: 0.15,
            updateTime: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getPositions(@Query('symbol') symbol?: string) {
    const result = await this.futuresService.getPositions(symbol);

    const messageText = symbol
      ? `${symbol} 포지션 정보입니다.`
      : '현재 포지션 정보입니다.';

    return CommonResponse.success({
      status: 200,
      message: messageText,
      data: result,
    });
  }

  /**
   * 선물 잔고 조회 API
   *
   * 💰 기능: 선물 계정의 모든 자산 잔고 정보 조회
   *
   * 📊 제공 정보:
   * - 총 잔고 (포지션 마진 포함)
   * - 사용 가능한 잔고 (신규 포지션 가능)
   * - 최대 출금 가능 금액
   * - 미실현 손익 포함 교차마진 잔고
   *
   * 🎯 활용법: 자금 관리 및 포지션 계획 수립
   */
  @Get('/balances')
  @ApiOperation({
    summary: '선물 계정 잔고 조회',
    description: `
      💼 선물 계정의 모든 자산 잔고를 조회합니다.
      
      **잔고 종류:**
      💰 총 잔고: 포지션 마진 + 사용가능 잔고
      ✅ 사용가능: 신규 포지션 진입 가능 금액
      📤 출금가능: 실제 출금 가능한 최대 금액
      🔄 교차마진: 교차마진 모드에서 사용되는 잔고
      
      **실시간 정보:** 포지션 손익 반영된 최신 잔고
      **잔고 필터링:** 0보다 큰 잔고만 표시
    `,
  })
  @ApiOkResponse({
    description: '잔고 조회 성공',
    schema: {
      example: {
        status: 200,
        message: '선물 계정 잔고 정보입니다.',
        data: [
          {
            asset: 'USDT',
            totalBalance: 1000.0,
            availableBalance: 950.0,
            maxWithdrawAmount: 950.0,
            crossWalletBalance: 1000.0,
            crossUnrealizedPnl: 10.0,
            marginAvailable: true,
            updateTime: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getFuturesBalances() {
    const result = await this.futuresService.getFuturesBalances();

    return CommonResponse.success({
      status: 200,
      message: '선물 계정 잔고 정보입니다.',
      data: result,
    });
  }

  /**
   * 위험 포지션 조회 API
   *
   * ⚠️ 기능: 청산 위험이 높은 포지션들을 조회
   *
   * 🚨 위험 지표: 유지마진율 기준으로 판단
   * - 80% 이상: 매우 위험 (즉시 조치 필요)
   * - 60% 이상: 위험 (주의 필요)
   * - 40% 이하: 안전
   *
   * 🛡️ 위험 관리: 정기적인 모니터링 권장
   */
  @Get('/positions/high-risk')
  @ApiOperation({
    summary: '위험 포지션 조회 (청산 위험)',
    description: `
      🚨 청산 위험이 높은 포지션들을 조회합니다.
      
      **위험도 기준:**
      🔴 80% 이상: 매우 위험 (즉시 마진 추가 또는 청산)
      🟡 60-80%: 위험 (주의 깊은 모니터링)
      🟢 40% 이하: 안전
      
      **권장 조치:**
      1️⃣ 추가 마진 입금
      2️⃣ 포지션 부분 청산
      3️⃣ 스탑로스 설정
      4️⃣ 레버리지 조정 (다음 거래부터)
      
      **모니터링:** 시장 변동성 높을 때 수시 확인 필요
    `,
  })
  @ApiQuery({
    name: 'riskThreshold',
    required: false,
    description: '위험 임계값 (0.0~1.0, 기본값: 0.8)',
    example: 0.8,
  })
  @ApiOkResponse({
    description: '위험 포지션 조회 성공',
    schema: {
      example: {
        status: 200,
        message: '청산 위험이 높은 포지션들입니다.',
        data: [
          {
            symbol: 'ETHUSDT',
            quantity: 0.1,
            side: 'SHORT',
            entryPrice: 3000.0,
            markPrice: 3100.0,
            unrealizedPnl: -10.0,
            unrealizedPnlPercent: -3.33,
            liquidationPrice: 3150.0,
            leverage: 20,
            marginType: 'ISOLATED',
            notionalValue: 310.0,
            isolatedMargin: 15.5,
            maintMarginRatio: 0.85,
            updateTime: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getHighRiskPositions(@Query('riskThreshold') riskThreshold?: number) {
    const threshold = riskThreshold || 0.8;
    const result = await this.futuresService.getHighRiskPositions(threshold);

    return CommonResponse.success({
      status: 200,
      message: `청산 위험이 높은 포지션들입니다. (임계값: ${(threshold * 100).toFixed(0)}%)`,
      data: result,
    });
  }

  /**
   * 계좌 간 자금 이체 API
   *
   * 💰 기능: 현물 계좌와 선물 계좌 간 자금 이체
   *
   * 📊 이체 방향:
   * - SPOT → FUTURES: 선물 거래를 위한 자금 이체
   * - FUTURES → SPOT: 선물 계좌에서 현물 계좌로 자금 회수
   *
   * ⚠️ 주의사항:
   * - 포지션에 사용 중인 자금은 이체 불가
   * - 최소 이체 금액은 자산별로 상이
   */
  @Post('/transfer')
  @ApiOperation({
    summary: '계좌 간 자금 이체',
    description: `
      💸 현물 계좌와 선물 계좌 간 자금을 이체합니다.
      
      **이체 방향:**
      - SPOT → FUTURES: 선물 거래를 위한 자금 이체
      - FUTURES → SPOT: 선물 계좌에서 현물 계좌로 자금 회수
      
      **주요 자산:**
      - USDT: 테더 (가장 일반적인 이체 자산)
      - BTC: 비트코인
      - ETH: 이더리움
      - BNB: 바이낸스 코인
      
      **주의사항:**
      ⚠️ 포지션에 사용 중인 자금은 이체 불가
      ⚠️ 최소 이체 금액은 자산별로 상이
      ⚠️ 이체 후 즉시 반영되지만 UI 갱신에 약간의 시간 소요 가능
    `,
  })
  @ApiOkResponse({
    description: '자금 이체 성공',
    schema: {
      example: {
        status: 200,
        message: '10 USDT가 현물 계좌에서 선물 계좌로 이체되었습니다.',
        data: {
          asset: 'USDT',
          amount: 10,
          fromAccount: 'SPOT',
          toAccount: 'FUTURES',
          transferId: '123456789',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async transferFunds(@Body() dto: TransferFundsRequest) {
    const result = await this.futuresService.transferFunds(
      dto.asset,
      dto.amount,
      dto.fromAccountType,
      dto.toAccountType,
    );

    const fromText = dto.fromAccountType === 'SPOT' ? '현물 계좌' : '선물 계좌';
    const toText = dto.toAccountType === 'SPOT' ? '현물 계좌' : '선물 계좌';

    return CommonResponse.success({
      status: 200,
      message: `${dto.amount} ${dto.asset}가 ${fromText}에서 ${toText}로 이체되었습니다.`,
      data: result,
    });
  }
}
