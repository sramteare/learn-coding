import { PyodideInterface } from "pyodide";

declare global {
  interface Window {
    pyodide?: PyodideInterface;
    runCode: () => Promise<void>;
    clearConsole: () => void;
  }
}