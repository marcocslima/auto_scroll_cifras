
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase/config';

const PrivateRoute = ({ children }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <div>Carregando...</div>; // Ou um componente de spinner
  }

  return user ? children : <Navigate to="/admin/login" />;
};

export default PrivateRoute;
