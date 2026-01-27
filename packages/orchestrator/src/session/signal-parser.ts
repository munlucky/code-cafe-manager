/**
 * Signal Parser - Stage 출력에서 시그널 추출
 *
 * Stage 출력의 YAML signals 블록을 파싱하여 StageSignals 객체로 변환
 */

import * as yaml from 'yaml';
import { createLogger } from '@codecafe/core';
import { StageSignals, DEFAULT_SIGNALS, isValidSignals } from './stage-signals';

const logger = createLogger({ context: 'SignalParser' });

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
   * YAML signals 블록 패턴 - signals가 첫 줄에 있는 경우
   * ```yaml
   * signals:
   *   nextAction: proceed
   *   ...
   * ```
   */
  private static readonly YAML_BLOCK_PATTERN =
    /```ya?ml\s*\n(signals:\s*\n[\s\S]*?)```/i;

  /**
   * 마지막 YAML 블록 패턴 - 출력 끝부분에 있는 signals 찾기
   * Claude가 긴 출력 후 마지막에 signals 블록을 넣는 경우 대응
   */
  private static readonly LAST_YAML_BLOCK_PATTERN =
    /```ya?ml\s*[\s\S]*?(signals:\s*\n(?:[ \t]+\w+:.*\n?)*)```/i;

  /**
   * 인라인 signals 패턴 (코드 블록 없이)
   * signals:
   *   nextAction: proceed
   */
  private static readonly INLINE_PATTERN =
    /^signals:\s*\n((?:\s+\w+:.*\n?)+)/m;

  /**
   * 인라인 signals 패턴 - 들여쓰기 없이
   * signals:
   *   nextAction: proceed
   */
  private static readonly INLINE_NO_INDENT_PATTERN =
    /signals:\s*\n((?:\w+:.*\n?)+)/m;

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
      // 하지만 출력이 충분히 길다면 단순히 설명 중에 질문을 포함한 것일 수 있음
      const questionCount = (output.match(/\?/g) || []).length;
      const outputLength = output.length;
      const isSubstantialOutput = outputLength > 1000;
      
      // 질문이 5개 이상이고 출력이 충분하지 않을 때만 await_user로 추론
      if (questionCount >= 5 && !isSubstantialOutput) {
        logger.debug(`Inferring await_user: ${questionCount} questions in ${outputLength} chars (no signals block)`);
        return {
          success: false,
          signals: {
            ...DEFAULT_SIGNALS,
            nextAction: 'await_user',
            needsUserInput: true,
            uncertainties: ['Explicit signals not found in output (multiple questions detected)'],
          },
          error: 'No signals block found, inferred from question marks',
        };
      }

      logger.debug(`No signals block found, output: ${outputLength} chars, questions: ${questionCount}`);
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
   * 여러 패턴을 순차적으로 시도하여 YAML 코드 블록에서 signals 추출
   */
  private extractYamlBlock(output: string): string | null {
    // 1. signals가 첫 줄에 있는 기본 패턴
    let match = output.match(SignalParser.YAML_BLOCK_PATTERN);
    if (match?.[1]) {
      return match[1].trim();
    }

    // 2. 마지막 YAML 블록에서 signals 찾기 (출력 끝에 있는 경우가 많음)
    const lastYamlMatch = output.match(SignalParser.LAST_YAML_BLOCK_PATTERN);
    if (lastYamlMatch?.[1]) {
      const signalsContent = lastYamlMatch[1].trim();
      // 전체 YAML 블록을 추출
      const fullYamlMatch = output.match(/```ya?ml\s*[\s\S]*?```/gi);
      if (fullYamlMatch) {
        const lastBlock = fullYamlMatch[fullYamlMatch.length - 1];
        return signalsContent;
      }
    }

    // 3. 들여쓰기 없는 인라인 패턴
    const noIndentMatch = output.match(SignalParser.INLINE_NO_INDENT_PATTERN);
    if (noIndentMatch?.[1]) {
      return `signals:\n${noIndentMatch[1]}`;
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
      SignalParser.LAST_YAML_BLOCK_PATTERN.test(output) ||
      SignalParser.INLINE_PATTERN.test(output) ||
      SignalParser.INLINE_NO_INDENT_PATTERN.test(output)
    );
  }
}

/**
 * 싱글톤 인스턴스
 */
export const signalParser = new SignalParser();
