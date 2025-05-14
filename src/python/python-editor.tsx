import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, indentWithTab, toggleComment } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { bracketMatching } from "@codemirror/language";
import { oneDark } from '@codemirror/theme-one-dark';
import { loadPyodide, PyodideInterface } from "pyodide";

type ConsoleMessageType = 'output' | 'error' | 'prompt';

interface ConsoleMessage {
  id: string; // For React key
  text: string;
  type: ConsoleMessageType;
}

const initialCode: string = `import sys
from datetime import date

print(f"Hello from {sys.version}")
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

const PythonEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const consoleOutputRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const pyodideRef = useRef<PyodideInterface | null>(null);

  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [isPyodideLoading, setIsPyodideLoading] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const addToConsole = useCallback((text: string, type: ConsoleMessageType = 'output') => {
    console.log('addToConsole received:', JSON.stringify(text));
    setMessages(prevMessages => [
      ...prevMessages,
      { id: Date.now().toString() + Math.random().toString(), text, type }
    ]);
  }, []);

  // Initialize CodeMirror
  useEffect(() => {
    if (editorRef.current && !editorViewRef.current) {
      const extensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        keymap.of([
            ...defaultKeymap,
            indentWithTab,
            { key: "Ctrl-3", run: toggleComment, mac: "Cmd-/" } // Added mac keymap
        ]),
        python(),
        oneDark,
        EditorView.theme({
            "&": { height: "100%", fontSize: "14px" },
            ".cm-scroller": { overflow: "auto" },
            ".cm-content": { padding: "1rem" }, // Adjusted padding
            ".cm-gutters": { padding: "0 0.5rem" } // Adjusted padding
        }),
        EditorView.lineWrapping,
      ];

      const startState = EditorState.create({
        doc: initialCode,
        extensions: extensions
      });

      const view = new EditorView({
        state: startState,
        parent: editorRef.current
      });
      editorViewRef.current = view;

      return () => {
        view.destroy();
        editorViewRef.current = null;
      };
    }
  }, []);

  // Initialize Pyodide
  useEffect(() => {
    const initializePyodide = async () => {
      addToConsole("Initializing Pyodide, please wait...", "prompt");
      setIsPyodideLoading(true);
      try {
        const pyodideInstance = await loadPyodide({
          indexURL: '/lib/pyodide/' // Assuming pyodide files are served from /pyodide/
                                // This path needs to be correct based on your Vite static asset handling
        });
        pyodideRef.current = pyodideInstance;

        pyodideInstance.setStdout({
            batched: (msg: string) => addToConsole(msg, 'output')
        });
        pyodideInstance.setStderr({
            batched: (msg: string) => addToConsole(msg, 'error')
        });

        addToConsole("Pyodide Ready.", "prompt");
      } catch (error) {
        console.error("Pyodide initialization failed:", error);
        addToConsole(`Pyodide initialization failed: ${(error as Error)?.message || String(error)}`, "error");
      } finally {
        setIsPyodideLoading(false);
      }
    };

    initializePyodide();
  }, [addToConsole]);

  // Scroll console to bottom
  useEffect(() => {
    if (consoleOutputRef.current) {
      consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
    }
  }, [messages]);

  const handleRunCode = async () => {
    if (!pyodideRef.current) {
      addToConsole("Pyodide not ready yet.", "error");
      return;
    }
    if (!editorViewRef.current) {
      addToConsole("Editor not initialized.", "error");
      return;
    }
    if (isExecuting || isPyodideLoading) return;

    const code = editorViewRef.current.state.doc.toString();
    addToConsole(`>>> Running code...`, "prompt");
    setIsExecuting(true);

    try {
      await pyodideRef.current.runPythonAsync(code);
    } catch (error) {
      console.error("Python execution error:", error);
      // Pyodide's stderr redirect should handle displaying the error.
      // Adding an extra message in case stderr is not comprehensive.
      if (!messages.some(m => m.text.includes((error as Error)?.message))) {
         addToConsole(`Execution error: ${(error as Error)?.message || String(error)}`, "error");
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearConsole = () => {
    setMessages([]);
  };

  const getMessageClass = (type: ConsoleMessageType): string => {
    switch (type) {
      case 'prompt':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400 whitespace-pre-wrap'; // Preserve error formatting
      case 'output':
      default:
        return 'text-gray-200 whitespace-pre-wrap'; // Preserve output formatting
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      <div className="flex flex-1 min-h-0 p-2 gap-2"> {/* min-h-0 is important for flex children in flex container */}
        {/* Code Column */}
        <div className="flex flex-col flex-1 w-1/2 bg-gray-700 rounded-md overflow-hidden">
          <div ref={editorRef} className="flex-grow h-full overflow-auto">
            {/* CodeMirror editor will be mounted here */}
          </div>
          <div className="p-2 border-t border-gray-600">
            <button
              onClick={handleRunCode}
              disabled={isPyodideLoading || isExecuting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isPyodideLoading ? 'Loading Pyodide...' : isExecuting ? 'Running...' : 'Run Code'}
            </button>
          </div>
        </div>

        {/* Console Column */}
        <div className="flex flex-col flex-1 w-1/2 bg-black rounded-md">
          <div className="flex justify-between items-center p-2 border-b border-gray-700">
            <span className="text-sm font-semibold">Console</span>
            <button
              onClick={handleClearConsole}
              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
            >
              Clear
            </button>
          </div>
          <div
            ref={consoleOutputRef}
            className="flex-grow overflow-y-auto p-2 font-mono text-sm"
          >
            {messages.map((msg) => (
              <div key={msg.id} className={getMessageClass(msg.type)}>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PythonEditor;