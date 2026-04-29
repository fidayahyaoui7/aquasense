import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sending reset link
    setIsSubmitted(true);
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center max-w-[390px] mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <button
          onClick={() => navigate('/login')}
          className="w-10 h-10 bg-[#1A2B3C] rounded-xl flex items-center justify-center border border-[#2A3B4C] mb-6"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {!isSubmitted ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                Mot de passe oublié
              </h1>
              <p className="text-[#90A4AE] text-sm">
                Entrez votre adresse email pour recevoir un lien de réinitialisation
              </p>
            </div>

            {/* Reset Password Card */}
            <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C] shadow-xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre.email@example.com"
                      className="bg-[#0D1B2A] border-[#2A3B4C] text-white placeholder:text-[#90A4AE] pl-10"
                      required
                    />
                    <Mail className="w-5 h-5 text-[#90A4AE] absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl mt-6"
                >
                  Envoyer le lien de réinitialisation
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Success Message */}
            <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C] shadow-xl text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 bg-[#2DC653]/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-8 h-8 text-[#2DC653]" />
              </motion.div>

              <h2 className="text-xl font-bold text-white mb-3">Email envoyé !</h2>
              <p className="text-[#90A4AE] text-sm leading-relaxed mb-6">
                Un lien de réinitialisation a été envoyé à{' '}
                <span className="text-white font-medium">{email}</span>
              </p>

              <div className="bg-[#00B4D8]/10 border border-[#00B4D8]/30 rounded-xl p-4 mb-6">
                <p className="text-[#00B4D8] text-xs leading-relaxed">
                  💡 Vérifiez votre boîte de réception et vos spams. Le lien expire
                  dans 24 heures.
                </p>
              </div>

              <Button
                onClick={handleBackToLogin}
                className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl"
              >
                Retour à la connexion
              </Button>
            </div>
          </>
        )}

        {/* Back to Login Link (only shown before submission) */}
        {!isSubmitted && (
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-[#90A4AE] text-sm hover:text-white transition-colors"
            >
              ← Retour à la connexion
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
