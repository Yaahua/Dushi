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

  const healthPercent = (player.health / player.max_health) * 100;
  const staminaPercent = (player.stamina / player.max_stamina) * 100;
  const hungerPercent = (player.hunger / player.max_hunger) * 100;

  const healthColor = healthPercent > 50 ? 'text-dushi-success' : healthPercent > 20 ? 'text-yellow-400' : 'text-dushi-danger';
  const staminaColor = staminaPercent > 50 ? 'text-dushi-success' : staminaPercent > 20 ? 'text-yellow-400' : 'text-dushi-danger';
  const hungerColor = hungerPercent < 50 ? 'text-dushi-success' : hungerPercent < 80 ? 'text-yellow-400' : 'text-dushi-danger';

  const locName = state.location?.name || '未知';

  return (
    <div className="flex-shrink-0 border-b border-dushi-border px-4 py-2">
      {/* 上排：位置 + 时间 */}
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-dushi-scene">
          ╭─ {locName} ─╮
        </span>
        <span className="text-dushi-accent font-semibold">
          ⏱ {formatGTTime(gtTime)}
        </span>
      </div>
      {/* 下排：属性条 */}
      <div className="flex gap-4 text-xs">
        <span className={healthColor}>
          生命 {Math.floor(player.health)}/{player.max_health}
        </span>
        <span className={staminaColor}>
          体能 {Math.floor(player.stamina)}/{player.max_stamina}
        </span>
        <span className={hungerColor}>
          饥饿 {Math.floor(player.hunger)}/{player.max_hunger}
        </span>
        <span className="text-dushi-accent">
          ¥{Math.floor(player.money)}
        </span>
      </div>
    </div>
  );
}
