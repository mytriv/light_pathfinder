export const XP_AUTOTILE_QUADRANTS = [
  [27,28,33,34],[5,28,33,34],[27,6,33,34],[5,6,33,34],
  [27,28,33,12],[5,28,33,12],[27,6,33,12],[5,6,33,12],
  [27,28,11,34],[5,28,11,34],[27,6,11,34],[5,6,11,34],
  [27,28,11,12],[5,28,11,12],[27,6,11,12],[5,6,11,12],
  [25,26,31,32],[25,6,31,32],[25,26,31,12],[25,6,31,12],
  [15,16,21,22],[15,16,21,12],[15,16,11,22],[15,16,11,12],
  [29,30,35,36],[29,30,11,36],[5,30,35,36],[5,30,11,36],
  [39,40,45,46],[5,40,45,46],[39,6,45,46],[5,6,45,46],
  [25,30,31,36],[15,16,45,46],[13,14,19,20],[13,14,19,12],
  [17,18,23,24],[17,18,11,24],[41,42,47,48],[5,42,47,48],
  [37,38,43,44],[37,6,43,44],[13,18,19,24],[13,14,43,44],
  [37,42,43,48],[17,18,47,48],[13,18,43,48],[13,18,43,48]
];

export function composeXpAutotile(source, shape, frame = 0, size = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const pattern = XP_AUTOTILE_QUADRANTS[shape];
  if (!pattern) return canvas;
  const sourceX = frame * 96;
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const tile = pattern[quadrant] - 1;
    const sx = sourceX + (tile % 6) * 16;
    const sy = Math.floor(tile / 6) * 16;
    const dx = (quadrant % 2) * (size / 2);
    const dy = Math.floor(quadrant / 2) * (size / 2);
    context.drawImage(source, sx, sy, 16, 16, dx, dy, size / 2, size / 2);
  }
  return canvas;
}
