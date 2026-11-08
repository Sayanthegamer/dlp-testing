import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class StudentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Student Test View Error Boundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-7 max-w-md w-full shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-lg bg-[#b8622e]/15 text-[#b8622e] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="font-serif font-semibold text-xl text-[#1f1b16]">Examination display notice</h2>
            <p className="text-xs text-[#5e554a] leading-relaxed">
              {this.state.error?.message || 'An unexpected issue occurred while rendering this examination view.'}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="w-full py-2.5 rounded-lg bg-[#8c4a17] text-white font-medium text-xs hover:bg-[#733c12] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry displaying question</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-lg bg-[#efe9df] text-[#5e554a] font-medium text-xs hover:bg-[#dcd5c4] transition-colors cursor-pointer"
              >
                Return to portal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
