export async function shareResult(text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Khayil 2026', text });
      return 'shared';
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'AbortError') return 'cancelled';
      // fallback copy
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // fallback textarea
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

export function formatShareText(opts: {
  won: boolean;
  equipment: number;
  love: boolean;
  distance: number;
}): string {
  const love = opts.love ? ' + Amour ❤' : '';
  if (opts.won) {
    return `🔥 Je suis équipée pour conquérir !\nKhayil 2026 — 7/7 équipements${love}\nDistance : ${Math.floor(opts.distance)} m\n#Khayil2026 #EquipéePourConquérir`;
  }
  return `💪 Khayil 2026 — ${opts.equipment}/7 équipements${love}\nDistance : ${Math.floor(opts.distance)} m\nJe recommence pour conquérir !\n#Khayil2026`;
}
