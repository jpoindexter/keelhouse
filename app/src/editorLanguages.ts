import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const extension = (path: string) => basename(path).split(".").pop()?.toLowerCase() ?? "";
const shellFilenames = new Set([".bashrc", ".zshrc", ".profile", ".bash_profile", ".zprofile"]);
const editorSearchExtensions: Extension[] = [search(), highlightSelectionMatches(), keymap.of(searchKeymap)];

export const editorExtensionsFor = (path: string) => {
  const fileName = basename(path).toLowerCase();
  const ext = extension(path);
  let languageExtensions: Extension[] = [];
  switch (ext) {
    case "html":
    case "htm":
      languageExtensions = [html()];
      break;
    case "css":
      languageExtensions = [css()];
      break;
    case "js":
    case "jsx":
      languageExtensions = [javascript({ jsx: true })];
      break;
    case "json":
      languageExtensions = [json()];
      break;
    case "rs":
      languageExtensions = [rust()];
      break;
    case "toml":
      languageExtensions = [StreamLanguage.define(toml)];
      break;
    case "ts":
    case "tsx":
      languageExtensions = [javascript({ jsx: ext === "tsx", typescript: true })];
      break;
    case "yaml":
    case "yml":
      languageExtensions = [yaml()];
      break;
    case "bash":
    case "fish":
    case "ksh":
    case "sh":
    case "zsh":
      languageExtensions = [StreamLanguage.define(shell)];
      break;
    case "md":
    case "markdown":
      languageExtensions = [markdown()];
      break;
    default:
      languageExtensions = shellFilenames.has(fileName) ? [StreamLanguage.define(shell)] : [];
  }
  return [...languageExtensions, ...editorSearchExtensions];
};

export const hasLanguageModeForPath = (path: string) => editorExtensionsFor(path).length > editorSearchExtensions.length;
