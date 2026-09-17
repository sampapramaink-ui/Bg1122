import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug, Copy, Check } from 'lucide-react';
import { captureSystemError, copyErrorReportToClipboard } from '../utils/errorDiagnostics';
import { SystemErrorLog } from '../types';
import { SystemErrorDiagnosticModal } from './SystemErrorDiagnosticModal';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  capturedLog: SystemErrorLog | null;
  isModalOpen: boolean;
  copied: boolean;
}

export class SystemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      capturedLog: null,
      isModalOpen: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    const log = captureSystemError(error, 'react_boundary', {
      componentStack: errorInfo.componentStack || '',
      severity: 'critical',
      customMessage: 'React Component Tree Exception Caught',
    });
    this.setState({ capturedLog: log });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = async () => {
    if (this.state.capturedLog) {
      const success = await copyErrorReportToClipboard(this.state.capturedLog);
      if (success) {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none">
          <div className="max-w-xl w-full bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/80 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-black uppercase tracking-wider">
                React Render Exception Caught
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                ওয়েবসাইটে একটি কোডিং এরর ডিটেক্ট হয়েছে!
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                সিস্টেম স্বয়ংক্রিয়ভাবে ক্র্যাশ লগ রেকর্ড করেছে এবং এডমিন ডায়াগনস্টিককে সতর্ক করা হয়েছে।
              </p>
            </div>

            {/* Error message card */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-rose-900/60 font-mono text-xs text-rose-300 space-y-2 overflow-x-auto">
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>ERROR: {this.state.error?.name || 'Error'}</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="font-bold break-words whitespace-pre-wrap">
                {this.state.error?.message || 'Unknown runtime render error.'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => this.setState({ isModalOpen: true })}
                className="w-full sm:flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-2xl font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Bug className="w-4 h-4" />
                <span>সম্পূর্ণ এরর ডিটেইলস দেখুন</span>
              </button>

              <button
                onClick={this.handleCopy}
                className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>লগ কপি করুন</span>
                  </>
                )}
              </button>

              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-2xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>রিলোড করুন</span>
              </button>
            </div>

            {/* Modal */}
            <SystemErrorDiagnosticModal
              isOpen={this.state.isModalOpen}
              onClose={() => this.setState({ isModalOpen: false })}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
