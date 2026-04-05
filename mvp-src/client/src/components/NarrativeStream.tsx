import { useGame } from '@/contexts/GameContext';
import { useEffect, useRef, useState } from 'react';

const typeColorMap: Record<string, string> = {
  scene: 'text-dushi-scene',
  system: 'text-dushi-system',
  player: 'text-dushi-player',
  danger: 'text-dushi-danger',
  dialogue: 'text-foreground',
};

const typePrefixMap: Record<string, string> = {
  scene: '',
  system: '› ',
  player: '> ',
  danger: '⚠ ',
  dialogue: '',
};

export default function NarrativeStream() {
  const { state, executeCommand } = useGame();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const narrativeLen = state.narrative.length;
  const lastIndex = narrativeLen - 1;

  // 当新内容出现时，自动滚动到焦点段落（居中）
  useEffect(() => {
    if (!isUserScrolling && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [narrativeLen, isUserScrolling]);

  // 检测用户手动滚动，暂时禁用自动居中
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsUserScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        // 检查是否滚动到接近底部，如果是则恢复自动居中
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < 80) {
          setIsUserScrolling(false);
        }
      }, 1500);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // 新消息到来时重置用户滚动状态
  useEffect(() => {
    setIsUserScrolling(false);
  }, [narrativeLen]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3"
    >
      {/* 上方填充区域，使首条消息也能居中 */}
      <div className="min-h-[40vh]" />

      <div className="w-full max-w-lg mx-auto space-y-3">
        {state.narrative.map((line, index) => {
          const isFocus = index === lastIndex;
          const isRecent = index >= lastIndex - 2;

          return (
            <div
              key={line.id}
              ref={isFocus ? focusRef : undefined}
              className={`scene-enter text-center transition-opacity duration-500 ${
                isFocus
                  ? 'opacity-100'
                  : isRecent
                    ? 'opacity-50'
                    : 'opacity-30'
              } ${typeColorMap[line.type] || 'text-foreground'}`}
            >
              <p className="leading-relaxed text-sm whitespace-pre-wrap">
                <span className="opacity-60">{typePrefixMap[line.type] || ''}</span>
                {line.text}
              </p>
              {line.links && line.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 justify-center">
                  {line.links.map((link, i) => (
                    <button
                      key={i}
                      onClick={() => !line.expired && executeCommand(link.command)}
                      disabled={line.expired}
                      className={`text-sm underline underline-offset-4 transition-colors ${
                        line.expired
                          ? 'text-foreground/30 decoration-foreground/15 cursor-default'
                          : 'text-dushi-accent hover:text-foreground decoration-dushi-accent/40 hover:decoration-dushi-accent cursor-pointer'
                      }`}
                    >
                      [{link.label}]
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 进度条 */}
        {state.activeProgress && (
          <div className="scene-enter text-dushi-system text-sm text-center">
            <p className="mb-1">{state.activeProgress.label}...</p>
            <div className="font-mono text-xs">
              [
              {(() => {
                const pct = Math.floor((state.activeProgress.elapsed / state.activeProgress.duration) * 20);
                return '█'.repeat(pct) + '░'.repeat(20 - pct);
              })()}
              ] {Math.floor((state.activeProgress.elapsed / state.activeProgress.duration) * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* 下方填充区域，使最后一条消息也能居中 */}
      <div className="min-h-[40vh]" />
    </div>
  );
}
