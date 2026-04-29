import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { isAxiosError } from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import * as auth from '../../../api/auth';

function splitFullName(fullName: string): { prenom: string; nom: string } {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return { prenom: 'Utilisateur', nom: 'AquaSense' };
  if (parts.length === 1) return { prenom: parts[0], nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

function formatRegisterError(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { detail?: string | { msg?: string }[] } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg ?? JSON.stringify(d)).join(', ');
    }
  }
  if (err instanceof Error) return err.message;
  return "Inscription impossible. Réessayez.";
}

export function RegisterScreen() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!formData.acceptTerms) {
      setError("Veuillez accepter les conditions d'utilisation");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }

    const { prenom, nom } = splitFullName(formData.fullName);

    setLoading(true);
    try {
      await auth.register({
        prenom,
        nom,
        email: formData.email.trim(),
        telephone: formData.phone.trim(),
        adresse: '',
        building_type: 'maison',
        password: formData.password,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(formatRegisterError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto">
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-10 h-10 bg-[#1A2B3C] rounded-xl flex items-center justify-center border border-[#2A3B4C] mb-6"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white mb-2">Créer un compte</h1>
          <p className="text-[#90A4AE] text-sm mb-6">
            Rejoignez AquaSense pour surveiller votre consommation d'eau
          </p>

          <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C] shadow-xl">
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-[#E63946]/50 bg-[#E63946]/10 px-3 py-2 text-sm text-[#E63946]"
              >
                {error}
              </div>
            )}

            <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-white">
                  Nom complet
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Ahmed Ben Salem"
                  className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE]"
                  required
                />
              </div>

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
                <Label htmlFor="phone" className="text-white">
                  Numéro de téléphone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+216 98 765 432"
                  className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE]"
                  required
                  autoComplete="tel"
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
                    minLength={6}
                    autoComplete="new-password"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Confirmer mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE] pr-10"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90A4AE] hover:text-white"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, acceptTerms: checked as boolean })
                  }
                  className="mt-1 border-[#2A3B4C] data-[state=checked]:bg-[#00B4D8] data-[state=checked]:border-[#00B4D8]"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-[#90A4AE] leading-relaxed cursor-pointer"
                >
                  J'accepte les{' '}
                  <span className="text-[#00B4D8]">conditions d'utilisation</span> et la{' '}
                  <span className="text-[#00B4D8]">politique de confidentialité</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl mt-6 disabled:opacity-60"
              >
                {loading ? 'Création…' : 'Créer mon compte'}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[#90A4AE] text-sm">
              Déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[#00B4D8] font-medium hover:underline"
              >
                Se connecter
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
