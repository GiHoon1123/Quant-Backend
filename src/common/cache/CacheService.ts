import { Injectable, Logger } from '@nestjs/common';
import { CacheEntry } from './CacheTypes';

/**
 * 범용 캐시 서비스
 * 메모리 기반 캐시를 관리하며, TTL과 패턴 검색 기능을 제공합니다.
 * ATR, 설정값, 포지션 정보 등 모든 데이터를 캐싱할 수 있습니다.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor() {
    // 캐시 정리 작업 시작
    this.startCleanupTask();
  }

  /**
   * 캐시에 값을 저장합니다.
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttl 캐시 유효 시간 (밀리초, 기본값: 1시간)
   */
  set(key: string, value: any, ttl: number = 3600000): void {
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl,
    };
    this.cache.set(key, entry);
  }

  /**
   * 캐시에서 값을 조회합니다.
   * @param key 캐시 키
   * @returns 캐시된 값 또는 null
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 체크
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * 캐시에서 키를 삭제합니다.
   * @param key 삭제할 캐시 키
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 캐시에 키가 존재하는지 확인합니다.
   * @param key 확인할 캐시 키
   * @returns 존재 여부
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // TTL 체크
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 패턴에 맞는 모든 캐시 키를 조회합니다.
   * @param pattern 검색할 패턴
   * @returns 패턴에 맞는 키-값 쌍
   */
  getByPattern(pattern: string): Map<string, any> {
    const result = new Map<string, any>();

    for (const [key, entry] of this.cache) {
      if (key.includes(pattern)) {
        // TTL 체크
        if (Date.now() - entry.timestamp <= entry.ttl) {
          result.set(key, entry.value);
        } else {
          this.cache.delete(key);
        }
      }
    }

    return result;
  }

  /**
   * 모든 캐시를 삭제합니다.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 크기를 반환합니다.
   * @returns 캐시에 저장된 항목 수
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 정리 작업을 시작합니다.
   * 주기적으로 만료된 캐시 항목을 삭제합니다.
   */
  private startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`캐시 정리 완료: ${cleanedCount}개 항목 삭제`);
      }
    }, 600000); // 10분마다 정리
  }
}
