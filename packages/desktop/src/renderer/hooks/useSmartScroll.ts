/**
 * useSmartScroll Hook
 * 스마트 자동 스크롤 기능을 제공하는 훅
 *
 * - 새 콘텐츠 도착 시 사용자가 하단에 있으면 자동 스크롤
 * - 사용자가 위로 스크롤하면 자동 스크롤 중지
 * - 하단으로 스크롤하면 자동 스크롤 재개
 */

import { useRef, useState, useCallback, useEffect, type RefObject } from 'react';

export interface UseSmartScrollOptions {
  /** 하단으로 간주하는 거리 임계값 (기본값: 100px) */
  threshold?: number;
}

export interface UseSmartScrollReturn {
  /** 스크롤 컨테이너에 연결할 ref */
  containerRef: RefObject<HTMLDivElement>;
  /** 목록 끝에 배치할 요소의 ref */
  endRef: RefObject<HTMLDivElement>;
  /** 현재 하단에 있는지 여부 */
  isAtBottom: boolean;
  /** 하단으로 스크롤하는 함수 */
  scrollToBottom: () => void;
}

/**
 * 스마트 자동 스크롤 훅
 *
 * @example
 * ```tsx
 * const { containerRef, endRef, isAtBottom, scrollToBottom } = useSmartScroll();
 *
 * return (
 *   <div ref={containerRef} className="overflow-y-auto">
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={endRef} />
 *   </div>
 * );
 * ```
 */
export function useSmartScroll(options?: UseSmartScrollOptions): UseSmartScrollReturn {
  const { threshold = 100 } = options ?? {};

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /**
   * 하단으로 스크롤
   */
  const scrollToBottom = useCallback(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
      userScrolledRef.current = false;
      setIsAtBottom(true);
    }
  }, []);

  /**
   * 스크롤 위치가 하단인지 확인
   */
  const checkIsAtBottom = useCallback((container: HTMLElement): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [threshold]);

  /**
   * 스크롤 이벤트 핸들러
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const atBottom = checkIsAtBottom(container);
    setIsAtBottom(atBottom);

    // 사용자가 위로 스크롤했는지 추적
    if (!atBottom) {
      userScrolledRef.current = true;
    } else {
      // 하단에 도달하면 자동 스크롤 재개
      userScrolledRef.current = false;
    }
  }, [checkIsAtBottom]);

  /**
   * 스크롤 이벤트 리스너 등록
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  /**
   * 컨텐츠 변경 시 자동 스크롤 (사용자가 하단에 있을 때만)
   * MutationObserver를 사용하여 컨텐츠 변경 감지
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      // 사용자가 수동으로 스크롤하지 않았고 하단에 있었다면 자동 스크롤
      if (!userScrolledRef.current && endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
  };
}
