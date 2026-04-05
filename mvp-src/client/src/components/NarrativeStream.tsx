import { useGame } from '@/contexts/GameContext';
import { useEffect, useRef } from 'react';

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.narrative.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-3">
        {state.narrative.map((line) => (
          <div key={line.id} className={`scene-enter ${typeColorMap[line.type] || 'text-foreground'} text-center`}>
            <p className="leading-relaxed text-sm whitespace-pre-wrap">
              <span className="opacity-60">{typePrefixMap[line.type] || ''}</span>
              {line.text}
            </p>
            {line.links && line.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {line.links.map((link, i) => (
                  <button
                    key={i}
                    onClick={() => executeCommand(link.command)}
                    className="text-dushi-accent hover:text-foreground transition-colors text-sm underline underline-offset-4 decoration-dushi-accent/40 hover:decoration-dushi-accent"
                  >
                    [{link.label}]
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

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

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
