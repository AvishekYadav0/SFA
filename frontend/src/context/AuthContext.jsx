import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount — restore session from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    authService.getMe()
      .then(res => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, role) => {
    const res = await authService.login({ email, password, role });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    setUser(userData);
    return userData; // caller uses this to navigate
  }, []);

  const register = useCallback(async (data) => {
    await authService.registerAdmin(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => {
    setUser(prev => ({ ...prev, ...data }));
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateUser,
      // Role helpers — use these everywhere instead of user.role === '...'
      isAdmin:  user?.role === 'admin',
      isNSM:    user?.role === 'nsm',
      isRSM:    user?.role === 'rsm',
      isASM:    user?.role === 'asm',
      isSE:     user?.role === 'se',
      isSO:     user?.role === 'so',
      isDealer: user?.role === 'dealer',
      // True for any role that can manage data (not dealer-only view)
      canManage: ['admin', 'nsm', 'rsm', 'asm', 'se', 'so'].includes(user?.role),
      // True for roles that can see reports/analytics
      canViewReports: ['admin', 'nsm', 'rsm', 'asm', 'se'].includes(user?.role),
      // True for roles that can manage other users
      canManageUsers: ['admin', 'nsm', 'rsm', 'asm'].includes(user?.role),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
