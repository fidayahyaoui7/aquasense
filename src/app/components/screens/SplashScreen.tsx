import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Droplets } from 'lucide-react';

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center max-w-[390px] mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-[#00B4D8] to-[#0077B6] rounded-3xl flex items-center justify-center shadow-lg shadow-[#00B4D8]/30">
            <Droplets className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-white mb-2">AquaSense</h1>
          <p className="text-[#90A4AE] text-sm px-8 leading-relaxed">
            Surveillance intelligente de votre consommation d'eau
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}