/**
 * Signal Parser - Stage 출력에서 시그널 추출
 *
 * Stage 출력의 YAML signals 블록을 파싱하여 StageSignals 객체로 변환
 */

import * as yaml from 'yaml';
import { StageSignals, DEFAULT_SIGNALS, isValidSignals } from './stage-signals';

/**
 * 시그널 파싱 결과
 */
export interface ParseResult {
  /** 파싱 성공 여부 */
  success: boolean;

  /** 파싱된 시그널 (실패 시 기본값) */
  signals: StageSignals;

  /** 파싱 실패 시 에러 메시지 */
  error?: string;

  /** 원본 시그널 블록 (디버깅용) */
  rawBlock?: string;
}

/**
 * Stage 출력에서 시그널 블록을 추출하고 파싱
 */
export class SignalParser {
  /**
   * YAML signals 블록 패턴
   * ```yaml
   * signals:
   *   nextAction: proceed
   *   ...
   * ```
   */
  private static readonly YAML_BLOCK_PATTERN =
    /```ya?ml\s*\n(signals:\s*\n[\s\S]*?)```/i;

  /**
   * 인라인 signals 패턴 (코드 블록 없이)
   * signals:
   *   nextAction: proceed
   */
  private static readonly INLINE_PATTERN =
    /^signals:\s*\n((?:\s+\w+:.*\n?)+)/m;

  /**
   * Stage 출력에서 시그널 파싱
   */
  parse(output: string): ParseResult {
    if (!output || typeof output !== 'string') {
      return {
        success: false,
        signals: { ...DEFAULT_SIGNALS },
        error: 'Empty or invalid output',
      };
    }

    // 1. YAML 코드 블록에서 signals 찾기
    let rawBlock = this.extractYamlBlock(output);

    // 2. 인라인 signals 패턴 시도
    if (!rawBlock) {
      rawBlock = this.extractInlineSignals(output);
    }

    // 3. signals 블록을 찾지 못함
    if (!rawBlock) {
      // 휴리스틱: 출력에 질문이 많으면 불확실성 있음으로 판단
      const questionCount = (output.match(/\?/g) || []).length;
      if (questionCount >= 3) {
        return {
          success: false,
          signals: {
            ...DEFAULT_SIGNALS,
            nextAction: 'await_user',
            needsUserInput: true,
            uncertainties: ['출력에서 명시적 시그널을 찾지 못함 (질문 다수 감지)'],
          },
          error: 'No signals block found, inferred from question marks',
        };
      }

      return {
        success: false,
        signals: { ...DEFAULT_SIGNALS },
        error: 'No signals block found in output',
      };
    }

    // 4. YAML 파싱
    try {
      const parsed = yaml.parse(rawBlock);
      const signalsData = parsed?.signals || parsed;

      if (!signalsData) {
        return {
          success: false,
          signals: { ...DEFAULT_SIGNALS },
          error: 'Signals block is empty',
          rawBlock,
        };
      }

      // 5. 시그널 객체 구성
      const signals: StageSignals = {
        nextAction: signalsData.nextAction || 'proceed',
        needsUserInput: signalsData.needsUserInput === true,
        uncertainties: Array.isArray(signalsData.uncertainties)
          ? signalsData.uncertainties
          : [],
        complexity: signalsData.complexity || 'medium',
        skipStages: Array.isArray(signalsData.skipStages)
          ? signalsData.skipStages
          : undefined,
        retryReason: signalsData.retryReason,
        maxRetries: typeof signalsData.maxRetries === 'number'
          ? signalsData.maxRetries
          : undefined,
        metadata: signalsData.metadata,
      };

      // 6. 검증
      if (!isValidSignals(signals)) {
        return {
          success: false,
          signals: Object.assign({}, DEFAULT_SIGNALS, signals),
          error: 'Invalid signals structure',
          rawBlock,
        };
      }

      return {
        success: true,
        signals,
        rawBlock,
      };
    } catch (err) {
      return {
        success: false,
        signals: { ...DEFAULT_SIGNALS },
        error: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
        rawBlock,
      };
    }
  }

  /**
   * YAML 코드 블록에서 signals 추출
   */
  private extractYamlBlock(output: string): string | null {
    const match = output.match(SignalParser.YAML_BLOCK_PATTERN);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * 인라인 signals 패턴 추출
   */
  private extractInlineSignals(output: string): string | null {
    const match = output.match(SignalParser.INLINE_PATTERN);
    if (match) {
      return `signals:\n${match[1]}`;
    }
    return null;
  }

  /**
   * 시그널 블록 존재 여부 확인 (파싱 없이)
   */
  hasSignals(output: string): boolean {
    if (!output) return false;
    return (
      SignalParser.YAML_BLOCK_PATTERN.test(output) ||
      SignalParser.INLINE_PATTERN.test(output)
    );
  }
}

/**
 * 싱글톤 인스턴스
 */
export const signalParser = new SignalParser();
