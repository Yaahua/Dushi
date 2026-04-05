import { useGame } from '@/contexts/GameContext';
import { useState, useMemo } from 'react';

const SKILL_NAMES: Record<string, string> = {
  strength: '力量',
  intelligence: '智力',
  social: '社交',
  management: '管理',
};

const SKILL_DESC: Record<string, string> = {
  strength: '影响体力劳动效率',
  intelligence: '影响学习与工作能力',
  social: '影响NPC好感与接受度',
  management: '影响经营与后期玩法',
};

const TOTAL_POINTS = 20;
const MIN_PER_SKILL = 1;
const MAX_PER_SKILL = 10;

export default function CharacterCreation() {
  const { state, dispatch } = useGame();
  const [gender, setGender] = useState<'男' | '女'>(state.player.gender);
  const [skills, setSkills] = useState({
    strength: 1,
    intelligence: 1,
    social: 1,
    management: 1,
  });
  const [step, setStep] = useState<'gender' | 'skills' | 'confirm'>('gender');

  const usedPoints = useMemo(() =>
    Object.values(skills).reduce((a, b) => a + b, 0),
    [skills]
  );
  const remainingPoints = TOTAL_POINTS - usedPoints;

  const adjustSkill = (key: string, delta: number) => {
    setSkills(prev => {
      const current = prev[key as keyof typeof prev];
      const newVal = current + delta;
      if (newVal < MIN_PER_SKILL || newVal > MAX_PER_SKILL) return prev;
      const newUsed = usedPoints + delta;
      if (newUsed > TOTAL_POINTS) return prev;
      return { ...prev, [key]: newVal };
    });
  };

  const handleConfirm = () => {
    dispatch({ type: 'SET_GENDER', gender });
    dispatch({ type: 'SET_SKILLS', skills });
    dispatch({ type: 'FINISH_CHARACTER_CREATION', name: '新移民' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="px-6 pt-6 pb-2">
        <div className="text-dushi-border text-xs">
          ╭──────────────────────────────────────╮
        </div>
        <div className="text-dushi-border text-xs">
          │{'  '}生物特征采集舱{'                        '}│
        </div>
        <div className="text-dushi-border text-xs">
          │{'  '}BIOMETRIC COLLECTION UNIT{'             '}│
        </div>
        <div className="text-dushi-border text-xs">
          ╰──────────────────────────────────────╯
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 性别选择 */}
        {step === 'gender' && (
          <div className="scene-enter space-y-6">
            <p className="text-dushi-system text-sm">› 请选择生物性别标识：</p>
            <div className="flex gap-4">
              {(['男', '女'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`px-6 py-3 border text-sm transition-all ${
                    gender === g
                      ? 'border-dushi-accent text-dushi-accent bg-dushi-accent/10'
                      : 'border-dushi-border text-dushi-scene hover:border-dushi-accent/50'
                  }`}
                >
                  {g === '男' ? '[ 男性 MALE ]' : '[ 女性 FEMALE ]'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep('skills')}
              className="mt-4 text-dushi-accent text-sm hover:text-foreground transition-colors"
            >
              {'>'} 确认并继续 →
            </button>
          </div>
        )}

        {/* 技能点分配 */}
        {step === 'skills' && (
          <div className="scene-enter space-y-4">
            <p className="text-dushi-system text-sm">› 行为倾向数据录入（剩余点数：<span className={remainingPoints > 0 ? 'text-dushi-accent' : 'text-dushi-success'}>{remainingPoints}</span>/{TOTAL_POINTS}）</p>
            <p className="text-dushi-scene text-xs">每项底线 {MIN_PER_SKILL} 点，上限 {MAX_PER_SKILL} 点</p>

            <div className="space-y-3 mt-4">
              {Object.entries(skills).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-foreground text-sm w-16">{SKILL_NAMES[key]}</span>
                  <button
                    onClick={() => adjustSkill(key, -1)}
                    className="text-dushi-accent hover:text-foreground text-sm w-6 h-6 flex items-center justify-center border border-dushi-border hover:border-dushi-accent transition-colors"
                    disabled={val <= MIN_PER_SKILL}
                  >
                    -
                  </button>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-3 bg-dushi-border/30 relative">
                      <div
                        className="h-full bg-dushi-accent/70 transition-all duration-200"
                        style={{ width: `${(val / MAX_PER_SKILL) * 100}%` }}
                      />
                    </div>
                    <span className="text-dushi-accent text-sm w-8 text-right font-semibold">{val}</span>
                  </div>
                  <button
                    onClick={() => adjustSkill(key, 1)}
                    className="text-dushi-accent hover:text-foreground text-sm w-6 h-6 flex items-center justify-center border border-dushi-border hover:border-dushi-accent transition-colors"
                    disabled={val >= MAX_PER_SKILL || remainingPoints <= 0}
                  >
                    +
                  </button>
                  <span className="text-dushi-scene text-xs w-28">{SKILL_DESC[key]}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setStep('gender')}
                className="text-dushi-scene text-sm hover:text-foreground transition-colors"
              >
                ← 返回
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={remainingPoints !== 0}
                className={`text-sm transition-colors ${
                  remainingPoints === 0
                    ? 'text-dushi-accent hover:text-foreground'
                    : 'text-dushi-border cursor-not-allowed'
                }`}
              >
                {'>'} 确认并继续 →
              </button>
            </div>
            {remainingPoints !== 0 && (
              <p className="text-dushi-danger text-xs">请分配完所有点数（剩余 {remainingPoints} 点）</p>
            )}
          </div>
        )}

        {/* 确认 */}
        {step === 'confirm' && (
          <div className="scene-enter space-y-4">
            <p className="text-dushi-system text-sm">› 数据录入完成。请确认以下信息：</p>
            <div className="inline-card p-4 space-y-2 text-sm">
              <p className="text-foreground">性别：{gender}</p>
              {Object.entries(skills).map(([key, val]) => (
                <p key={key} className="text-foreground">
                  {SKILL_NAMES[key]}：{'█'.repeat(val)}{'░'.repeat(MAX_PER_SKILL - val)} {val}/{MAX_PER_SKILL}
                </p>
              ))}
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setStep('skills')}
                className="text-dushi-scene text-sm hover:text-foreground transition-colors"
              >
                ← 修改
              </button>
              <button
                onClick={handleConfirm}
                className="text-dushi-accent text-sm hover:text-foreground transition-colors font-semibold"
              >
                {'>'} 确认登记，前往站台 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
