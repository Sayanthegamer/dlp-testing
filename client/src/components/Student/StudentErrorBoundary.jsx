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
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white border border-[#e2d8ca] rounded-3xl p-8 max-w-md w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-xl text-[#2c2825]">Examination Display Notice</h2>
            <p className="text-xs text-[#736c62] leading-relaxed">
              {this.state.error?.message || 'An issue occurred while rendering this exam view.'}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="w-full py-3 rounded-xl bg-[#8c4a17] text-white font-bold text-xs shadow-sm hover:bg-[#733c12] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Displaying Question</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-[#f0e6d8] text-[#5c5346] font-bold text-xs hover:bg-[#e2d8ca] transition-all cursor-pointer"
              >
                Return to Portal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
