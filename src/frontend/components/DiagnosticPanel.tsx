import { useState, useEffect } from "react";
import { errorLogger } from "../utils/errorLogger";
import { Button } from "./ui/button";
import {
  X,
  Download,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * Diagnostic Panel Component
 * Shows error logs and system diagnostics (development only)
 * Access via Ctrl+Shift+D or Cmd+Shift+D
 */
export function DiagnosticPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState(errorLogger.getLogs());
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    // Keyboard shortcut to toggle panel (Ctrl+Shift+D or Cmd+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setLogs(errorLogger.getLogs());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refresh logs every 2 seconds when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setLogs(errorLogger.getLogs());
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleExport = () => {
    const report = errorLogger.getDiagnosticReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-report-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    errorLogger.clearLogs();
    setLogs([]);
  };

  const toggleExpand = (index: number) => {
    setExpandedLog(expandedLog === index ? null : index);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          size="sm"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Diagnostics
        </Button>
      </div>
    );
  }

  const errorCount = logs.filter((log) => log.level === "error").length;
  const warningCount = logs.filter((log) => log.level === "warn").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900">
              Diagnostic Panel
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errorCount}
              </span>
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                {warningCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No logs yet. Errors and warnings will appear here.</p>
              <p className="text-xs mt-2">
                Press <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl</kbd>{" "}
                + <kbd className="px-2 py-1 bg-gray-100 rounded">Shift</kbd> +{" "}
                <kbd className="px-2 py-1 bg-gray-100 rounded">D</kbd> to toggle
              </p>
            </div>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log, index) => {
                const actualIndex = logs.length - 1 - index;
                const isExpanded = expandedLog === actualIndex;

                return (
                  <div
                    key={actualIndex}
                    className={`border rounded-lg p-3 ${
                      log.level === "error"
                        ? "border-red-200 bg-red-50"
                        : log.level === "warn"
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => toggleExpand(actualIndex)}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        {log.level === "error" ? (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        ) : log.level === "warn" ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {log.context?.component || "App"}
                            </span>
                            {log.context?.action && (
                              <span className="text-xs text-gray-500">
                                • {log.context.action}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">
                            {log.message}
                          </p>
                          {log.error && !isExpanded && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {log.error.message}
                            </p>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {log.error && (
                          <>
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">
                                Error Message:
                              </p>
                              <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                                {log.error.message}
                              </pre>
                            </div>
                            {log.error.stack && (
                              <div>
                                <p className="text-xs font-medium text-gray-700 mb-1">
                                  Stack Trace:
                                </p>
                                <pre className="text-[10px] bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-40">
                                  {log.error.stack}
                                </pre>
                              </div>
                            )}
                          </>
                        )}
                        {log.context?.metadata && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">
                              Metadata:
                            </p>
                            <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                              {JSON.stringify(log.context.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          <p>URL: {log.url}</p>
                          <p className="truncate">
                            User Agent: {log.userAgent}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
          <p>
            💡 Tip: Use{" "}
            <code className="px-1 bg-gray-200 rounded">Ctrl+Shift+D</code> to
            toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
