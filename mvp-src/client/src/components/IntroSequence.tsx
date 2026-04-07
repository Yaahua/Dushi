import { useGame } from '@/contexts/GameContext';
import { useState, useEffect } from 'react';

export default function IntroSequence() {
  const { state, sendAction, introLines } = useGame();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const currentLine = introLines[state.introIndex];

  // 打字机效果
  useEffect(() => {
    if (!currentLine) return;
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(currentLine.slice(0, i));
      if (i >= currentLine.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [state.introIndex, currentLine]);

  const handleClick = () => {
    if (isTyping) {
      // 跳过打字机效果，直接显示完整文字
      setDisplayedText(currentLine);
      setIsTyping(false);
      return;
    }
    sendAction({ action: 'advance_intro' });
  };

  return (
    <div
      className="flex flex-col h-full cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* 顶部标识 */}
      <div className="px-6 pt-6 pb-2">
        <div className="text-dushi-border text-xs">
          ╭──────────────────────────────────────╮
        </div>
        <div className="text-dushi-border text-xs">
          │{'  '}边疆及移民管理局{'                      '}│
        </div>
        <div className="text-dushi-border text-xs">
          │{'  '}FRONTIER & IMMIGRATION BUREAU{'         '}│
        </div>
        <div className="text-dushi-border text-xs">
          ╰──────────────────────────────────────╯
        </div>
      </div>

      {/* 讲话内容 */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-lg">
          <p className="text-foreground text-sm leading-loose whitespace-pre-wrap">
            {displayedText}
            {isTyping && <span className="typewriter-cursor text-dushi-accent">▌</span>}
          </p>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="px-6 pb-4 text-center">
        {!isTyping && (
          <p className="text-dushi-scene text-xs animate-pulse">
            {state.introIndex < introLines.length - 1
              ? '[ 点击屏幕继续 ]'
              : '[ 点击屏幕进入登记程序 ]'}
          </p>
        )}
      </div>
    </div>
  );
}
