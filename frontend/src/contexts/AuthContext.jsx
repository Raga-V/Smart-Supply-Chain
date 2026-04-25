import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Force-refresh token on load to get latest custom claims
          const token = await firebaseUser.getIdTokenResult(true);
          const rawToken = await firebaseUser.getIdToken();
          window.__fbToken = rawToken;
          window.getFbToken = async () => {
            const t = await firebaseUser.getIdToken(true);
            window.__fbToken = t;
            console.log('Fresh token length:', t.length);
            return t;
          };
          setUser(firebaseUser);
          setUserProfile({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL:    firebaseUser.photoURL,
            orgId:       token.claims.org_id || null,
            role:        token.claims.role    || null,
          });
        } catch (err) {
          console.error('Token error:', err);
          setUser(firebaseUser);
          setUserProfile({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL:    firebaseUser.photoURL,
            orgId:       null,
            role:        null,
          });
        }
      } else {
        window.__fbToken = null;
        window.getFbToken = null;
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;

  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const signup = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const getToken = async () => {
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  const refreshClaims = async () => {
    if (user) {
      const token = await user.getIdTokenResult(true);
      setUserProfile(prev => ({
        ...prev,
        orgId: token.claims.org_id || null,
        role: token.claims.role || null,
      }));
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    signup,
    loginWithGoogle,
    logout,
    getToken,
    refreshClaims,
    isAuthenticated: !!user,
    isAdmin:        userProfile?.role === 'admin',
    isManager:      ['admin', 'manager'].includes(userProfile?.role),
    isFleetManager: userProfile?.role === 'fleet_manager',
    isAnalyst:      userProfile?.role === 'analyst',
    isDriver:       userProfile?.role === 'driver',
    role:           userProfile?.role || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
