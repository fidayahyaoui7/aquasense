import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { isAxiosError } from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Droplets, Eye, EyeOff } from 'lucide-react';
import * as auth from '../../../api/auth';

function formatLoginError(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { detail?: string | { msg?: string }[] } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg ?? JSON.stringify(d)).join(', ');
    }
  }
  if (err instanceof Error) return err.message;
  return 'Connexion impossible. Réessayez.';
}

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const st = location.state as { registered?: boolean } | null;
    if (st?.registered) {
      setInfo('Compte créé. Vous pouvez vous connecter.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }
    
    setLoading(true);
    try {
      const data = await auth.login(formData.email.trim(), formData.password);
      // Sync localStorage config with user data from backend
      const existingCfg = JSON.parse(localStorage.getItem('aquasense_config') || '{}');
      const cfg = {
        ...existingCfg,
        buildingType: data.user.building_type 
          ? data.user.building_type.charAt(0).toUpperCase() + data.user.building_type.slice(1)
          : existingCfg.buildingType || 'Maison',
        buildingName: existingCfg.buildingName || 'Mon bâtiment',
        address: data.user.adresse || existingCfg.address || '',
      };
      localStorage.setItem('aquasense_config', JSON.stringify(cfg));
      
      // Redirect to onboarding only for new users who haven't configured
      // Existing users with building_type != "maison" or with an address are considered configured
      const hasExistingConfig = 
        (data.user.building_type && data.user.building_type !== 'maison') || 
        (data.user.adresse && data.user.adresse.trim() !== '');
      
      if (!data.user.is_configured && !hasExistingConfig) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(formatLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center max-w-[390px] mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-[#00B4D8] to-[#0077B6] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00B4D8]/30 mb-4">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AquaSense</h1>
          <p className="text-[#90A4AE] text-sm mt-1">
            Surveillance intelligente de l'eau
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C] shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Connexion</h2>

          {info && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-[#2DC653]/50 bg-[#2DC653]/10 px-3 py-2 text-sm text-[#2DC653]"
            >
              {info}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-[#E63946]/50 bg-[#E63946]/10 px-3 py-2 text-sm text-[#E63946]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="votre.email@example.com"
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE]"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE] pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90A4AE] hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => navigate('/reset-password')}
                className="text-[#00B4D8] text-sm hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl disabled:opacity-60"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
        </div>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-[#90A4AE] text-sm">
            Vous n'avez pas de compte ?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-[#00B4D8] font-medium hover:underline"
            >
              Créer un compte
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
