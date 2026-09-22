import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/70 p-6 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-red-900">
            {this.props.title || "একটি সমস্যা দেখা দিয়েছে"}
          </h3>
          <p className="mt-1 max-w-md text-xs text-red-700">
            {this.state.error?.message || "কম্পোনেন্ট লোড করার সময় অপ্রত্যাশিত ত্রুটি ঘটেছে।"}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
          >
            পুনরায় চেষ্টা করুন (Retry)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
