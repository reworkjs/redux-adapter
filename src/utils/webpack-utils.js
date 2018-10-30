// @flow

export function getModulesFromWpContext(...contexts): Array {
  const modules = [];

  for (const context of contexts) {
    for (const key of context.keys()) {
      const provider = getDefault(context(key));

      modules.push(provider);
    }
  }

  return modules;
}

// TODO: merge with rework core
function getDefault(module) {
  return module.default || module;
}
