import { ReactNode, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '@/contexts/AuthContext';
import unwrappedMint from '@/assets/unwrapped-mint.png';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const context = useContext(AuthContext);
  
  // During HMR, context may be undefined briefly — treat as loading
  if (!context) {
    return (
      <div className="min-h-screen bg-gradient-mint flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <img src={unwrappedMint} alt="Loading..." className="h-16 w-16" />
        </motion.div>
      </div>
    );
  }
  
  const { user, isLoading } = context;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-mint flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <img src={unwrappedMint} alt="Loading..." className="h-16 w-16" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
