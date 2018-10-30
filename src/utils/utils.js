// @flow

export function toArray(obj: any): Array<any> {
  if (obj == null) {
    return [];
  }

  if (Array.isArray(obj)) {
    return obj;
  }

  return [obj];
}

export function mapToObject(map: Map<string | Symbol, *>): { [string | Symbol]: * } {

  const obj = Object.create(null);
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }

  return obj;
}
