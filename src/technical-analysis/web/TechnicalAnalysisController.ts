import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ScreenMultipleSymbolsDto,
  StrategyScreeningDto,
} from '../dto/request/TechnicalAnalysisRequest';
import {
  IndicatorSummaryResponse,
  MarketAlertResponse,
  MultiSymbolScreeningResponse,
  StrategyScreeningResponse,
  SymbolAnalysisResponse,
} from '../dto/response/TechnicalAnalysisResponse';
import { AdvancedStrategyService } from '../service/AdvancedStrategyService';
import { PracticalStrategyService } from '../service/PracticalStrategyService';
import { RiskManagementService } from '../service/RiskManagementService';
import { TechnicalAnalysisService } from '../service/TechnicalAnalysisService';
import { StrategyType } from '../types/StrategyTypes';
import { TimeFrame } from '../types/TechnicalAnalysisTypes';

/**
 * 기술적 분석 API 컨트롤러
 *
 * 모든 기술적 분석 기능들을 REST API로 제공하는 컨트롤러입니다.
 * 프론트엔드나 외부 시스템에서 기술적 분석 기능을 사용할 수 있도록 합니다.
 *
 * 🎯 주요 엔드포인트:
 * - GET /analyze/:symbol - 단일 심볼 종합 분석
 * - POST /screen - 다중 심볼 스크리닝
 * - GET /buy-signals - 강한 매수 신호 검색
 * - GET /monitor - 실시간 시장 모니터링
 * - GET /indicators/:symbol - 기술적 지표 요약
 * - POST /strategy-scan - 특정 전략 전체 심볼 스캔
 *
 * 🚀 사용 시나리오:
 * - 웹 대시보드에서 실시간 분석 표시
 * - 모바일 앱에서 알림 서비스
 * - 자동 매매 봇의 신호 소스
 * - 백테스팅 및 연구용 데이터 제공
 */
@ApiTags('기술적 분석')
@Controller('api/v1/analysis/technical')
export class TechnicalAnalysisController {
  constructor(
    private readonly technicalAnalysisService: TechnicalAnalysisService,
    private readonly advancedStrategyService: AdvancedStrategyService,
    private readonly practicalStrategyService: PracticalStrategyService,
    private readonly riskManagementService: RiskManagementService,
  ) {}

  /**
   * 단일 심볼 종합 분석
   *
   * 특정 암호화폐에 대해 여러 전략과 시간봉을 활용한 종합적인 기술적 분석을 수행합니다.
   *
   * @param symbol 분석할 심볼 (예: BTCUSDT)
   * @param strategies 실행할 전략들 (선택사항)
   * @param timeframes 분석할 시간봉들 (선택사항)
   * @returns 종합 분석 결과
   *
   * 🎯 활용 예시:
   * - 특정 코인의 현재 매수/매도 신호 확인
   * - 진입 타이밍 결정을 위한 종합 분석
   * - 포트폴리오 리밸런싱 시 개별 종목 분석
   *
   * 📊 응답 데이터:
   * - 종합 신호 (STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL)
   * - 신뢰도 점수 (0-100%)
   * - 시간봉별 분석 결과
   * - 개별 전략별 상세 결과
   */
  @Get('analyze/:symbol')
  @ApiOperation({
    summary: '단일 심볼 종합 분석',
    description: '특정 암호화폐에 대한 다중 전략 기술적 분석을 수행합니다.',
  })
  @ApiParam({
    name: 'symbol',
    description: '분석할 암호화폐 심볼 (예: BTCUSDT)',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'strategies',
    description: '실행할 전략들 (쉼표로 구분)',
    required: false,
    example: 'MA_20_BREAKOUT,GOLDEN_CROSS_50_200,RSI_OVERSOLD_BOUNCE',
  })
  @ApiQuery({
    name: 'timeframes',
    description: '분석할 시간봉들 (쉼표로 구분)',
    required: false,
    example: '15m,1h,1d',
  })
  @ApiResponse({
    status: 200,
    description: '분석 성공',
    type: SymbolAnalysisResponse,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 파라미터',
  })
  @ApiResponse({
    status: 500,
    description: '분석 처리 실패',
  })
  async analyzeSymbol(
    @Param('symbol') symbol: string,
    @Query('strategies') strategiesParam?: string,
    @Query('timeframes') timeframesParam?: string,
  ): Promise<SymbolAnalysisResponse> {
    console.log(`🔍 API 요청: 심볼 분석 - ${symbol}`);

    // 심볼 검증
    if (!symbol || !symbol.endsWith('USDT')) {
      throw new BadRequestException(
        '유효한 USDT 페어 심볼을 입력해주세요 (예: BTCUSDT)',
      );
    }

    // 전략 파라미터 파싱
    let strategies: StrategyType[] | undefined;
    if (strategiesParam) {
      try {
        strategies = strategiesParam
          .split(',')
          .map((s) => s.trim() as StrategyType)
          .filter((s) => Object.values(StrategyType).includes(s));

        if (strategies.length === 0) {
          throw new Error('유효한 전략이 없습니다');
        }
      } catch (error: any) {
        throw new BadRequestException(
          `전략 파라미터가 잘못되었습니다: ${error.message}`,
        );
      }
    }

    // 시간봉 파라미터 파싱
    let timeframes: TimeFrame[] | undefined;
    if (timeframesParam) {
      try {
        timeframes = timeframesParam
          .split(',')
          .map((tf) => tf.trim() as TimeFrame)
          .filter((tf) => Object.values(TimeFrame).includes(tf));

        if (timeframes.length === 0) {
          throw new Error('유효한 시간봉이 없습니다');
        }
      } catch (error: any) {
        throw new BadRequestException(
          `시간봉 파라미터가 잘못되었습니다: ${error.message}`,
        );
      }
    }

    try {
      const result = await this.technicalAnalysisService.analyzeSymbol(
        symbol.toUpperCase(),
        strategies,
        timeframes,
      );

      return {
        success: true,
        message: '분석이 성공적으로 완료되었습니다',
        data: {
          symbol: symbol.toUpperCase(),
          timestamp: Date.now(),
          analysis: result,
        },
      };
    } catch (error: any) {
      console.error(`❌ 심볼 분석 API 실패: ${symbol}`, error);
      throw new BadRequestException(`분석에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 다중 심볼 스크리닝
   *
   * 여러 암호화폐를 동시에 분석하여 매수/매도 기회를 찾습니다.
   *
   * @param dto 스크리닝 요청 데이터
   * @returns 심볼별 분석 결과
   *
   * 🎯 활용 예시:
   * - 시장에서 매수 기회가 있는 코인들 찾기
   * - 포트폴리오 후보 종목 스크리닝
   * - 전체 시장 동향 파악
   */
  @Post('screen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '다중 심볼 스크리닝',
    description: '여러 암호화폐를 동시에 분석하여 투자 기회를 찾습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '스크리닝 성공',
    type: MultiSymbolScreeningResponse,
  })
  async screenMultipleSymbols(
    @Body() dto: ScreenMultipleSymbolsDto,
  ): Promise<MultiSymbolScreeningResponse> {
    console.log(
      `🔍 API 요청: 다중 심볼 스크리닝 - ${dto.symbols?.length || '기본'} 심볼`,
    );

    try {
      const results = await this.technicalAnalysisService.screenMultipleSymbols(
        dto.symbols,
        dto.strategies,
        dto.timeframes,
      );

      // Map을 Array로 변환
      const symbolResults = Array.from(results.entries()).map(
        ([symbol, result]) => ({
          symbol,
          analysis: result,
        }),
      );

      return {
        success: true,
        message: `${symbolResults.length}개 심볼 스크리닝이 완료되었습니다`,
        data: {
          totalSymbols: dto.symbols?.length || 10,
          validResults: symbolResults.length,
          timestamp: Date.now(),
          results: symbolResults,
        },
      };
    } catch (error: any) {
      console.error('❌ 다중 심볼 스크리닝 API 실패', error);
      throw new BadRequestException(
        `스크리닝에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 강한 매수 신호 검색
   *
   * 높은 신뢰도의 매수 신호가 있는 암호화폐들을 찾습니다.
   *
   * @param symbols 검색할 심볼들

   * @returns 강한 매수 신호 목록
   */
  @Get('buy-signals')
  @ApiOperation({
    summary: '강한 매수 신호 검색',
    description: '높은 신뢰도의 매수 신호가 있는 암호화폐들을 찾습니다.',
  })
  @ApiQuery({
    name: 'symbols',
    description: '검색할 심볼들 (쉼표로 구분)',
    required: false,
    example: 'BTCUSDT,ETHUSDT,ADAUSDT',
  })
  @ApiResponse({
    status: 200,
    description: '검색 성공',
  })
  async findStrongBuySignals(@Query('symbols') symbolsParam?: string) {
    console.log(`🔍 API 요청: 강한 매수 신호 검색`);

    let symbols: string[] | undefined;
    if (symbolsParam) {
      symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
    }

    try {
      const signals =
        await this.technicalAnalysisService.findStrongBuySignals(symbols);

      return {
        success: true,
        message: `${signals.length}개의 강한 매수 신호를 발견했습니다`,
        data: {
          count: signals.length,

          timestamp: Date.now(),
          signals: signals.map(({ symbol, result }) => ({
            symbol,
            signal: result.overallSignal,

            consensus: result.consensus,
            topStrategies: result.strategies
              .filter((s) => s.signal !== 'NEUTRAL')
              .slice(0, 3)
              .map((s) => ({
                strategy: s.strategy,
                signal: s.signal,

                timeframe: s.timeframe,
              })),
          })),
        },
      };
    } catch (error: any) {
      console.error('❌ 강한 매수 신호 검색 API 실패', error);
      throw new BadRequestException(`검색에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 실시간 시장 모니터링
   *
   * 시장에서 주목할만한 움직임이나 신호들을 실시간으로 모니터링합니다.
   *
   * @param symbols 모니터링할 심볼들
   * @param alertThreshold 알림 임계값
   * @returns 알림 목록
   */
  @Get('monitor')
  @ApiOperation({
    summary: '실시간 시장 모니터링',
    description:
      '시장에서 주목할만한 움직임이나 신호들을 실시간으로 감지합니다.',
  })
  @ApiQuery({
    name: 'symbols',
    description: '모니터링할 심볼들 (쉼표로 구분)',
    required: false,
  })
  @ApiQuery({
    name: 'alertThreshold',
    description: '알림 신뢰도 임계값 (0-100)',
    required: false,
    example: 80,
  })
  @ApiResponse({
    status: 200,
    description: '모니터링 성공',
    type: MarketAlertResponse,
  })
  async monitorMarket(
    @Query('symbols') symbolsParam?: string,
    @Query('alertThreshold', new DefaultValuePipe(80), ParseIntPipe)
    alertThreshold?: number,
  ): Promise<MarketAlertResponse> {
    console.log(
      `📡 API 요청: 실시간 시장 모니터링 (알림 임계값: ${alertThreshold}%)`,
    );

    let symbols: string[] | undefined;
    if (symbolsParam) {
      symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
    }

    try {
      const alerts = await this.technicalAnalysisService.monitorMarket(symbols);

      return {
        success: true,
        message: `시장 모니터링 완료: ${alerts.length}개 알림`,
        data: {
          alertCount: alerts.length,
          alertThreshold: alertThreshold ?? 80,
          timestamp: Date.now(),
          alerts: alerts.map(({ symbol, alert, result }) => ({
            symbol,
            alertMessage: alert,
            signal: result.overallSignal,

            consensus: result.consensus,
          })),
        },
      };
    } catch (error: any) {
      console.error('❌ 시장 모니터링 API 실패', error);
      throw new BadRequestException(
        `모니터링에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 기술적 지표 요약 조회
   *
   * 특정 심볼의 주요 기술적 지표들의 현재 상태를 요약해서 제공합니다.
   *
   * @param symbol 조회할 심볼
   * @param timeframe 조회할 시간봉
   * @returns 지표 요약 정보
   */
  @Get('indicators/:symbol')
  @ApiOperation({
    summary: '기술적 지표 요약 조회',
    description: '특정 심볼의 주요 기술적 지표들의 현재 상태를 제공합니다.',
  })
  @ApiParam({
    name: 'symbol',
    description: '조회할 암호화폐 심볼',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'timeframe',
    description: '조회할 시간봉',
    required: false,
    example: '1h',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    type: IndicatorSummaryResponse,
  })
  async getIndicatorSummary(
    @Param('symbol') symbol: string,
    @Query('timeframe', new DefaultValuePipe(TimeFrame.ONE_HOUR))
    timeframe: TimeFrame,
  ): Promise<IndicatorSummaryResponse> {
    console.log(`📊 API 요청: 지표 요약 조회 - ${symbol} ${timeframe}`);

    if (!symbol || !symbol.endsWith('USDT')) {
      throw new BadRequestException('유효한 USDT 페어 심볼을 입력해주세요');
    }

    if (!Object.values(TimeFrame).includes(timeframe)) {
      throw new BadRequestException('유효한 시간봉을 입력해주세요');
    }

    try {
      const summary = await this.technicalAnalysisService.getIndicatorSummary(
        symbol.toUpperCase(),
        timeframe,
      );

      return {
        success: true,
        message: '지표 요약 조회가 완료되었습니다',
        data: summary,
      };
    } catch (error: any) {
      console.error(`❌ 지표 요약 조회 API 실패: ${symbol}`, error);
      throw new BadRequestException(`조회에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 특정 전략의 전체 심볼 스캔
   *
   * 하나의 전략을 여러 심볼에 적용하여 어떤 종목이 해당 전략에 적합한지 찾습니다.
   *
   * @param dto 전략 스캔 요청 데이터
   * @returns 전략별 심볼 분석 결과
   */
  @Post('strategy-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '특정 전략의 전체 심볼 스캔',
    description: '하나의 전략을 여러 심볼에 적용하여 적합한 종목을 찾습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '스캔 성공',
    type: StrategyScreeningResponse,
  })
  async scanStrategyAcrossSymbols(
    @Body() dto: StrategyScreeningDto,
  ): Promise<StrategyScreeningResponse> {
    console.log(`🔍 API 요청: 전략 스캔 - ${dto.strategy} ${dto.timeframe}`);

    try {
      const results =
        await this.technicalAnalysisService.scanStrategyAcrossSymbols(
          dto.strategy,
          dto.timeframe,
          dto.symbols,
        );

      return {
        success: true,
        message: `전략 스캔 완료: ${results.length}개 결과`,
        data: {
          strategy: dto.strategy,
          timeframe: dto.timeframe,
          totalSymbols: dto.symbols?.length || 10,
          resultCount: results.length,
          timestamp: Date.now(),
          results: results.map((result) => ({
            symbol: result.symbol,
            signal: result.signal,

            reasoning: result.reasoning || '분석 완료',
            indicators: result.indicators || {},
          })),
        },
      };
    } catch (error: any) {
      console.error('❌ 전략 스캔 API 실패', error);
      throw new BadRequestException(`스캔에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 고급 전략 실행
   *
   * 특정 심볼에 대해 고급 전략을 실행합니다.
   *
   * @param symbol 분석할 심볼
   * @param strategy 실행할 전략 (선택사항)
   * @param timeframe 분석할 시간봉 (선택사항)
   * @returns 고급 전략 분석 결과
   */
  @Get('advanced/:symbol')
  @ApiOperation({
    summary: '고급 전략 실행',
    description: '특정 심볼에 대해 고급 기술적 분석 전략을 실행합니다.',
  })
  @ApiParam({
    name: 'symbol',
    description: '분석할 암호화폐 심볼',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'strategy',
    description: '실행할 고급 전략',
    required: false,
    example: 'MULTI_TIMEFRAME_MOMENTUM',
  })
  @ApiQuery({
    name: 'timeframe',
    description: '분석할 시간봉',
    required: false,
    example: '1h',
  })
  @ApiResponse({
    status: 200,
    description: '고급 전략 실행 성공',
  })
  async executeAdvancedStrategy(
    @Param('symbol') symbol: string,
    @Query('strategy') strategy?: string,
    @Query('timeframe', new DefaultValuePipe(TimeFrame.ONE_HOUR))
    timeframe?: TimeFrame,
  ) {
    console.log(`🚀 API 요청: 고급 전략 실행 - ${symbol} ${strategy || 'ALL'}`);

    if (!symbol || !symbol.endsWith('USDT')) {
      throw new BadRequestException('유효한 USDT 페어 심볼을 입력해주세요');
    }

    try {
      const result =
        await this.advancedStrategyService.executeSmartMoneyFlowStrategy(
          symbol.toUpperCase(),
          timeframe || TimeFrame.ONE_HOUR,
        );

      return {
        success: true,
        message: '고급 전략 실행이 완료되었습니다',
        data: {
          symbol: symbol.toUpperCase(),
          strategy: strategy || 'ALL_ADVANCED',
          timeframe,
          timestamp: Date.now(),
          result,
        },
      };
    } catch (error: any) {
      console.error(`❌ 고급 전략 실행 API 실패: ${symbol}`, error);
      throw new BadRequestException(`실행에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 실전 전략 실행
   *
   * 특정 심볼에 대해 실전 검증된 전략들을 실행합니다.
   *
   * @param symbol 분석할 심볼
   * @param timeframe 분석할 시간봉 (선택사항)
   * @returns 실전 전략 분석 결과
   */
  @Get('practical/:symbol')
  @ApiOperation({
    summary: '실전 전략 실행',
    description: '특정 심볼에 대해 실전 검증된 전략들을 실행합니다.',
  })
  @ApiParam({
    name: 'symbol',
    description: '분석할 암호화폐 심볼',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'timeframe',
    description: '분석할 시간봉',
    required: false,
    example: '1h',
  })
  @ApiResponse({
    status: 200,
    description: '실전 전략 실행 성공',
  })
  async executePracticalStrategies(
    @Param('symbol') symbol: string,
    @Query('timeframe', new DefaultValuePipe(TimeFrame.ONE_HOUR))
    timeframe?: TimeFrame,
  ) {
    console.log(`💼 API 요청: 실전 전략 실행 - ${symbol} ${timeframe}`);

    if (!symbol || !symbol.endsWith('USDT')) {
      throw new BadRequestException('유효한 USDT 페어 심볼을 입력해주세요');
    }

    try {
      const result =
        await this.practicalStrategyService.executeAllPracticalStrategies(
          symbol.toUpperCase(),
          timeframe || TimeFrame.ONE_HOUR,
        );

      return {
        success: true,
        message: '실전 전략 실행이 완료되었습니다',
        data: {
          symbol: symbol.toUpperCase(),
          timeframe,
          timestamp: Date.now(),
          result,
        },
      };
    } catch (error: any) {
      console.error(`❌ 실전 전략 실행 API 실패: ${symbol}`, error);
      throw new BadRequestException(`실행에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 리스크 분석
   *
   * 계좌 정보를 바탕으로 리스크를 분석합니다.
   *
   * @param dto 리스크 분석 요청 데이터
   * @returns 리스크 분석 결과
   */
  @Post('risk/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '리스크 분석',
    description: '계좌 정보를 바탕으로 포지션 리스크를 분석합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '리스크 분석 성공',
  })
  async analyzeRisk(
    @Body()
    dto: {
      accountBalance: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      symbol?: string;
      positionSize?: number;
    },
  ) {
    console.log(`⚠️ API 요청: 리스크 분석 - 잔고: ${dto.accountBalance}`);

    if (dto.accountBalance <= 0) {
      throw new BadRequestException('계좌 잔고는 0보다 커야 합니다');
    }

    if (dto.winRate < 0 || dto.winRate > 100) {
      throw new BadRequestException('승률은 0-100 사이의 값이어야 합니다');
    }

    try {
      const positionSizeResult =
        this.riskManagementService.calculatePositionSize(
          dto.accountBalance,
          dto.winRate / 100, // 백분율을 소수로 변환
          dto.avgWin,
          dto.avgLoss,
        );

      const riskAnalysis = {
        positionSizing: positionSizeResult,
        riskAssessment: {
          accountBalance: dto.accountBalance,
          winRate: dto.winRate,
          avgWin: dto.avgWin,
          avgLoss: dto.avgLoss,
          expectedValue:
            (dto.winRate / 100) * dto.avgWin -
            ((100 - dto.winRate) / 100) * dto.avgLoss,
          riskRewardRatio: dto.avgWin / dto.avgLoss,
        },
      };

      return {
        success: true,
        message: '리스크 분석이 완료되었습니다',
        data: {
          timestamp: Date.now(),
          input: dto,
          analysis: riskAnalysis,
        },
      };
    } catch (error: any) {
      console.error('❌ 리스크 분석 API 실패', error);
      throw new BadRequestException(`분석에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 포지션 사이즈 계산
   *
   * 리스크 관리 기준에 따라 적절한 포지션 사이즈를 계산합니다.
   *
   * @param dto 포지션 사이즈 계산 요청 데이터
   * @returns 권장 포지션 사이즈
   */
  @Post('risk/position-size')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '포지션 사이즈 계산',
    description: '리스크 관리 기준에 따라 적절한 포지션 사이즈를 계산합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '포지션 사이즈 계산 성공',
  })
  async calculatePositionSize(
    @Body()
    dto: {
      accountBalance: number;
      riskPercentage: number;
      entryPrice: number;
      stopLossPrice: number;
      symbol?: string;
    },
  ) {
    console.log(`📊 API 요청: 포지션 사이즈 계산 - ${dto.symbol || 'UNKNOWN'}`);

    if (dto.accountBalance <= 0) {
      throw new BadRequestException('계좌 잔고는 0보다 커야 합니다');
    }

    if (dto.riskPercentage <= 0 || dto.riskPercentage > 10) {
      throw new BadRequestException('리스크 비율은 0-10% 사이여야 합니다');
    }

    if (dto.entryPrice <= 0 || dto.stopLossPrice <= 0) {
      throw new BadRequestException('진입가와 손절가는 0보다 커야 합니다');
    }

    try {
      const riskAmount = (dto.accountBalance * dto.riskPercentage) / 100;
      const stopLossDistance = Math.abs(dto.entryPrice - dto.stopLossPrice);
      const positionSize = riskAmount / stopLossDistance;

      return {
        success: true,
        message: '포지션 사이즈 계산이 완료되었습니다',
        data: {
          timestamp: Date.now(),
          input: dto,
          recommendedPositionSize: positionSize,
          riskAmount: (dto.accountBalance * dto.riskPercentage) / 100,
          stopLossDistance: Math.abs(dto.entryPrice - dto.stopLossPrice),
          stopLossPercentage:
            (Math.abs(dto.entryPrice - dto.stopLossPrice) / dto.entryPrice) *
            100,
        },
      };
    } catch (error: any) {
      console.error('❌ 포지션 사이즈 계산 API 실패', error);
      throw new BadRequestException(`계산에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 헬스체크 엔드포인트
   *
   * 기술적 분석 서비스가 정상적으로 작동하는지 확인합니다.
   */
  @Get('health')
  @ApiOperation({
    summary: '서비스 상태 확인',
    description: '기술적 분석 서비스의 상태를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '서비스 정상',
  })
  async healthCheck() {
    return {
      success: true,
      message: '기술적 분석 서비스가 정상적으로 작동 중입니다',
      data: {
        timestamp: Date.now(),
        status: 'healthy',
        version: '2.0.0',
        features: [
          '단일 심볼 분석',
          '다중 심볼 스크리닝',
          '강한 매수 신호 검색',
          '실시간 시장 모니터링',
          '기술적 지표 요약',
          '전략별 심볼 스캔',
          '🆕 완전한 전략 구현 (20+ 전략)',
          '🆕 RSI 다이버전스 분석',
          '🆕 MACD 히스토그램 전환',
          '🆕 볼린저밴드 하단 반등',
        ],
        strategies: [
          'MA_20_BREAKOUT',
          'MA_50_BREAKOUT',
          'MA_200_BREAKOUT',
          'GOLDEN_CROSS_50_200',
          'RSI_OVERSOLD_BOUNCE',
          'RSI_MOMENTUM_70',
          'RSI_DIVERGENCE',
          'MACD_GOLDEN_CROSS',
          'MACD_ZERO_CROSS',
          'MACD_HISTOGRAM_TURN',
          'BOLLINGER_UPPER_BREAK',
          'BOLLINGER_LOWER_BOUNCE',
          'VOLUME_SURGE_UP',
          'TRIPLE_CONFIRMATION',
        ],
      },
    };
  }
}
