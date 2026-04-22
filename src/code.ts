import type {
  SerializedCollection,
  SerializedValue,
  SerializedVariable,
  StoredPrefs,
  SandboxToUi,
  UiToSandbox,
} from "./shared/messages.js";
import { DEFAULT_PREFS } from "./shared/messages.js";

const PREFS_KEY_PREFIX = "stera-ui-bridge:prefs:";

function serializeValue(raw: VariableValue): SerializedValue {
  if (typeof raw === "number") return { kind: "number", value: raw };
  if (typeof raw === "string") return { kind: "string", value: raw };
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  if (
    raw &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as VariableAlias).type === "VARIABLE_ALIAS"
  ) {
    return { kind: "alias", targetId: (raw as VariableAlias).id };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "r" in raw &&
    "g" in raw &&
    "b" in raw
  ) {
    const c = raw as RGB | RGBA;
    return {
      kind: "color",
      r: c.r,
      g: c.g,
      b: c.b,
      a: "a" in c ? c.a : 1,
    };
  }
  return { kind: "string", value: String(raw) };
}

async function extractDoc(): Promise<SerializedCollection[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const out: SerializedCollection[] = [];

  for (const col of collections) {
    const variables: SerializedVariable[] = [];
    for (const varId of col.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(varId);
      if (!v) continue;
      if (
        v.resolvedType !== "COLOR" &&
        v.resolvedType !== "FLOAT" &&
        v.resolvedType !== "STRING" &&
        v.resolvedType !== "BOOLEAN"
      ) {
        continue;
      }
      const valuesByMode: Record<string, SerializedValue> = {};
      for (const modeId of Object.keys(v.valuesByMode)) {
        valuesByMode[modeId] = serializeValue(v.valuesByMode[modeId]);
      }
      variables.push({
        id: v.id,
        name: v.name,
        type: v.resolvedType,
        valuesByMode,
      });
    }

    out.push({
      id: col.id,
      name: col.name,
      modes: col.modes.map((m) => ({ id: m.modeId, name: m.name })),
      variables,
    });
  }

  return out;
}

function prefsKey(): string {
  const fileKey = figma.fileKey ?? "unknown-file";
  return `${PREFS_KEY_PREFIX}${fileKey}`;
}

async function loadPrefs(): Promise<StoredPrefs> {
  const raw = await figma.clientStorage.getAsync(prefsKey());
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    return { ...DEFAULT_PREFS, ...(raw as Partial<StoredPrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function savePrefs(prefs: StoredPrefs): Promise<void> {
  await figma.clientStorage.setAsync(prefsKey(), prefs);
}

function post(message: SandboxToUi): void {
  figma.ui.postMessage(message);
}

figma.showUI(__html__, { width: 440, height: 620, themeColors: true });

figma.ui.onmessage = async (msg: UiToSandbox) => {
  try {
    if (msg.type === "load-variables") {
      const [collections, prefs] = await Promise.all([extractDoc(), loadPrefs()]);
      post({
        type: "variables-loaded",
        doc: { collections },
        prefs,
        fileName: figma.root.name,
      });
      return;
    }
    if (msg.type === "save-prefs") {
      await savePrefs(msg.prefs);
      post({ type: "prefs-saved" });
      return;
    }
    if (msg.type === "close") {
      figma.closePlugin();
      return;
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
