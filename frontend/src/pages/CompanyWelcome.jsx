import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';

export default function CompanyWelcome() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const [companyName, setCompanyName] = useState(state?.companyName || '');

  // Fetch company name from backend if not passed via state
  useEffect(() => {
    if (!companyName) {
      api.get('/saas/my-company')
        .then(r => setCompanyName(r.data.data?.name || 'Your Company'))
        .catch(() => setCompanyName('Your Company'));
    }
  }, [companyName]);

  const handleGo = () => {
    // Trigger a full auth reload so AuthContext picks up the stored token
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">

        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl mb-6">
          <FiTrendingUp className="text-white text-4xl" />
        </div>

        <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/30 rounded-full px-4 py-1.5 mb-6">
          <FiCheckCircle className="text-green-400 text-sm" />
          <span className="text-green-300 text-sm font-medium">Registration Successful</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome to <span className="text-blue-300">{companyName || '…'}!</span>
        </h1>
        <p className="text-blue-200 text-base mb-8">
          Your company SFA workspace is ready.<br />
          Start managing your sales force today.
        </p>

        <button
          onClick={handleGo}
          className="inline-flex items-center gap-3 bg-white text-blue-700 font-bold px-8 py-4 rounded-2xl hover:bg-blue-50 transition-colors text-lg shadow-xl"
        >
          Go to Dashboard
          <FiArrowRight className="text-xl" />
        </button>

        <p className="text-blue-300 text-xs mt-8">
          Signed in as company admin · You can add staff from the Users section
        </p>
      </div>
    </div>
  );
}
