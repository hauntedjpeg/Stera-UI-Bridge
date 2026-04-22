export type SerializedValue =
  | { kind: "color"; r: number; g: number; b: number; a: number }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "alias"; targetId: string };

export type SerializedVariable = {
  id: string;
  name: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, SerializedValue>;
};

export type SerializedCollection = {
  id: string;
  name: string;
  modes: Array<{ id: string; name: string }>;
  variables: SerializedVariable[];
};

export type VariableDoc = {
  collections: SerializedCollection[];
};

export type FontStrategy = "next-font" | "fontsource-variable" | "raw";
export type NextFontConvention = "family-named" | "match-init";

export type UnitChoice = "rem" | "px";

export type StoredPrefs = {
  strategy: FontStrategy;
  nextConvention: NextFontConvention;
  unitByCollectionName: Record<string, UnitChoice>;
  prefix?: string;
  darkModeIdByCollectionId: Record<string, string>;
};

export const DEFAULT_PREFS: StoredPrefs = {
  strategy: "next-font",
  nextConvention: "family-named",
  unitByCollectionName: {},
  darkModeIdByCollectionId: {},
};

export type SandboxToUi =
  | { type: "variables-loaded"; doc: VariableDoc; prefs: StoredPrefs; fileName: string }
  | { type: "prefs-saved" }
  | { type: "error"; message: string };

export type UiToSandbox =
  | { type: "load-variables" }
  | { type: "save-prefs"; prefs: StoredPrefs }
  | { type: "close" };

export function postToSandbox(message: UiToSandbox): void {
  parent.postMessage({ pluginMessage: message }, "*");
}
