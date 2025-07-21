// 기술적 분석 결과 응답 DTO (Response Suffix만 사용)
export class TechnicalAnalysisResultResponse {
  // 캔들 기반 분석 결과용
  openTime?: number;
  closeTime?: number;
  open?: number;
  close?: number;
  high?: number;
  low?: number;
  volume?: number;

  // MultiStrategyResult 기반 분석 결과용
  symbol?: string;
  timestamp?: number;
  overallSignal?: string;
  overallConfidence?: number;
  consensus?: number;
  strategies?: any[];
  timeframeSummary?: any;
}
