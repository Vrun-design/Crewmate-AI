import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export function Onboarding(): React.JSX.Element {
  const location = useLocation();

  return <Navigate replace to={`/dashboard${location.search}`} />;
}
