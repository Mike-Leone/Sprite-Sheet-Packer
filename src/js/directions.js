export const DEFAULT_DIRECTION = 'ltr-ttb';

const DIRECTIONS = [
  ['ltr-ttb', 'Left → Right, Top → Bottom'],
  ['rtl-ttb', 'Right → Left, Top → Bottom'],
  ['ltr-btt', 'Left → Right, Bottom → Top'],
  ['rtl-btt', 'Right → Left, Bottom → Top'],
  ['ttb-ltr', 'Top → Bottom, Left → Right'],
  ['ttb-rtl', 'Top → Bottom, Right → Left'],
  ['btt-ltr', 'Bottom → Top, Left → Right'],
  ['btt-rtl', 'Bottom → Top, Right → Left']
];

export const directionOptionsHtml = () =>
  DIRECTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
