import { useGame } from '@/contexts/GameContext';

function formatGTTime(totalMinutes: number) {
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = Math.floor(totalMinutes % 60);
  const dayStr = days > 0 ? `第${days + 1}天 ` : '第1天 ';
  return `${dayStr}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export default function StatusBar() {
  const { state } = useGame();
  const { player, gtTime } = state;

  const staminaPercent = (player.stamina / player.maxStamina) * 100;
  const hungerPercent = (player.hunger / player.maxHunger) * 100;

  const staminaColor = staminaPercent > 50 ? 'text-dushi-success' : staminaPercent > 20 ? 'text-yellow-400' : 'text-dushi-danger';
  const hungerColor = hungerPercent < 50 ? 'text-dushi-success' : hungerPercent < 80 ? 'text-yellow-400' : 'text-dushi-danger';

  const loc = state.locations[state.currentLocation];

  return (
    <div className="flex-shrink-0 border-b border-dushi-border px-4 py-2">
      {/* 上排：位置 + 时间 */}
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-dushi-scene">
          ╭─ {loc?.name || '未知'} ─╮
        </span>
        <span className="text-dushi-accent font-semibold">
          ⏱ {formatGTTime(gtTime)}
        </span>
      </div>
      {/* 下排：属性条 */}
      <div className="flex gap-4 text-xs">
        <span className={staminaColor}>
          体能 {Math.floor(player.stamina)}/{player.maxStamina}
        </span>
        <span className={hungerColor}>
          饥饿 {Math.floor(player.hunger)}/{player.maxHunger}
        </span>
        <span className="text-dushi-accent">
          ¥{player.money}
        </span>
      </div>
    </div>
  );
}
