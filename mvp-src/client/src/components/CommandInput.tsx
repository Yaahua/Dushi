import { useGame } from '@/contexts/GameContext';
import { useState, useRef, useEffect, useMemo } from 'react';

// 通用固定指令（始终可用）
const GLOBAL_COMMANDS = [
  { label: '环顾四周', command: '环顾' },
  { label: '查看背包', command: '背包' },
  { label: '查看状态', command: '状态' },
  { label: '查看时间', command: '时间' },
  { label: '查看地图', command: '地图' },
  { label: '休息 8 小时', command: '休息' },
  { label: '交房租', command: '交房租' },
  { label: '帮助', command: '帮助' },
];

export default function CommandInput() {
  const { state, executeCommand } = useGame();
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 根据当前位置和输入生成补全建议
  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const loc = state.location;
    const allSuggestions: { label: string; command: string }[] = [];

    // 位置相关动作（从后端推送的 location.actions）
    if (loc?.actions) {
      loc.actions.forEach(a => allSuggestions.push(a));
    }

    // 物品交互
    if (loc?.items) {
      loc.items.forEach(item => {
        if (item.id === 'sofa') {
          allSuggestions.push({ label: '坐在沙发上', command: '坐沙发' });
          allSuggestions.push({ label: '躺在沙发上', command: '躺沙发' });
        }
      });
    }

    // 背包物品快捷指令
    if (state.inventory.find(i => i.id === 'water')) {
      allSuggestions.push({ label: '喝矿泉水', command: '喝矿泉水' });
    }

    // 通用固定指令
    GLOBAL_COMMANDS.forEach(c => allSuggestions.push(c));

    // 过滤匹配（支持拼音首字母模糊）
    const lower = input.toLowerCase();
    return allSuggestions.filter(s =>
      s.label.toLowerCase().includes(lower) || s.command.toLowerCase().includes(lower)
    );
  }, [input, state.location, state.inventory]);

  useEffect(() => {
    setSelectedIndex(0);
    setShowSuggestions(suggestions.length > 0 && input.trim().length > 0);
  }, [suggestions, input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (state.activeProgress) return;
    executeCommand(input);
    setInput('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        setInput(suggestions[selectedIndex].command);
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && showSuggestions && suggestions[selectedIndex]) {
      // Enter 时如果有选中的建议，直接执行
      e.preventDefault();
      executeCommand(suggestions[selectedIndex].command);
      setInput('');
      setShowSuggestions(false);
    }
  };

  const disabled = state.activeProgress !== null;

  return (
    <div className="flex-shrink-0 border-t border-dushi-border relative">
      {/* 补全浮层 */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 bg-dushi-card border border-dushi-border border-b-0 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                i === selectedIndex
                  ? 'bg-dushi-border/50 text-dushi-accent'
                  : 'text-dushi-text hover:bg-dushi-border/30'
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => {
                executeCommand(s.command);
                setInput('');
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
            >
              {s.label}
              <span className="ml-2 text-xs opacity-40">{s.command}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center px-4 py-2">
        <span className="text-dushi-accent mr-2 text-sm font-semibold">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input.trim() && setShowSuggestions(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          disabled={disabled}
          placeholder={disabled ? '请等待...' : '输入指令（帮助 查看全部）...'}
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          autoFocus
        />
      </form>
    </div>
  );
}
