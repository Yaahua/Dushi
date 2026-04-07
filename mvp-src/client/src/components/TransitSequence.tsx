import { useGame } from '@/contexts/GameContext';
import { useState, useEffect } from 'react';

const TRANSIT_LINES = [
  '你跟随指示标识来到轨道交通站台。',
  '一列银灰色的地铁列车已经停靠在站台边。',
  '车门打开，你走进车厢。',
  '车厢内灯光昏暗，几排塑料座椅上坐着和你一样的新移民。',
  '没有人说话。',
  '列车启动，窗外的隧道壁飞速后退。',
  '...',
  '列车减速。广播响起：',
  '"世界公寓站到了。请携带好个人物品下车。"',
];

export default function TransitSequence() {
  const { sendAction } = useGame();
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [allLines, setAllLines] = useState<string[]>([]);

  const currentLine = TRANSIT_LINES[lineIndex];

  useEffect(() => {
    if (!currentLine) return;
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    const speed = currentLine === '...' ? 200 : 35;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(currentLine.slice(0, i));
      if (i >= currentLine.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [lineIndex, currentLine]);

  const handleClick = () => {
    if (isTyping) {
      setDisplayedText(currentLine);
      setIsTyping(false);
      return;
    }
    if (lineIndex < TRANSIT_LINES.length - 1) {
      setAllLines(prev => [...prev, currentLine]);
      setLineIndex(lineIndex + 1);
    } else {
      sendAction({ action: 'finish_transit' });
    }
  };

  return (
    <div
      className="flex flex-col h-full cursor-pointer select-none"
      onClick={handleClick}
    >
      <div className="flex-1 flex flex-col justify-end px-6 pb-8 space-y-2">
        {/* 已显示的行 */}
        {allLines.map((line, i) => (
          <p key={i} className="text-dushi-scene text-sm leading-relaxed opacity-50">
            {line}
          </p>
        ))}
        {/* 当前行 */}
        <p className="text-foreground text-sm leading-relaxed">
          {displayedText}
          {isTyping && <span className="typewriter-cursor text-dushi-accent">▌</span>}
        </p>
      </div>

      <div className="px-6 pb-4 text-center">
        {!isTyping && (
          <p className="text-dushi-scene text-xs animate-pulse">
            {lineIndex < TRANSIT_LINES.length - 1
              ? '[ 点击继续 ]'
              : '[ 点击下车 ]'}
          </p>
        )}
      </div>
    </div>
  );
}
