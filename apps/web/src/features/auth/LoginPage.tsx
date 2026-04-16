import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button, Input } from '../../components/ui';

interface LoginSuccess {
  sessionToken: string;
  book: {
    id: string;
    slug: string;
    title: string;
    authorName: string | null;
  };
  capabilities: {
    canRead: boolean;
    canComment: boolean;
    canHighlight: boolean;
    canBookmark: boolean;
    canDownloadOffline: boolean;
    canExportNotes: boolean;
    canManageAccess: boolean;
  };
}

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
};

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { t } = useTranslation();
  const [bookSlug, setBookSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiRequest<LoginSuccess>('/api/access/request', {
        method: 'POST',
        body: JSON.stringify({
          bookSlug: bookSlug.trim(),
          email: email.trim().toLowerCase(),
          password: password || undefined,
        }),
      });

      setAuth({
        sessionToken: data.sessionToken,
        bookId: data.book.id,
        bookSlug: data.book.slug,
        bookTitle: data.book.title,
        email: email.trim().toLowerCase(),
        capabilities: data.capabilities,
      });

      navigate(`/read/${data.book.slug}`);
    } catch (err) {
      setError((err as Error).message || t('login.error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-secondary to-background px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.4, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-accent/10 rounded-full blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
          className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-accent-secondary/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="relative z-10 max-w-md w-full"
      >
        <motion.div variants={itemVariants} className="flex justify-end mb-6">
          <LocaleSwitcher />
        </motion.div>

        <motion.div variants={itemVariants} className="text-center mb-8">
          <h1 className="text-hero font-bold text-foreground mb-3 tracking-tight">
            {t('app.title')}
          </h1>
          <p className="text-foreground-muted text-lg">{t('login.subtitle')}</p>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-8">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-accent-error/10 border border-accent-error/20 rounded-lg text-accent-error text-sm"
            >
              {error}
            </motion.div>
          )}

          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-5"
          >
            <Input
              label={t('login.bookSlugLabel')}
              type="text"
              value={bookSlug}
              onChange={(e) => setBookSlug(e.target.value)}
              placeholder={t('login.bookSlugPlaceholder')}
              required
            />

            <Input
              label={t('login.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
            />

            <Input
              label={t('login.passwordLabel')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              {isLoading ? t('login.signingIn') : t('login.submit')}
            </Button>
          </form>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="mt-8 text-center text-sm text-foreground-muted"
        >
          Secure EPUB reader with offline support
        </motion.p>
      </motion.div>
    </div>
  );
}
