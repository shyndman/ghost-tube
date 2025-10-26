const DECIMAL_SECONDS_PATTERN = /^-?\d+(?:\.\d+)?$/;
const INTEGER_PATTERN = /^-?\d+$/;

function parseNumeric(value: string, allowFraction: boolean): number | null {
  const pattern = allowFraction ? DECIMAL_SECONDS_PATTERN : INTEGER_PATTERN;
  return pattern.test(value) ? Number(value) : null;
}

/**
 * Converts payload strings such as "125", "05:30", or "01:02:03" into seconds.
 * Returns null when the payload cannot be interpreted as a position.
 */
export function parseSeekPosition(payload: string): number | null {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }

  const numericSeconds = parseNumeric(trimmed, true);
  if (numericSeconds !== null) {
    return numericSeconds;
  }

  if (!trimmed.includes(':')) {
    return null;
  }

  const segments = trimmed.split(':');
  if (segments.length < 2 || segments.length > 3) {
    return null;
  }

  let seconds = 0;
  let multiplier = 1;

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment === undefined) {
      return null;
    }

    const allowFraction = index === segments.length - 1;
    const segmentValue = parseNumeric(segment, allowFraction);
    if (segmentValue === null) {
      return null;
    }

    seconds += segmentValue * multiplier;
    multiplier *= 60;
  }

  return seconds;
}
