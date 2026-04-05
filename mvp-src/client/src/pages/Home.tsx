/*
 * 都市余烬 MVP - 主界面
 * 设计风格：都市夜色终端 (Urban Night Terminal)
 * - 背景 #1A1B26 / 正文 #C0CAF5 / 强调 #7AA2F7
 * - 等宽字体 Source Code Pro + Noto Sans SC
 * - ASCII 边框 ╭╮╰╯─│
 * - 信息类型颜色：场景灰 / 系统蓝 / 玩家绿 / 危险红
 */

import { GameProvider, useGame } from '@/contexts/GameContext';
import IntroSequence from '@/components/IntroSequence';
import CharacterCreation from '@/components/CharacterCreation';
import TransitSequence from '@/components/TransitSequence';
import StatusBar from '@/components/StatusBar';
import NarrativeStream from '@/components/NarrativeStream';
import CommandInput from '@/components/CommandInput';

function GameScreen() {
  const { state } = useGame();

  if (state.phase === 'intro') {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-2xl h-full max-h-[800px] border border-dushi-border flex flex-col">
          <IntroSequence />
        </div>
      </div>
    );
  }

  if (state.phase === 'character_creation') {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-2xl h-full max-h-[800px] border border-dushi-border flex flex-col">
          <CharacterCreation />
        </div>
      </div>
    );
  }

  if (state.phase === 'transit') {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-2xl h-full max-h-[800px] border border-dushi-border flex flex-col">
          <TransitSequence />
        </div>
      </div>
    );
  }

  // gameplay
  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-2xl h-full max-h-[800px] border border-dushi-border flex flex-col">
        <StatusBar />
        <NarrativeStream />
        <CommandInput />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <GameProvider>
      <GameScreen />
    </GameProvider>
  );
}
