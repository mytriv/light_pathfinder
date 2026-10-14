const DATA_URL = 'data/';
export async function loadJson(name) {
  const response = await fetch(`${DATA_URL}${name}.json`);
  if (!response.ok) throw new Error(`Could not load ${name}.json (${response.status})`);
  return response.json();
}

export function tableValue(table, id) {
  return Number(table?.data?.[id] ?? 0);
}

export function mapTileId(map, x, y, z) {
  const i = z * map.width * map.height + y * map.width + x;
  return Number(map.data?.data?.[i] ?? 0);
}
