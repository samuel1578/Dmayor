import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import logoHeader from '../../assets/logo-header.png';
import logoDark from '../../assets/logodark.png';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared editorial layout for the customer auth pages — same brand type system,
 * palette and theme handling as the storefront and the admin console.
 */
export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? logoHeader : logoDark;

  return (
    <div className="min-h-screen bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-ghana-black kente-pattern p-12 xl:p-16">
        <Link to="/" aria-label="The Proxy Shop — go to homepage" className="w-fit">
          <img
            src={theme === 'dark' ? logoHeader : logoDark}
            alt="The Proxy Shop"
            className="h-16 w-auto object-contain"
          />
        </Link>

        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-6">
            The Proxy Shop
          </p>
          <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] text-ghana-light max-w-md">
            Curated menswear, kept on file.
          </h1>
          <p className="mt-6 text-sm font-ui text-ghana-light/60 max-w-sm leading-relaxed">
            Create an account to keep your details handy and your cart waiting when you return.
          </p>
        </div>

        <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-light/40">
          Shirts · Trousers · Hoodies · Shoes
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col min-h-screen lg:min-h-0 px-6 sm:px-10 lg:px-16 py-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="The Proxy Shop — go to homepage" className="w-fit lg:hidden">
            <img src={logoSrc} alt="The Proxy Shop" className="h-12 w-auto object-contain" />
          </Link>
          <span className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-ghana-black/15 dark:border-white/20 text-ghana-black dark:text-white hover:border-ghana-green hover:text-ghana-green transition-colors duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-4">
              {eyebrow}
            </p>
            <h2 className="font-display text-4xl text-ghana-black dark:text-white mb-3">
              {title}
            </h2>
            <p className="text-sm text-ghana-black/60 dark:text-white/60 mb-8 leading-relaxed">
              {description}
            </p>

            {children}

            {footer && <div className="mt-8">{footer}</div>}

            <Link
              to="/"
              className="block mt-8 text-xs uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50 hover:text-ghana-green transition-colors duration-200"
            >
              ← Back to storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
