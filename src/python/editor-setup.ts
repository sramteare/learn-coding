import { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, indentWithTab, toggleComment } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { bracketMatching } from "@codemirror/language";
import { oneDark } from '@codemirror/theme-one-dark'; 
import { loadPyodide, PyodideInterface } from "pyodide";

type ConsoleMessageType = 'output' | 'error' | 'prompt';

// --- CodeMirror Setup ---
const initialCode: string = `import sys
from datetime import date

print(f"Hello from {sys.version}")
print()
print()
a = 10
b = 5
print(f"{a} + {b} = {a + b}")
print('.')

# This will cause an error
# print(unknown_variable)

today = date.today()
print(today)

print()`;

const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    bracketMatching(),
    keymap.of([
        ...defaultKeymap, 
        indentWithTab,    
        { key: "Ctrl-3", run: toggleComment } // Keep working comment toggle
    ]),
    python(), 
    oneDark, 
    EditorView.theme({
        "&": { height: "100%" }, 
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { padding: "1.5rem" },
        ".cm-gutters": { paddingLeft: "1rem", paddingRight: "1rem" }
    })
];

const startState: EditorState = EditorState.create({
  doc: initialCode,
  extensions: extensions
});

// Create the CodeMirror view instance
const editorElement = document.getElementById('editor');
if (!editorElement) {
  throw new Error("Editor element not found");
}

const editorView: EditorView = new EditorView({
  state: startState,
  parent: editorElement
});

// --- Pyodide Setup ---
let pyodide: PyodideInterface | null = null;
const consoleEl: HTMLElement | null = document.getElementById('console');
const runButton: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>('#code-column button');

if (!consoleEl) {
  throw new Error("Console element not found");
}

// Function to add messages to the custom console
function addToConsole(message: string, type: ConsoleMessageType = 'output'): void {
    if (!consoleEl) return;
    const div = document.createElement('div');
    div.textContent = message;
    div.className = type; // 'output', 'error', or 'prompt'
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight; // Scroll to bottom
}

// Initialize Pyodide
async function initializePyodide(): Promise<void> {
    addToConsole("Wait.. initializing...", "prompt");
    if (runButton) runButton.disabled = true;

    try {
        pyodide = await loadPyodide({ indexURL: './pyodide/' });
        window.pyodide = pyodide;

        pyodide.setStdout({
            batched: (msg: string) => addToConsole(msg, 'output')
        });
        pyodide.setStderr({
            batched: (msg: string) => addToConsole(msg, 'error')
        });

        addToConsole("Ready.", "prompt");
        if (runButton) runButton.disabled = false;

    } catch (error) {
        console.error("Pyodide initialization failed:", error);
        addToConsole(`Pyodide initialization failed: ${(error as Error)?.message || String(error)}`, "error");
        if (runButton) runButton.disabled = false; // Re-enable button on failure too
    }
}

// --- Execution Logic ---
async function runCode(): Promise<void> {
    if (!pyodide) {
        addToConsole("Pyodide not ready yet.", "error");
        return;
    }
    if (runButton?.disabled) { // Optional chaining in case runButton is null
        return;
    }

    const code: string = editorView.state.doc.toString();
    addToConsole(`>>> Running code...`, "prompt");

    try {
        if (runButton) runButton.disabled = true;
        await pyodide.runPythonAsync(code);
    } catch (error) {
        console.error("Python execution error:", error);
        // Pyodide's stderr redirect should handle displaying the error
        addToConsole(`Execution failed: ${(error as Error)?.message}`, "error");
    } finally {
        if (runButton) runButton.disabled = false;
        if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
    }
}

// --- Console Clearing ---
function clearConsole(): void {
    if (consoleEl) consoleEl.innerHTML = '';
}

// --- Expose functions to window ---
window.runCode = runCode;
window.clearConsole = clearConsole;

// --- Start Initialization ---
initializePyodide(); // Start loading Pyodide when the script runs
