/**
 * Centralized Error Logging Utility
 * Provides consistent error logging across the application
 */

type ErrorContext = {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

type ErrorLevel = "error" | "warn" | "info";

interface LogEntry {
  level: ErrorLevel;
  message: string;
  error?: Error;
  context?: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
}

class ErrorLogger {
  private isDevelopment = import.meta.env.DEV;
  private maxLogs = 50; // Keep last 50 errors in memory
  private logs: LogEntry[] = [];

  /**
   * Log an error with context
   */
  logError(
    message: string,
    error?: Error | unknown,
    context?: ErrorContext,
  ): void {
    const errorObj = error instanceof Error ? error : undefined;
    const entry = this.createLogEntry("error", message, errorObj, context);

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    console.error(`❌ [${context?.component || "App"}] ${message}`, {
      error: errorObj?.message,
      stack: errorObj?.stack,
      context,
      timestamp: entry.timestamp,
    });

    // Store in localStorage for debugging (development only)
    if (this.isDevelopment) {
      this.persistToStorage();
    }

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // this.sendToErrorService(entry);
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    const entry = this.createLogEntry("warn", message, undefined, context);

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.warn(`⚠️ [${context?.component || "App"}] ${message}`, {
      context,
      timestamp: entry.timestamp,
    });

    if (this.isDevelopment) {
      this.persistToStorage();
    }
  }

  /**
   * Log info (for tracking important events)
   */
  logInfo(message: string, context?: ErrorContext): void {
    const entry = this.createLogEntry("info", message, undefined, context);

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.isDevelopment) {
      console.info(`ℹ️ [${context?.component || "App"}] ${message}`, {
        context,
        timestamp: entry.timestamp,
      });
      this.persistToStorage();
    }
  }

  /**
   * Get all logged errors
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: ErrorLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.isDevelopment) {
      localStorage.removeItem("app-error-logs");
    }
  }

  /**
   * Export logs as JSON (for debugging)
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get diagnostic report
   */
  getDiagnosticReport(): {
    totalErrors: number;
    totalWarnings: number;
    recentErrors: LogEntry[];
    systemInfo: {
      userAgent: string;
      url: string;
      timestamp: string;
      isDevelopment: boolean;
    };
  } {
    return {
      totalErrors: this.getLogsByLevel("error").length,
      totalWarnings: this.getLogsByLevel("warn").length,
      recentErrors: this.logs.slice(-10),
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        isDevelopment: this.isDevelopment,
      },
    };
  }

  private createLogEntry(
    level: ErrorLevel,
    message: string,
    error?: Error,
    context?: ErrorContext,
  ): LogEntry {
    return {
      level,
      message,
      error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  }

  private persistToStorage(): void {
    try {
      const logsToStore = this.logs.map((log) => ({
        ...log,
        error: log.error
          ? {
              message: log.error.message,
              stack: log.error.stack,
              name: log.error.name,
            }
          : undefined,
      }));
      localStorage.setItem("app-error-logs", JSON.stringify(logsToStore));
    } catch (err) {
      console.error("❌ Failed to persist logs to storage:", err);
    }
  }

  /**
   * Restore logs from localStorage (development only)
   */
  restoreFromStorage(): void {
    if (!this.isDevelopment) return;

    try {
      const stored = localStorage.getItem("app-error-logs");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.logs = parsed;
      }
    } catch (err) {
      console.error("❌ Failed to restore logs from storage:", err);
    }
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

// Restore logs on initialization (development only)
if (import.meta.env.DEV) {
  errorLogger.restoreFromStorage();
}

// Global error handler
window.addEventListener("error", (event) => {
  errorLogger.logError("Uncaught error", event.error, {
    component: "Global",
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
});

// Global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  errorLogger.logError(
    "Unhandled promise rejection",
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason)),
    {
      component: "Global",
      action: "Promise rejection",
    },
  );
});

// Expose to window for debugging (development only)
if (import.meta.env.DEV) {
  (window as any).__errorLogger = errorLogger;
  console.info(
    "🔍 Error logger available at window.__errorLogger\n" +
      "Commands:\n" +
      "  __errorLogger.getLogs() - Get all logs\n" +
      "  __errorLogger.getDiagnosticReport() - Get diagnostic report\n" +
      "  __errorLogger.exportLogs() - Export logs as JSON\n" +
      "  __errorLogger.clearLogs() - Clear all logs",
  );
}
